/**
 * Face sign-in and identification. All face MATHEMATICS runs in the browser (open-source face-api models, see mobile/public/models);
 * the server only stores each person's 128-number face descriptors (not photos) and compares them.
 *
 *  - Sign-in is 1:1: the person types their email, then a live face check (with a head-turn liveness challenge on the client)
 *    must match THAT account. Rate limited. It is a convenience for a demo, not bank-grade biometrics.
 *  - The camera station identifies who is in front of the camera among the crew (demo only, needs CAMERA_STATION=on).
 *  - Enrolment needs explicit consent; the descriptors can be deleted any time and are removed with the account.
 */
import { db } from './db.js';
import { requireAuth, rateLimit } from './auth.js';

db.exec(`CREATE TABLE IF NOT EXISTS face_templates (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  descriptors TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const okVec = v => Array.isArray(v) && v.length === 128 && v.every(x => Number.isFinite(x) && Math.abs(x) < 5);
export const dist = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
/** Smallest distance between a probe and any stored descriptor. */
export const bestDistance = (probe, stored) => Math.min(...stored.map(d => dist(probe, d)));
export const LOGIN_MAX = 0.45;      // stricter than the library's usual 0.6
export const IDENTIFY_MAX = 0.52;
const load = uid => { const r = db.prepare('SELECT descriptors FROM face_templates WHERE user_id = ?').get(uid); return r ? JSON.parse(r.descriptors) : null; };

/** Who is this among the given user ids? Needs a clear winner. Returns { id, distance } or null. */
export function identify(probe, ids) {
  const scored = ids.map(id => ({ id, d: load(id) })).filter(x => x.d).map(x => ({ id: x.id, distance: bestDistance(probe, x.d) })).sort((a, b) => a.distance - b.distance);
  if (!scored.length || scored[0].distance > IDENTIFY_MAX) return null;
  if (scored[1] && scored[1].distance - scored[0].distance < 0.04) return null; // too close to call: do not guess
  return scored[0];
}

export function mountFace(app, authResponse) {
  app.get('/api/me/face', requireAuth, (req, res) => { const d = load(req.user.id); res.json({ enrolled: !!d, samples: d?.length ?? 0 }); });
  app.put('/api/me/face', requireAuth, (req, res) => {
    if (req.body?.consent !== true) return bad(res, 'Confirm that you agree to your face being used to recognise you.');
    const d = req.body?.descriptors;
    if (!Array.isArray(d) || d.length < 3 || d.length > 10 || !d.every(okVec)) return bad(res, 'Scan your face again (3 to 10 good samples needed).');
    db.prepare("INSERT INTO face_templates (user_id, descriptors, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET descriptors = excluded.descriptors, updated_at = excluded.updated_at").run(req.user.id, JSON.stringify(d));
    res.json({ ok: true, samples: d.length });
  });
  app.delete('/api/me/face', requireAuth, (req, res) => { db.prepare('DELETE FROM face_templates WHERE user_id = ?').run(req.user.id); res.json({ ok: true }); });

  app.post('/api/auth/face/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase(), probe = req.body?.descriptor;
    if (!rateLimit(`facelogin:${req.ip}:${email}`, 6, 10 * 60e3)) return bad(res, 'Too many face attempts. Use your email code instead.', 429);
    if (!okVec(probe) || req.body?.live !== true) return bad(res, 'Look at the camera and follow the head-turn step.');
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const stored = u ? load(u.id) : null;
    if (!stored || bestDistance(probe, stored) > LOGIN_MAX) return bad(res, 'Your face did not match this account. Use your email code instead.', 401); // same answer whether or not the account exists
    authResponse(req, res, u);
  });
  app.get('/api/auth/face/available', (req, res) => { // does this email have a face enrolled? (so the login page can offer the button; reveals only a yes/no)
    const email = String(req.query.email ?? '').trim().toLowerCase();
    if (!rateLimit(`faceavail:${req.ip}`, 30, 10 * 60e3)) return bad(res, 'Too many requests.', 429);
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    res.json({ available: !!(u && load(u.id)) });
  });
}
