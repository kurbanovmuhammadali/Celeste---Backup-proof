/**
 * Remote camera for the flight surgeon: a phone on a SEPARATE device sends still frames, the surgeon watches.
 *
 *  - Each astronaut has one secret camera link  /cam/<token>  (24 random bytes). Whoever has the link can send frames
 *    for that astronaut only. The link can be rotated, which kills the old one.
 *  - The phone page posts a JPEG frame about every second. The server keeps ONLY the latest frame, in memory, for a few
 *    seconds. Nothing is written to disk and nothing is recorded.
 *  - Only a signed-in surgeon can read the frame. The astronaut sees when the camera is live and when a surgeon is watching.
 *  - Frame relay (not WebRTC) so it works through any network with no STUN/TURN setup; roughly 1 frame per second.
 *
 *  Public (token):  GET /api/cam/:token/info · POST /api/cam/:token/frame · POST /api/cam/:token/stop
 *  Astronaut:       POST /api/me/cam-link · GET /api/me/cam-status
 *  Surgeon:         GET/POST /api/admin/crew/:id/cam(-link) · GET /api/admin/crew/:id/cam/frame.jpg
 */
import { randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { db } from './db.js';
import { requireAuth, rateLimit, sessionUser } from './auth.js';
import { requireAdmin, isAdmin } from './roles.js';
import { rtcState } from './rtc.js';
import { raiseIncident, INCIDENT_KINDS, crewMateIds } from './team.js';
import { identify } from './face.js';

db.exec(`
CREATE TABLE IF NOT EXISTS cam_links (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activity_reports (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, from_ms INTEGER NOT NULL, to_ms INTEGER NOT NULL,
  summary TEXT NOT NULL, segments TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS meal_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  bites INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  UNIQUE (user_id, day, slot)
);`);

const LIVE_MS = 8000, VIEW_MS = 6000, MAX_FRAME = 200 * 1024;
/** userId -> { buf, at, viewedAt } (memory only) */
const frames = new Map();
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

const tokenOf = uid => db.prepare('SELECT token FROM cam_links WHERE user_id = ?').get(uid)?.token ?? null;
function ensureToken(uid, rotate = false) {
  let t = tokenOf(uid);
  if (!t || rotate) {
    t = randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO cam_links (user_id, token) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET token = excluded.token, created_at = datetime(\'now\')').run(uid, t);
    frames.delete(uid); // a rotated link ends any live camera
  }
  return t;
}
const owner = t => (TOKEN.test(String(t)) ? db.prepare('SELECT u.id, u.name FROM cam_links c JOIN users u ON u.id = c.user_id WHERE c.token = ?').get(String(t)) : null);
const fresh = uid => { const f = frames.get(uid); return f && Date.now() - f.at < LIVE_MS ? f : null; };
const viewing = uid => { const f = frames.get(uid); return !!f && !!f.viewedAt && Date.now() - f.viewedAt < VIEW_MS; };
const status = uid => { const r = rtcState(uid); return { hasLink: !!tokenOf(uid), live: !!fresh(uid) || r.live, viewing: (!!fresh(uid) && viewing(uid)) || r.viewers > 0, rtc: r.live, lastFrameAt: frames.get(uid)?.at ?? null }; };
/** Meal slot from minutes since local midnight (same rule as the app). */
export const slotFromMinutes = m => (m < 630 ? 'breakfast' : m < 930 ? 'lunch' : m < 1260 ? 'dinner' : 'snack');
/** Camera-detected meals (precooked food: the camera only checks whether the astronaut ate). */
export const mealEventsFor = (uid, days = 3) => db.prepare('SELECT day, slot, bites, started_at AS startedAt, ended_at AS endedAt FROM meal_events WHERE user_id = ? AND day >= ? ORDER BY started_at DESC')
  .all(uid, new Date(Date.now() - days * 864e5).toISOString().slice(0, 10));
const lan = () => Object.values(networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

export function mountCam(app, port) {
  const isCrew = id => !!db.prepare("SELECT 1 FROM users WHERE id = ? AND role IN ('astronaut','analog')").get(id);
  // The camera station (/camera): a phone or laptop that films crew members. Locally (CAMERA_STATION=on, not production) it
  // needs no sign-in for demos. In production it needs a signed-in account: a flight surgeon may film anyone, a crew member
  // only themselves and their own crew mates.
  const demoStation = () => process.env.CAMERA_STATION === 'on' && process.env.NODE_ENV !== 'production';
    const stationOn = req => demoStation() || !!sessionUser(req);
  /** ids this request may film / identify (null = everyone, demo mode only). */
  const stationIds = req => {
    if (demoStation()) return null;
    const u = sessionUser(req)?.user; if (!u) return [];
    if (isAdmin(u)) return db.prepare("SELECT id FROM users WHERE role IN ('astronaut','analog')").all().map(r => r.id);
    return [u.id, ...crewMateIds(u.id)];
  };

  /** Frame / meal handlers shared by the private-link route and the station route. `who(req)` returns { id, name } or null. */
  const mount = (prefix, who, notFound, keyOf) => {
    app.get(prefix + '/info', (req, res) => {
      const o = who(req);
      if (!o) return bad(res, notFound, 404);
      res.json({ ok: true, name: String(o.name).split(' ')[0], viewing: viewing(o.id) && !!fresh(o.id) });
    });
    app.post(prefix + '/frame', (req, res) => {
      const o = who(req);
      if (!o) return bad(res, notFound, 404);
      if (!rateLimit(`camf:${keyOf(req)}`, 240, 60e3)) return bad(res, 'Too many frames.', 429);
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image ?? ''));
      if (!m) return bad(res, 'Send a JPEG frame.');
      const buf = Buffer.from(m[1], 'base64');
      if (buf.length < 4 || buf.length > MAX_FRAME) return bad(res, 'Frame too large.', 413);
      if (buf[0] !== 0xff || buf[1] !== 0xd8) return bad(res, 'That is not a JPEG.');
      const prev = frames.get(o.id);
      frames.set(o.id, { buf, at: Date.now(), viewedAt: prev?.viewedAt ?? 0 });
      res.json({ ok: true, viewing: viewing(o.id) });
    });
    app.post(prefix + '/stop', (req, res) => {
      const o = who(req);
      if (o) frames.delete(o.id);
      res.json({ ok: true });
    });
    // the camera's local AI saw a possible emergency: alert every flight surgeon and every crew mate at once
    app.post(prefix + '/incident', (req, res) => {
      const o = who(req);
      if (!o) return bad(res, notFound, 404);
      if (!rateLimit(`caminc:${keyOf(req)}`, 12, 3600e3)) return bad(res, 'Too many alerts from this camera.', 429);
      const kind = String(req.body?.kind ?? '');
      if (!INCIDENT_KINDS[kind] || kind === 'manual') return bad(res, 'Unknown incident kind.');
      const conf = Number(req.body?.confidence);
      res.json({ ok: true, incident: raiseIncident(o.id, { kind, severity: kind === 'distress' ? 'high' : 'critical', confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : null, evidence: req.body?.evidence, source: 'camera' }) });
    });
    // a plain-language summary of what the camera saw (made on the camera device by a local model; no video leaves it)
    app.post(prefix + '/activity', (req, res) => {
      const o = who(req);
      if (!o) return bad(res, notFound, 404);
      if (!rateLimit(`camact:${keyOf(req)}`, 60, 3600e3)) return bad(res, 'Too many activity reports.', 429);
      const segs = (Array.isArray(req.body?.segments) ? req.body.segments : []).slice(0, 60).map(s => ({ state: String(s?.state ?? '').slice(0, 20), label: String(s?.label ?? '').slice(0, 80), from: Number(s?.from) || 0, to: Number(s?.to) || 0, detail: String(s?.detail ?? '').slice(0, 120) }));
      const summary = String(req.body?.summary ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, 1500);
      if (!segs.length || !summary) return bad(res, 'Nothing to report.');
      db.prepare('INSERT INTO activity_reports (user_id, from_ms, to_ms, summary, segments) VALUES (?,?,?,?,?)').run(o.id, Math.round(Number(req.body?.from) || Date.now()), Math.round(Number(req.body?.to) || Date.now()), summary, JSON.stringify(segs));
      res.json({ ok: true });
    });
    app.post(prefix + '/meal', (req, res) => {
      const o = who(req);
      if (!o) return bad(res, notFound, 404);
      if (!rateLimit(`camm:${keyOf(req)}`, 40, 3600e3)) return bad(res, 'Too many meal reports.', 429);
      const { kind, bites, start, end, localMinutes } = req.body ?? {};
      const b = Number(bites), st = Number(start), en = Number(end);
      if (!['meal', 'end'].includes(kind) || !Number.isInteger(b) || b < 1 || b > 300 || !Number.isFinite(st) || !Number.isFinite(en)) return bad(res, 'Invalid meal report.');
      if (Math.abs(Date.now() - en) > 6 * 3600e3) return bad(res, 'That report is too old.');
      const lm = Number(localMinutes);
      const d = new Date(st);
      const slot = slotFromMinutes(Number.isFinite(lm) && lm >= 0 && lm < 1440 ? lm : d.getUTCHours() * 60 + d.getUTCMinutes());
      db.prepare(`INSERT INTO meal_events (user_id, day, slot, bites, started_at, ended_at) VALUES (?,?,?,?,?,?)
        ON CONFLICT(user_id, day, slot) DO UPDATE SET bites = MAX(bites, excluded.bites), ended_at = MAX(ended_at, excluded.ended_at)`)
        .run(o.id, d.toISOString().slice(0, 10), slot, b, Math.round(st), Math.round(en));
      res.json({ ok: true, slot });
    });
  };
  mount('/api/cam/:token', req => owner(req.params.token), 'This camera link is not valid.', req => req.params.token);
  mount('/api/station/:id', req => {
    const id = Number(req.params.id);
    const ids = stationIds(req); return stationOn(req) && isCrew(id) && (ids === null || ids.includes(id)) ? db.prepare('SELECT id, name FROM users WHERE id = ?').get(id) : null;
  }, 'Sign in first. The camera station only films you and your crew (doctors: anyone), and it must be switched on for demos.', req => `st${req.params.id}:${req.ip}`);
  // who is in front of the camera? (probe = 128-number face descriptor computed in the browser)
  app.post('/api/station/identify', (req, res) => {
    if (!stationOn(req)) return bad(res, 'Sign in to use the camera station.', 401);
    if (!rateLimit(`stid:${req.ip}`, 600, 60e3)) return bad(res, 'Too many requests.', 429);
    const p = req.body?.descriptor;
    if (!Array.isArray(p) || p.length !== 128 || !p.every(Number.isFinite)) return bad(res, 'Bad face descriptor.');
    const ids = stationIds(req) ?? db.prepare("SELECT id FROM users WHERE role IN ('astronaut','analog')").all().map(r => r.id);
    const hit = identify(p, ids);
    res.json(hit ? { id: hit.id, name: db.prepare('SELECT name FROM users WHERE id = ?').get(hit.id).name, distance: +hit.distance.toFixed(3) } : { id: null });
  });
  app.get('/api/station/crew', (req, res) => {
    if (!stationOn(req)) return bad(res, 'Sign in to use the camera station.', 401);
    const ids = stationIds(req);
    const all = db.prepare("SELECT id, name, mission FROM users WHERE role IN ('astronaut','analog') ORDER BY name").all();
    res.json({ crew: ids === null ? all : all.filter(c => ids.includes(c.id)) });
  });

  // ---- the astronaut ----
  app.get('/api/me/meal-events', requireAuth, (req, res) => res.json({ events: mealEventsFor(req.user.id, 2) }));
  app.post('/api/me/cam-link', requireAuth, (req, res) => res.json({ token: ensureToken(req.user.id, !!req.body?.rotate) }));
  app.get('/api/me/cam-status', requireAuth, (req, res) => res.json({ ...status(req.user.id), token: tokenOf(req.user.id), lan: lan(), port }));

  // ---- the surgeon ----
  const crewId = req => Number(req.params.id);
  app.get('/api/admin/crew/:id/cam', requireAdmin, (req, res) => {
    const id = crewId(req);
    if (!isCrew(id)) return bad(res, 'Crew member not found.', 404);
    res.json({ ...status(id), token: tokenOf(id), lan: lan(), port });
  });
  app.post('/api/admin/crew/:id/cam-link', requireAdmin, (req, res) => {
    const id = crewId(req);
    if (!isCrew(id)) return bad(res, 'Crew member not found.', 404);
    res.json({ token: ensureToken(id, !!req.body?.rotate) });
  });
  app.get('/api/admin/crew/:id/activity', requireAdmin, (req, res) => {
    const id = crewId(req);
    if (!isCrew(id)) return bad(res, 'Crew member not found.', 404);
    res.json({ reports: db.prepare('SELECT id, from_ms AS fromMs, to_ms AS toMs, summary, segments, created_at AS at FROM activity_reports WHERE user_id = ? ORDER BY id DESC LIMIT 20').all(id).map(r => ({ ...r, segments: JSON.parse(r.segments) })) });
  });
  app.get('/api/admin/crew/:id/cam/frame.jpg', requireAdmin, (req, res) => {
    const id = crewId(req);
    const f = fresh(id);
    if (!f) return bad(res, 'The camera is not live.', 404);
    f.viewedAt = Date.now();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.send(f.buf);
  });
}
