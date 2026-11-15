import { api } from '@/api';

/** STUN, plus a TURN relay when the server has one (needed behind strict firewalls and on some mobile networks). Cached for 10 minutes. */
let cache: { at: number; cfg: RTCConfiguration } | null = null;
export async function getIce(): Promise<RTCConfiguration> {
  if (cache && Date.now() - cache.at < 10 * 60e3) return cache.cfg;
  try { const r = await api<{ iceServers: RTCIceServer[] }>('/api/ice'); cache = { at: Date.now(), cfg: { iceServers: r.iceServers } }; }
  catch { cache = { at: Date.now() - 9 * 60e3, cfg: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } }; } // retry soon
  return cache.cfg;
}
