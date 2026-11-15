/**
 * Flight-surgeon console API: see every astronaut's progress and plan, and send a ready-made plan.
 *
 *  GET    /api/admin/crew                list astronauts with progress
 *  GET    /api/admin/crew/:id            one astronaut: metrics, alerts, server plan, device snapshot, current override
 *  PUT    /api/admin/crew/:id/override   send / replace the plan override (message, targets, weekly schedule, tasks)
 *  DELETE /api/admin/crew/:id/override   withdraw it
 *  GET    /api/me/override               the astronaut reads the plan sent to them
 *  PUT    /api/me/snapshot               the astronaut's app reports its own progress (body numbers, radiation, stress…)
 *
 * Admin = role 'surgeon', or an email listed in ADMIN_EMAILS. Prototype note: any admin can see every crew member.
 * A real deployment must assign astronauts to surgeons and record consent for that sharing.
 */
import { db } from './db.js';
import { requireAuth, publicUser } from './auth.js';
import { isAdmin, requireAdmin } from './roles.js';
import { readBackground, readNotes, listFiles } from './background.js';
import { mealEventsFor } from './cam.js';
import { dashboard, adaptivePlan } from './health/engine.js';

db.exec(`
CREATE TABLE IF NOT EXISTS plan_overrides (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS handoffs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  mission_day INTEGER,
  lines TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 0,
  queued_at INTEGER,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  ack_at TEXT,
  ack_by INTEGER,
  ack_note TEXT,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS snapshots (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
export { isAdmin, requireAdmin };

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);

/** Validates and normalises an override. Returns { value } or { error }. */
export function cleanOverride(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing plan.' };
  const out = {};
  if (b.message != null) out.message = str(b.message, 600);
  if (b.resistancePerWeek != null) { const n = Number(b.resistancePerWeek); if (!Number.isInteger(n) || n < 1 || n > 7) return { error: 'Resistance sessions per week must be 1 to 7.' }; out.resistancePerWeek = n; }
  if (b.zone2Minutes != null) { const n = Number(b.zone2Minutes); if (!Number.isFinite(n) || n < 30 || n > 420) return { error: 'Zone 2 minutes must be 30 to 420.' }; out.zone2Minutes = Math.round(n); }
  if (b.intensity != null) { if (!['light', 'normal', 'push'].includes(b.intensity)) return { error: 'Intensity must be light, normal or push.' }; out.intensity = b.intensity; }
  if (b.week != null) {
    if (typeof b.week !== 'object') return { error: 'Week must be an object.' };
    out.week = {};
    for (const d of DAYS) {
      const list = Array.isArray(b.week[d]) ? b.week[d] : [];
      if (list.length > 3) return { error: 'At most 3 sessions per day.' };
      if (list.some(x => !ID.test(String(x)))) return { error: 'Invalid session id.' };
      out.week[d] = list.map(String);
    }
  }
  if (b.tasks != null) {
    if (!Array.isArray(b.tasks) || b.tasks.length > 8) return { error: 'At most 8 tasks.' };
    out.tasks = b.tasks.map(t => ({ title: str(t?.title, 80), detail: str(t?.detail, 300) })).filter(t => t.title);
  }
  return { value: out };
}

const readOverride = id => {
  const r = db.prepare('SELECT data, updated_by, updated_at FROM plan_overrides WHERE user_id = ?').get(id);
  return r ? { ...JSON.parse(r.data), updatedAt: r.updated_at, updatedBy: r.updated_by } : null;
};
const readSnapshot = id => {
  const r = db.prepare('SELECT data, updated_at FROM snapshots WHERE user_id = ?').get(id);
  return r ? { ...JSON.parse(r.data), updatedAt: r.updated_at } : null;
};
const crewRows = () => db.prepare("SELECT * FROM users WHERE role IN ('astronaut','analog') ORDER BY name").all();
const slim = s => ({ key: s.key, label: s.label, unit: s.unit, value: s.value, value2: s.value2, status: s.status, deviation: s.deviation, baseline: s.baseline, recordedAt: s.recordedAt, stale: s.stale, source: s.source, spark: s.spark });

const HID = /^[A-Za-z0-9_-]{4,40}$/;
const handoffRow = r => ({ id: r.id, userId: r.user_id, name: r.name, title: r.title, reason: r.reason, missionDay: r.mission_day, lines: JSON.parse(r.lines), queuedAt: r.queued_at, receivedAt: r.received_at, ackAt: r.ack_at, ackNote: r.ack_note });
const handoffsOf = uid => db.prepare('SELECT h.*, u.name FROM handoffs h JOIN users u ON u.id = h.user_id WHERE h.user_id = ? ORDER BY h.received_at DESC, h.rowid DESC LIMIT 30').all(uid).map(handoffRow);
const openHandoffs = uid => db.prepare('SELECT COUNT(*) AS n FROM handoffs WHERE user_id = ? AND ack_at IS NULL').get(uid).n;

export function mountAdmin(app) {
  // ---- medical handoff: the astronaut's queued report reaches the flight surgeon console ----
  app.put('/api/me/handoffs/:id', requireAuth, (req, res) => {
    if (!HID.test(req.params.id)) return bad(res, 'Invalid report id.');
    const b = req.body ?? {};
    const lines = Array.isArray(b.lines) ? b.lines.slice(0, 20).map(l => ({ h: str(l?.h, 80), t: str(l?.t, 1200) })).filter(l => l.h) : [];
    const title = str(b.title, 120), reason = str(b.reason, 300);
    if (!title || !reason || !lines.length) return bad(res, 'A report needs a title, a reason and lines.');
    if (b.synthetic) return bad(res, 'Synthetic scenario reports are not sent.', 422);
    const day = Number.isInteger(b.missionDay) ? b.missionDay : null, q = Number.isFinite(Number(b.queuedAt)) ? Math.round(Number(b.queuedAt)) : Date.now();
    db.prepare(`INSERT INTO handoffs (user_id, id, title, reason, mission_day, lines, queued_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(user_id, id) DO NOTHING`).run(req.user.id, req.params.id, title, reason, day, JSON.stringify(lines), q); // a re-send never resets an acknowledgement
    res.json({ ok: true });
  });
  app.get('/api/me/handoffs', requireAuth, (req, res) => res.json({ handoffs: db.prepare('SELECT id, ack_at AS ackAt, ack_note AS ackNote FROM handoffs WHERE user_id = ?').all(req.user.id) }));
  app.get('/api/admin/handoffs', requireAdmin, (_req, res) => {
    const rows = db.prepare("SELECT h.*, u.name FROM handoffs h JOIN users u ON u.id = h.user_id ORDER BY (h.ack_at IS NULL) DESC, h.received_at DESC, h.rowid DESC LIMIT 100").all().map(handoffRow);
    res.json({ handoffs: rows, open: rows.filter(r => !r.ackAt).length });
  });
  app.post('/api/admin/handoffs/:uid/:id/ack', requireAdmin, (req, res) => {
    const r = db.prepare('SELECT 1 FROM handoffs WHERE user_id = ? AND id = ?').get(Number(req.params.uid), req.params.id);
    if (!r) return bad(res, 'Report not found.', 404);
    db.prepare("UPDATE handoffs SET ack_at = datetime('now'), ack_by = ?, ack_note = ? WHERE user_id = ? AND id = ? AND ack_at IS NULL").run(req.user.id, str(req.body?.note, 400) || null, Number(req.params.uid), req.params.id);
    res.json({ ok: true });
  });

  app.get('/api/admin/crew', requireAdmin, (_req, res) => {
    res.json({
      crew: crewRows().map(u => {
        const d = dashboard(u.id), p = adaptivePlan(u.id), snap = readSnapshot(u.id), ov = readOverride(u.id);
        return {
          openHandoffs: openHandoffs(u.id),
          ...publicUser(u), readiness: d.readiness, checkedInToday: d.checkedInToday,
          alerts: { red: d.alerts.filter(a => a.level === 'red').length, amber: d.alerts.filter(a => a.level === 'amber').length },
          cameraMeals: mealEventsFor(u.id, 1).filter(e => e.day === new Date().toISOString().slice(0, 10)).map(e => e.slot),
          conditionsCount: readBackground(u.id)?.conditions?.length ?? 0, planProgress: p.progress, hasOverride: !!ov, overrideAt: ov?.updatedAt ?? null,
          snapshot: snap ? { updatedAt: snap.updatedAt, meals: snap.mealsToday ?? null, stress: snap.stress ?? null, sessionsThisWeek: snap.sessionsThisWeek ?? null, radiation: snap.radiation ?? null } : null,
        };
      }),
    });
  });

  app.get('/api/admin/crew/:id', requireAdmin, (req, res) => {
    const u = db.prepare("SELECT * FROM users WHERE id = ? AND role IN ('astronaut','analog')").get(Number(req.params.id));
    if (!u) return bad(res, 'Crew member not found.', 404);
    const d = dashboard(u.id);
    res.json({
      user: publicUser(u), readiness: d.readiness, alerts: d.alerts, systems: d.systems, checkedInToday: d.checkedInToday, checkin: d.checkin,
      metrics: Object.fromEntries(['recovery', 'sleep', 'hrv', 'rhr', 'strain', 'exercise', 'mood', 'weight', 'radiation'].filter(k => d.metrics[k]).map(k => [k, slim(d.metrics[k])])),
      plan: adaptivePlan(u.id), override: readOverride(u.id), snapshot: readSnapshot(u.id),
      background: readBackground(u.id), adminNotes: readNotes(u.id), files: listFiles(u.id), mealEvents: mealEventsFor(u.id, 3), handoffs: handoffsOf(u.id),
    });
  });

  app.put('/api/admin/crew/:id/override', requireAdmin, (req, res) => {
    const u = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('astronaut','analog')").get(Number(req.params.id));
    if (!u) return bad(res, 'Crew member not found.', 404);
    const { value, error } = cleanOverride(req.body);
    if (error) return bad(res, error);
    db.prepare("INSERT INTO plan_overrides (user_id, data, updated_by, updated_at) VALUES (?,?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at")
      .run(u.id, JSON.stringify(value), req.user.id);
    res.json({ ok: true, override: readOverride(u.id) });
  });

  app.delete('/api/admin/crew/:id/override', requireAdmin, (req, res) => {
    db.prepare('DELETE FROM plan_overrides WHERE user_id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/me/override', requireAuth, (req, res) => res.json({ override: readOverride(req.user.id) }));

  app.put('/api/me/snapshot', requireAuth, (req, res) => {
    const raw = JSON.stringify(req.body ?? {});
    if (raw.length > 16000) return bad(res, 'Snapshot too large.', 413);
    db.prepare("INSERT INTO snapshots (user_id, data, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").run(req.user.id, raw);
    res.json({ ok: true });
  });
}
