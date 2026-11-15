/**
 * Live video signaling (WebRTC). The video itself flows straight from the camera page to the surgeon's browser
 * (peer to peer, HD, up to 30 fps, tens of milliseconds on a LAN); this module only introduces the two sides to each other
 * over a WebSocket: it relays the SDP offer / answer and ICE candidates. No video passes through the server.
 *
 *   wss://host/rtc?role=pub&station=<astronautId>      the camera station (needs CAMERA_STATION=on, demo only)
 *   wss://host/rtc?role=pub&token=<private link token> the astronaut's private camera link
 *   wss://host/rtc?role=view&user=<astronautId>        a signed-in flight surgeon (session cookie checked on connect)
 *
 * Library: `ws` (github.com/websockets/ws, MIT). Everything else is the browser's built-in WebRTC.
 */
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { sessionUser } from './auth.js';
import { isAdmin } from './roles.js';

/** userId -> { pub: WebSocket | null, viewers: Map<id, WebSocket> } */
const rooms = new Map();
const room = uid => { let r = rooms.get(uid); if (!r) rooms.set(uid, (r = { pub: null, viewers: new Map() })); return r; };
const send = (ws, msg) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); } catch { /* peer went away */ } };

export const rtcState = uid => { const r = rooms.get(uid); return { live: !!r?.pub, viewers: r?.viewers.size ?? 0 }; };

const stationOn = () => process.env.CAMERA_STATION === 'on' && process.env.NODE_ENV !== 'production';
const isCrew = id => !!db.prepare("SELECT 1 FROM users WHERE id = ? AND role IN ('astronaut','analog')").get(id);
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

/** Who may connect? Returns { role, uid } or null. */
export function authorize(req) {
  const u = new URL(req.url, 'http://x');
  const role = u.searchParams.get('role');
  if (role === 'inbox') { const s = sessionUser(req); return s ? { role, uid: s.user.id, key: `u:${s.user.id}`, admin: isAdmin(s.user), name: s.user.name } : null; }
  if (role === 'family') {
    const t = u.searchParams.get('token'); const f = t && TOKEN.test(t) ? db.prepare('SELECT id, user_id, name FROM family_contacts WHERE token = ?').get(t) : null;
    return f ? { role, uid: f.user_id, key: `f:${f.id}`, famId: f.id, name: f.name } : null;
  }
  if (role === 'view') {
    const uid = Number(u.searchParams.get('user'));
    const s = sessionUser(req);
    return s && isAdmin(s.user) && isCrew(uid) ? { role, uid } : null;
  }
  if (role === 'pub') {
    const st = u.searchParams.get('station');
    if (st != null) { const uid = Number(st); return stationOn() && isCrew(uid) ? { role, uid } : null; }
    const t = u.searchParams.get('token');
    const o = t && TOKEN.test(t) ? db.prepare('SELECT user_id FROM cam_links WHERE token = ?').get(t) : null;
    return o ? { role, uid: o.user_id } : null;
  }
  return null;
}

export function attachRtc(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    if (!String(req.url).startsWith('/rtc')) return; // other upgrades (none today) are left alone
    const who = authorize(req);
    if (!who) { socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, who));
  });

  wss.on('connection', (ws, who) => {
    if (who.role === 'inbox' || who.role === 'family') return hub(ws, who);
    const r = room(who.uid);
    const id = randomBytes(6).toString('hex');
    ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });

    if (who.role === 'pub') {
      if (r.pub && r.pub !== ws) { send(r.pub, { type: 'replaced' }); try { r.pub.close(); } catch { /* ignore */ } } // a newer camera replaces the old one
      r.pub = ws;
      for (const [vid, v] of r.viewers) { send(v, { type: 'publisher-ready' }); send(ws, { type: 'viewer-joined', id: vid }); }
    } else {
      r.viewers.set(id, ws);
      if (r.pub) send(r.pub, { type: 'viewer-joined', id }); else send(ws, { type: 'no-publisher' });
    }

    ws.on('message', raw => {
      let m; try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m !== 'object' || !['offer', 'answer', 'ice'].includes(m.type)) return;
      if (who.role === 'pub') { const v = r.viewers.get(String(m.to)); if (v) send(v, { type: m.type, sdp: m.sdp, candidate: m.candidate }); } // camera -> one viewer
      else if (r.pub) send(r.pub, { type: m.type, from: id, sdp: m.sdp, candidate: m.candidate });                                              // viewer -> camera
    });
    ws.on('close', () => {
      if (who.role === 'pub') { if (r.pub === ws) { r.pub = null; for (const v of r.viewers.values()) send(v, { type: 'publisher-left' }); } }
      else { r.viewers.delete(id); if (r.pub) send(r.pub, { type: 'viewer-left', id }); }
      if (!r.pub && !r.viewers.size) rooms.delete(who.uid);
    });
  });
  // drop dead connections (a phone that lost Wi-Fi never says goodbye)
  const t = setInterval(() => wss.clients.forEach(c => { if (!c.isAlive) return c.terminate(); c.isAlive = false; try { c.ping(); } catch { /* ignore */ } }), 15000);
  t.unref(); wss.on('close', () => clearInterval(t));
  return wss;
}

