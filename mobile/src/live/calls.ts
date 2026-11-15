/**
 * Voice and video calls over WebRTC, introduced by the HMSC server (server/src/rtc.js "inbox" / "family" sockets).
 * The media flows directly between the two browsers (peer to peer); the server only relays the handshake.
 * Works on a local network or the internet with STUN; set TURN_HOST / TURN_SECRET on the server (see DEPLOY.md) for strict firewalls.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { rtcUrl } from '@/data/rtcClient';
import { getIce } from '@/data/ice';

export type CallKind = 'doctor' | 'family' | 'crew';
export type CallState = {
  phase: 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
  callId?: string; kind?: CallKind; peerName?: string; incoming?: boolean; note?: string; muted: boolean; videoOn: boolean; seconds: number;
};
const IDLE: CallState = { phase: 'idle', muted: false, videoOn: true, seconds: 0 };

/** Plays a short repeating tone pattern (ringing / alarm) with the Web Audio API. Returns a stop function. */
export function tone(kind: 'ring' | 'alarm'): () => void {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext; const ctx = new Ctx();
    const beep = (f: number, d: number, at: number, vol = 0.12) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.type = kind === 'alarm' ? 'square' : 'sine'; g.gain.value = vol; o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + d); };
    const play = () => { if (kind === 'ring') { beep(440, 0.4, 0); beep(480, 0.4, 0); } else { beep(880, 0.25, 0, 0.18); beep(660, 0.25, 0.3, 0.18); } };
    play(); const id = setInterval(play, kind === 'ring' ? 2200 : 800);
    return () => { clearInterval(id); ctx.close().catch(() => {}); };
  } catch { return () => {}; }
}

