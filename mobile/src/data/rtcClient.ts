/**
 * Live video over WebRTC (browser standard). The camera page publishes its stream straight to each watching surgeon
 * (peer to peer, up to 1280x720 at 30 fps); the server only relays the handshake over a WebSocket (server/src/rtc.js).
 */
import { API_URL } from '@/api';
import { getIce } from './ice';


/** ws(s) URL of the signaling endpoint on the API host. */
export function rtcUrl(query: string): string {
  const o = API_URL && /^https?:/.test(API_URL) ? new URL(API_URL) : new URL(location.origin);
  return `${o.protocol === 'https:' ? 'wss' : 'ws'}://${o.host}/rtc?${query}`;
}
/** Query for the camera side: base is `/api/station/<id>` or `/api/cam/<token>`. */
export const pubQuery = (base: string) => {
  const m = /\/api\/(station|cam)\/([^/]+)/.exec(base);
  return m ? `role=pub&${m[1] === 'station' ? 'station' : 'token'}=${encodeURIComponent(m[2])}` : 'role=pub';
};
export const rtcSupported = () => typeof RTCPeerConnection !== 'undefined' && typeof WebSocket !== 'undefined';

/** Best capture settings: HD at 30 fps (the browser falls back to what the camera can do). */
export const HD_VIDEO = (face: 'environment' | 'user'): MediaTrackConstraints => ({ facingMode: { ideal: face }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } });

/** Publish `getStream()` to every surgeon who joins. Returns a stop function. */
export function publish(query: string, getStream: () => MediaStream | null, onViewers: (n: number) => void): () => void {
  let ws: WebSocket | null = null, closed = false, retry: any = null;
  const peers = new Map<string, RTCPeerConnection>();
  const drop = (id: string) => { peers.get(id)?.close(); peers.delete(id); onViewers(peers.size); };

  const connect = () => {
    ws = new WebSocket(rtcUrl(query));
    const send = (m: object) => { try { ws?.readyState === 1 && ws.send(JSON.stringify(m)); } catch { /* closing */ } };
    ws.onmessage = async ev => {
      let m: any; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'viewer-joined') {
        const s = getStream(); if (!s) return;
        drop(m.id);
        const pc = new RTCPeerConnection(await getIce()); peers.set(m.id, pc);
        s.getTracks().forEach(t => { if (t.kind === 'video') (t as any).contentHint = 'motion'; pc.addTrack(t, s); });
        pc.onicecandidate = e => { if (e.candidate) send({ type: 'ice', to: m.id, candidate: e.candidate }); };
        pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) drop(m.id); else onViewers([...peers.values()].filter(p => p.connectionState === 'connected').length); };
        // high quality, steady frame rate: ~3 Mbps, keep resolution when the network is tight
        for (const snd of pc.getSenders()) if (snd.track?.kind === 'video') {
          const p = snd.getParameters(); p.encodings = p.encodings?.length ? p.encodings : [{}];
          p.encodings[0].maxBitrate = 3_000_000; p.encodings[0].maxFramerate = 30; (p as any).degradationPreference = 'maintain-resolution';
          snd.setParameters(p).catch(() => {});
        }
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        send({ type: 'offer', to: m.id, sdp: pc.localDescription });
      } else if (m.type === 'answer') { await peers.get(m.from)?.setRemoteDescription(m.sdp).catch(() => {}); }
      else if (m.type === 'ice') { await peers.get(m.from)?.addIceCandidate(m.candidate).catch(() => {}); }
      else if (m.type === 'viewer-left') drop(m.id);
      else if (m.type === 'replaced') { closed = true; }
    };
    ws.onclose = () => { [...peers.keys()].forEach(drop); if (!closed) retry = setTimeout(connect, 2000); };
  };
  connect();
  return () => { closed = true; clearTimeout(retry); [...peers.keys()].forEach(drop); try { ws?.close(); } catch { /* ignore */ } };
}

export type ViewStats = { fps: number; width: number; height: number; kbps: number };

/** Surgeon side: connect to the astronaut's camera. Calls onStream with the live MediaStream. Returns a stop function. */
export function watch(userId: string | number, onStream: (s: MediaStream | null) => void, onState: (s: 'connecting' | 'live' | 'waiting' | 'failed') => void, onStats: (s: ViewStats) => void): () => void {
  let ws: WebSocket | null = null, pc: RTCPeerConnection | null = null, closed = false, retry: any = null, lastBytes = 0, lastT = 0;
  const statsTimer = setInterval(async () => {
    const rep = pc ? await pc.getStats().catch(() => null) : null; if (!rep) return;
    rep.forEach((r: any) => {
      if (r.type === 'inbound-rtp' && r.kind === 'video') {
        const kbps = lastT ? Math.round(((r.bytesReceived - lastBytes) * 8) / Math.max(1, r.timestamp - lastT)) : 0;
        lastBytes = r.bytesReceived; lastT = r.timestamp;
        onStats({ fps: Math.round(r.framesPerSecond ?? 0), width: r.frameWidth ?? 0, height: r.frameHeight ?? 0, kbps });
      }
    });
  }, 1000);
  const reset = () => { pc?.close(); pc = null; onStream(null); };
  const connect = () => {
    onState('connecting');
    ws = new WebSocket(rtcUrl(`role=view&user=${userId}`));
    ws.onmessage = async ev => {
      let m: any; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.type === 'no-publisher' || m.type === 'publisher-left') { reset(); onState('waiting'); }
      else if (m.type === 'offer') {
        pc?.close(); pc = new RTCPeerConnection(await getIce()); const mine = pc;
        mine.ontrack = e => { onStream(e.streams[0]); onState('live'); };
        mine.onicecandidate = e => { if (e.candidate && ws?.readyState === 1) ws.send(JSON.stringify({ type: 'ice', candidate: e.candidate })); };
        mine.onconnectionstatechange = () => { if (mine.connectionState === 'failed') { onState('failed'); } };
        await mine.setRemoteDescription(m.sdp); const ans = await mine.createAnswer(); await mine.setLocalDescription(ans);
        ws?.send(JSON.stringify({ type: 'answer', sdp: mine.localDescription }));
      } else if (m.type === 'ice') { await pc?.addIceCandidate(m.candidate).catch(() => {}); }
    };
    ws.onclose = () => { reset(); if (!closed) { onState('waiting'); retry = setTimeout(connect, 2000); } };
  };
  connect();
  return () => { closed = true; clearInterval(statsTimer); clearTimeout(retry); reset(); try { ws?.close(); } catch { /* ignore */ } };
}