// ------------------------------------------------------------------ inbox: live alerts and calls
/** peer key ('u:<userId>' or 'f:<familyContactId>') -> open sockets */
const peers = new Map();
/** callId -> { id, kind, a, b, aws, bws, state } */
const calls = new Map();
const pending = new Map(); // family key -> { callId, from, name, kind, at } (rings when the guest opens their page)
let onConnect = () => [];
/** Registers a function that returns events to replay to a user who just connected (e.g. active incidents). */
export const setInboxHook = fn => { onConnect = fn; };
export const online = key => (peers.get(key)?.size ?? 0) > 0;
export const onlineUser = uid => online(`u:${uid}`);
/** Sends an event to every open socket of a peer. Returns how many received it. */
export function notify(key, msg) { let n = 0; for (const w of peers.get(key) ?? []) { send(w, msg); n++; } return n; }
export const adminKeys = () => [...peers.entries()].filter(([k, set]) => k.startsWith('u:') && [...set].some(w => w.who?.admin)).map(([k]) => k);

const newId = () => randomBytes(6).toString('hex');
const nameOf = who => who.name ?? 'Someone';
const other = (c, key) => (c.a === key ? { key: c.b, ws: c.bws } : { key: c.a, ws: c.aws });

function allowed(who, to) {
  if (to === 'doctors') return !who.admin && who.role === 'inbox';                        // an astronaut rings the flight surgeons
  if (to.startsWith('f:')) { const f = db.prepare('SELECT user_id FROM family_contacts WHERE id = ?').get(Number(to.slice(2))); return who.role === 'inbox' && f?.user_id === who.uid; } // own family only
  if (to.startsWith('u:')) {
    const id = Number(to.slice(2));
    if (who.role === 'family') return id === who.uid;                                    // a family guest can only ring their astronaut
    if (who.admin) return true;                                                           // a surgeon can ring anyone
    return !!db.prepare('SELECT 1 FROM crew_members a JOIN crew_members b ON a.crew_id = b.crew_id WHERE a.user_id = ? AND b.user_id = ?').get(who.uid, id); // crew mates
  }
  return false;
}

function hub(ws, who) {
  ws.who = who; ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  if (!peers.has(who.key)) peers.set(who.key, new Set());
  peers.get(who.key).add(ws);
  send(ws, { type: 'hello', key: who.key });
  for (const ev of onConnect(who) ?? []) send(ws, ev);
  const waiting = pending.get(who.key); if (waiting && Date.now() - waiting.at < 180e3) send(ws, { type: 'incoming', callId: waiting.callId, from: waiting.from, fromName: waiting.name, kind: waiting.kind });

  ws.on('message', raw => {
    let m; try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    if (m.type === 'call') {
      let to = String(m.to ?? ''); if (who.role === 'family' && to === 'owner') to = `u:${who.uid}`; // a family guest simply rings "their astronaut"
      const kind = ['doctor', 'family', 'crew'].includes(m.kind) ? m.kind : 'family';
      if (!allowed(who, to)) return send(ws, { type: 'unavailable', reason: 'not-allowed' });
      const c = { id: newId(), kind, a: who.key, b: to, aws: ws, bws: null, state: 'ringing' }; calls.set(c.id, c);
      const targets = to === 'doctors' ? adminKeys() : [to];
      let n = 0; for (const k of targets) n += notify(k, { type: 'incoming', callId: c.id, from: who.key, fromName: nameOf(who), kind, group: to === 'doctors' });
      if (!n) {
        if (to.startsWith('f:')) pending.set(to, { callId: c.id, from: who.key, name: nameOf(who), kind, at: Date.now() });
        else calls.delete(c.id);
        return send(ws, { type: 'unavailable', callId: c.id, reason: 'offline', pending: to.startsWith('f:') });
      }
      send(ws, { type: 'calling', callId: c.id });
      setTimeout(() => { const x = calls.get(c.id); if (x?.state === 'ringing') { calls.delete(c.id); send(x.aws, { type: 'ended', callId: c.id, reason: 'no-answer' }); for (const k of targets) notify(k, { type: 'ended', callId: c.id, reason: 'missed' }); } }, 45e3).unref?.();
    } else if (m.type === 'accept') {
      const c = calls.get(String(m.callId)); if (!c || c.state !== 'ringing') return send(ws, { type: 'ended', callId: m.callId, reason: 'gone' });
      c.state = 'active'; c.bws = ws; c.b = who.key; pending.delete(who.key);
      send(c.aws, { type: 'accepted', callId: c.id, by: who.key, byName: nameOf(who) });
      for (const k of adminKeys()) if (k !== who.key) notify(k, { type: 'ended', callId: c.id, reason: 'taken' }); // other surgeons stop ringing
    } else if (m.type === 'decline') {
      const c = calls.get(String(m.callId)); if (!c || c.state !== 'ringing') return;
      if (c.b === 'doctors') return; // one surgeon declining does not end the group call
      calls.delete(c.id); send(c.aws, { type: 'ended', callId: c.id, reason: 'declined' });
    } else if (m.type === 'signal') {
      const c = calls.get(String(m.callId)); if (!c || c.state !== 'active') return;
      const o = c.aws === ws ? c.bws : c.aws; send(o, { type: 'signal', callId: c.id, data: m.data });
    } else if (m.type === 'end') {
      const c = calls.get(String(m.callId)); if (!c) return;
      calls.delete(c.id); const o = c.aws === ws ? c.bws : c.aws; send(o, { type: 'ended', callId: c.id, reason: 'hangup' });
      if (c.state === 'ringing') for (const k of c.b === 'doctors' ? adminKeys() : [c.b]) notify(k, { type: 'ended', callId: c.id, reason: 'cancelled' });
    }
  });
  ws.on('close', () => {
    const set = peers.get(who.key); set?.delete(ws); if (set && !set.size) peers.delete(who.key);
    for (const [id, c] of calls) if (c.aws === ws || c.bws === ws) { calls.delete(id); send(c.aws === ws ? c.bws : c.aws, { type: 'ended', callId: id, reason: 'disconnected' }); }
  });
}