/** `query` is the socket query ("role=inbox" or "role=family&token=…"); null = stay disconnected. onEvent receives every non-call server message. */
export function useCalls(query: string | null, onEvent?: (m: any) => void) {
  const [call, setCall] = useState<CallState>(IDLE);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null), pc = useRef<RTCPeerConnection | null>(null), cur = useRef<CallState>(IDLE), media = useRef<MediaStream | null>(null);
  const ev = useRef(onEvent); ev.current = onEvent;
  const ring = useRef<null | (() => void)>(null), clock = useRef<any>(null), pendingIce = useRef<any[]>([]);

  const set = (p: Partial<CallState>) => { cur.current = { ...cur.current, ...p }; setCall(cur.current); };
  const send = (m: object) => { try { ws.current?.readyState === 1 && ws.current.send(JSON.stringify(m)); } catch { /* closing */ } };
  const stopRing = () => { ring.current?.(); ring.current = null; };
  const cleanup = useCallback((note?: string) => {
    stopRing(); clearInterval(clock.current); pc.current?.close(); pc.current = null; media.current?.getTracks().forEach(t => t.stop()); media.current = null; pendingIce.current = [];
    setLocal(null); setRemote(null); cur.current = { ...IDLE, phase: note ? 'ended' : 'idle', note }; setCall(cur.current);
    if (note) setTimeout(() => { if (cur.current.phase === 'ended') { cur.current = IDLE; setCall(IDLE); } }, 3000);
  }, []);

  const getMedia = async (video: boolean) => {
    try { media.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false }); }
    catch { media.current = await navigator.mediaDevices.getUserMedia({ audio: true }); set({ videoOn: false }); } // no camera: audio only
    setLocal(media.current); return media.current;
  };
  const makePc = async (callId: string, stream: MediaStream) => {
    const p = new RTCPeerConnection(await getIce()); pc.current = p;
    stream.getTracks().forEach(t => p.addTrack(t, stream));
    p.onicecandidate = e => { if (e.candidate) send({ type: 'signal', callId, data: { candidate: e.candidate } }); };
    p.ontrack = e => setRemote(e.streams[0]);
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') { stopRing(); const t0 = Date.now(); clearInterval(clock.current); clock.current = setInterval(() => set({ seconds: Math.round((Date.now() - t0) / 1000) }), 1000); set({ phase: 'connected' }); }
      else if (['failed', 'disconnected'].includes(p.connectionState) && cur.current.phase === 'connected') { send({ type: 'end', callId }); cleanup('The connection was lost.'); }
    };
    return p;
  };

  useEffect(() => {
    if (!query || typeof WebSocket === 'undefined') return;
    let closed = false, retry: any, tries = 0;
    const open = () => {
      const w = new WebSocket(rtcUrl(query)); ws.current = w;
      w.onopen = () => { tries = 0; setConnected(true); };
      w.onmessage = async e => {
        let m: any; try { m = JSON.parse(e.data); } catch { return; }
        const c = cur.current;
        if (m.type === 'incoming') {
          if (c.phase !== 'idle' && c.phase !== 'ended') { send({ type: 'decline', callId: m.callId }); return; } // already in a call
          set({ phase: 'ringing', incoming: true, callId: m.callId, kind: m.kind, peerName: m.fromName, note: undefined, seconds: 0, muted: false, videoOn: true }); stopRing(); ring.current = tone('ring');
        } else if (m.type === 'calling') set({ callId: m.callId });
        else if (m.type === 'accepted' && m.callId === c.callId) { // the other side picked up: we are the caller, so we make the offer
          set({ phase: 'connecting', peerName: m.byName ?? c.peerName }); stopRing();
          try { const p = await makePc(m.callId, media.current ?? await getMedia(true)); const offer = await p.createOffer(); await p.setLocalDescription(offer); send({ type: 'signal', callId: m.callId, data: { sdp: p.localDescription } }); } catch { send({ type: 'end', callId: m.callId }); cleanup('Could not start the call.'); }
        } else if (m.type === 'signal' && m.callId === c.callId) {
          const d = m.data ?? {};
          try {
            if (d.sdp?.type === 'offer') { const p = pc.current ?? await makePc(m.callId, media.current ?? await getMedia(true)); await p.setRemoteDescription(d.sdp); for (const i of pendingIce.current.splice(0)) await p.addIceCandidate(i).catch(() => {}); const a = await p.createAnswer(); await p.setLocalDescription(a); send({ type: 'signal', callId: m.callId, data: { sdp: p.localDescription } }); }
            else if (d.sdp?.type === 'answer') { await pc.current?.setRemoteDescription(d.sdp); for (const i of pendingIce.current.splice(0)) await pc.current?.addIceCandidate(i).catch(() => {}); }
            else if (d.candidate) { if (pc.current?.remoteDescription) await pc.current.addIceCandidate(d.candidate).catch(() => {}); else pendingIce.current.push(d.candidate); }
          } catch { /* a stale candidate */ }
        } else if (m.type === 'ended') {
          if (m.callId && c.callId && m.callId !== c.callId) return;
          if (c.phase === 'idle') return;
          const why: Record<string, string> = { declined: 'The call was declined.', 'no-answer': 'No answer.', hangup: 'The call ended.', missed: 'Missed call.', taken: 'Answered by another flight surgeon.', cancelled: 'The caller hung up.', disconnected: 'The other side disconnected.', gone: 'This call is no longer available.' };
          cleanup(why[m.reason] ?? 'The call ended.');
        } else if (m.type === 'unavailable') {
          cleanup(m.reason === 'not-allowed' ? 'You cannot call that person.' : m.pending ? 'Not online right now. They will see the call when they open their link.' : 'They are not online right now.');
        } else if (m.type !== 'hello') ev.current?.(m);
        if (m.type === 'hello') ev.current?.(m);
      };
      w.onclose = () => { setConnected(false); if (!closed) retry = setTimeout(open, Math.min(15000, 1000 * 2 ** tries++)); };
    };
    open();
    return () => { closed = true; clearTimeout(retry); ws.current?.close(); cleanup(); };
  }, [query, cleanup]);

  const startCall = useCallback(async (to: string, kind: CallKind, name: string) => {
    if (cur.current.phase !== 'idle' && cur.current.phase !== 'ended') return;
    if (!navigator.mediaDevices?.getUserMedia) { set({ ...IDLE, phase: 'ended', note: 'Calls need a secure page (https) with a microphone.' }); return; }
    try { await getMedia(true); } catch { set({ ...IDLE, phase: 'ended', note: 'Microphone permission is needed to call.' }); return; }
    set({ ...IDLE, phase: 'calling', incoming: false, kind, peerName: name }); ring.current = tone('ring');
    send({ type: 'call', to, kind });
  }, []);
  const accept = useCallback(async () => {
    const c = cur.current; if (c.phase !== 'ringing' || !c.callId) return;
    stopRing();
    try { await getMedia(true); } catch { send({ type: 'decline', callId: c.callId }); cleanup('Microphone permission is needed to answer.'); return; }
    set({ phase: 'connecting' }); send({ type: 'accept', callId: c.callId });
  }, [cleanup]);
  const decline = useCallback(() => { const c = cur.current; if (c.callId) send({ type: c.phase === 'ringing' ? 'decline' : 'end', callId: c.callId }); cleanup(); }, [cleanup]);
  const hangup = decline;
  const mute = useCallback(() => { const m = !cur.current.muted; media.current?.getAudioTracks().forEach(t => { t.enabled = !m; }); set({ muted: m }); }, []);
  const video = useCallback(() => { const on = !cur.current.videoOn; media.current?.getVideoTracks().forEach(t => { t.enabled = on; }); set({ videoOn: on }); }, []);

  return { call, local, remote, connected, startCall, accept, decline, hangup, mute, video };
}
