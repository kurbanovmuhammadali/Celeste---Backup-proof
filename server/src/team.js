/**
 * Crews, anonymous peer reports, crew pulse, family contacts and emergency alerts.
 *
 *  Crew        create or join with a code; members share the mission briefing and see each other's names.
 *              Health data is NOT shared with crew mates, only flight surgeons see it.
 *  Peer report an anonymous concern about a crew mate. Only flight surgeons read it; the reporter is stored as a salted hash so
 *              spam can be limited but nobody (not even a surgeon in the UI) sees who wrote it.
 *  Pulse       each member can add an anonymous daily mood/stress number; the crew sees an average once 3+ people did.
 *  Family      an astronaut adds a family member and gets a private link (/family/<token>): the family member needs no account to call
 *              or leave a message.
 *  Alerts      the camera (or anyone) raises an incident; every flight surgeon and every crew mate is notified live, and
 *              unanswered incidents escalate.
 */
import { randomBytes, createHmac } from 'node:crypto';
import { db, tx } from './db.js';
import { requireAuth, rateLimit } from './auth.js';
import { requireAdmin, isAdmin } from './roles.js';
import { notify, onlineUser, online, setInboxHook, adminKeys } from './rtc.js';

db.exec(`
CREATE TABLE IF NOT EXISTS crews (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, briefing TEXT, briefing_at TEXT,
  created_by INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS crew_members (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, crew_id INTEGER NOT NULL REFERENCES crews(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS peer_reports (
  id INTEGER PRIMARY KEY, crew_id INTEGER NOT NULL, about_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, message TEXT NOT NULL, tag TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS crew_pulse (crew_id INTEGER NOT NULL, day TEXT NOT NULL, tag TEXT NOT NULL, mood INTEGER NOT NULL, stress INTEGER NOT NULL, PRIMARY KEY (crew_id, day, tag));
CREATE TABLE IF NOT EXISTS crew_feed (id INTEGER PRIMARY KEY, crew_id INTEGER NOT NULL, user_id INTEGER, kind TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS family_contacts (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, relation TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS family_messages (
  id INTEGER PRIMARY KEY, contact_id INTEGER NOT NULL REFERENCES family_contacts(id) ON DELETE CASCADE, from_family INTEGER NOT NULL,
  text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, severity TEXT NOT NULL,
  confidence REAL, evidence TEXT, source TEXT NOT NULL DEFAULT 'camera', status TEXT NOT NULL DEFAULT 'active', escalated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT, resolved_by INTEGER, resolved_note TEXT
);
CREATE TABLE IF NOT EXISTS incident_acks (incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (incident_id, user_id));
`);

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const SECRET = process.env.SESSION_SECRET || process.env.APP_SECRET || 'hmsc-local-secret';
const tagOf = (uid, crewId) => createHmac('sha256', SECRET).update(`peer:${uid}:${crewId}`).digest('hex').slice(0, 16);
const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const today = () => new Date().toISOString().slice(0, 10);
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { const b = randomBytes(6); return [...b].map(x => ALPHABET[x % ALPHABET.length]).join('').replace(/(.{3})(.{3})/, '$1-$2'); };
const first = n => String(n).split(' ')[0];

const membership = uid => db.prepare('SELECT m.crew_id AS crewId, m.role, c.name, c.code, c.briefing, c.briefing_at AS briefingAt FROM crew_members m JOIN crews c ON c.id = m.crew_id WHERE m.user_id = ?').get(uid);
export const crewMateIds = uid => { const m = membership(uid); return m ? db.prepare('SELECT user_id FROM crew_members WHERE crew_id = ? AND user_id != ?').all(m.crewId, uid).map(r => r.user_id) : []; };
/** Every flight surgeon: role 'surgeon' or an email in ADMIN_EMAILS (so alerts reach admins made by email too). */
const adminIds = () => {
  const mails = (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return db.prepare(`SELECT id FROM users WHERE role = 'surgeon'${mails.length ? ` OR lower(email) IN (${mails.map(() => '?').join(',')})` : ''}`).all(...mails).map(r => r.id);
};

// ---------------------------------------------------------------- incidents
export const INCIDENT_KINDS = {
  collapse: 'Possible collapse or fall',
  unresponsive: 'Not moving after a fall: possibly unresponsive',
  seizure: 'Possible seizure (convulsive movement)',
  distress: 'Possible distress',
  manual: 'Emergency raised by hand',
};
const incidentView = r => ({ id: r.id, userId: r.user_id, name: r.name, kind: r.kind, label: INCIDENT_KINDS[r.kind] ?? r.kind, severity: r.severity, confidence: r.confidence, evidence: r.evidence, status: r.status, escalated: !!r.escalated, at: r.created_at, source: r.source });
const incidentRow = id => db.prepare('SELECT i.*, u.name FROM incidents i JOIN users u ON u.id = i.user_id WHERE i.id = ?').get(id);
/** Everyone who must hear about an incident of this person: all flight surgeons and all crew mates. */
const recipients = uid => [...new Set([...adminIds(), ...crewMateIds(uid)])];

/** Records an incident and alerts every flight surgeon and crew mate immediately. Returns the incident (or the recent duplicate). */
export function raiseIncident(uid, { kind, severity = 'critical', confidence = null, evidence = '', source = 'camera' }) {
  if (!INCIDENT_KINDS[kind]) throw Object.assign(new Error('Unknown incident kind'), { status: 400 });
  const dup = db.prepare("SELECT id FROM incidents WHERE user_id = ? AND kind = ? AND status = 'active' AND created_at > datetime('now','-90 seconds')").get(uid, kind);
  if (dup) return incidentView(incidentRow(dup.id));
  const { lastInsertRowid: id } = db.prepare('INSERT INTO incidents (user_id, kind, severity, confidence, evidence, source) VALUES (?,?,?,?,?,?)').run(uid, kind, severity === 'high' ? 'high' : 'critical', confidence, clip(evidence, 400), source);
  const inc = incidentView(incidentRow(id));
  for (const r of recipients(uid)) notify(`u:${r}`, { type: 'incident', incident: inc });
  notify(`u:${uid}`, { type: 'incident-self', incident: { id: inc.id, label: inc.label } }); // the person is told help has been alerted
  return inc;
}
const activeFor = user => {
  const rows = isAdmin(user) ? db.prepare("SELECT i.*, u.name FROM incidents i JOIN users u ON u.id = i.user_id WHERE i.status = 'active' ORDER BY i.id DESC LIMIT 20").all()
    : db.prepare(`SELECT i.*, u.name FROM incidents i JOIN users u ON u.id = i.user_id WHERE i.status = 'active' AND i.user_id IN (${[0, ...crewMateIds(user.id)].join(',')}) ORDER BY i.id DESC LIMIT 20`).all();
  return rows.map(incidentView);
};
setInboxHook(who => (who.role === 'inbox' ? activeFor({ id: who.uid, role: who.admin ? 'surgeon' : 'astronaut', email: '' }).map(i => ({ type: 'incident', incident: i, replay: true })) : []));

// escalate incidents nobody has taken within 45 s: alert everybody again, louder
const escalator = setInterval(() => {
  for (const r of db.prepare("SELECT id, user_id FROM incidents WHERE status = 'active' AND escalated = 0 AND created_at < datetime('now','-45 seconds') AND NOT EXISTS (SELECT 1 FROM incident_acks a WHERE a.incident_id = incidents.id AND a.kind = 'responding')").all()) {
    db.prepare('UPDATE incidents SET escalated = 1 WHERE id = ?').run(r.id);
    const inc = incidentView(incidentRow(r.id));
    for (const k of recipients(r.user_id)) notify(`u:${k}`, { type: 'incident', incident: inc, escalated: true });
  }
}, 10_000); escalator.unref();

export function mountTeam(app) {
  // ---------------------------------------------------------------- crew
  const crewView = uid => {
    const m = membership(uid); if (!m) return null;
    const members = db.prepare('SELECT u.id, u.name, cm.role FROM crew_members cm JOIN users u ON u.id = cm.user_id WHERE cm.crew_id = ? ORDER BY cm.role = \'commander\' DESC, u.name').all(m.crewId)
      .map(x => ({ id: x.id, name: x.name, role: x.role, online: onlineUser(x.id), you: x.id === uid }));
    const days = db.prepare("SELECT day, COUNT(*) n, AVG(mood) mood, AVG(stress) stress FROM crew_pulse WHERE crew_id = ? AND day >= date('now','-13 days') GROUP BY day ORDER BY day").all(m.crewId);
    const todayRow = days.find(d => d.day === today());
    const pulse = { todayCount: todayRow?.n ?? 0, enough: (todayRow?.n ?? 0) >= 3, mood: todayRow?.n >= 3 ? +todayRow.mood.toFixed(1) : null, stress: todayRow?.n >= 3 ? +todayRow.stress.toFixed(1) : null,
      history: days.filter(d => d.n >= 3).map(d => ({ day: d.day, mood: +d.mood.toFixed(1), stress: +d.stress.toFixed(1) })), mine: !!db.prepare('SELECT 1 FROM crew_pulse WHERE crew_id = ? AND day = ? AND tag = ?').get(m.crewId, today(), tagOf(uid, m.crewId)) };
    const feed = db.prepare('SELECT f.id, f.kind, f.text, f.created_at AS at, u.name FROM crew_feed f LEFT JOIN users u ON u.id = f.user_id WHERE f.crew_id = ? ORDER BY f.id DESC LIMIT 25').all(m.crewId).map(f => ({ ...f, name: f.name ? first(f.name) : null }));
    return { id: m.crewId, name: m.name, code: m.code, role: m.role, briefing: m.briefing ? JSON.parse(m.briefing) : null, briefingAt: m.briefingAt, members, pulse, feed };
  };
  app.get('/api/crew', requireAuth, (req, res) => res.json({ crew: crewView(req.user.id) }));
  app.post('/api/crew', requireAuth, (req, res) => {
    if (membership(req.user.id)) return bad(res, 'You are already in a crew. Leave it first.', 409);
    const name = clip(req.body?.name, 40); if (name.length < 2) return bad(res, 'Give your crew a name (2 to 40 characters).');
    if (!rateLimit(`crewnew:${req.user.id}`, 5, 3600e3)) return bad(res, 'Too many crews created. Try later.', 429);
    let code = newCode(); while (db.prepare('SELECT 1 FROM crews WHERE code = ?').get(code)) code = newCode();
    tx(() => { const { lastInsertRowid: id } = db.prepare('INSERT INTO crews (name, code, created_by) VALUES (?,?,?)').run(name, code, req.user.id); db.prepare("INSERT INTO crew_members (user_id, crew_id, role) VALUES (?,?,'commander')").run(req.user.id, id); });
    res.json({ crew: crewView(req.user.id) });
  });
  app.post('/api/crew/join', requireAuth, (req, res) => {
    if (!rateLimit(`crewjoin:${req.user.id}`, 10, 900e3)) return bad(res, 'Too many attempts. Wait a few minutes.', 429);
    if (membership(req.user.id)) return bad(res, 'You are already in a crew. Leave it first.', 409);
    const code = clip(req.body?.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{3})(.{3})$/, '$1-$2');
    const c = db.prepare('SELECT id FROM crews WHERE code = ?').get(code);
    if (!c) return bad(res, 'No crew has that code. Check it with your commander.', 404);
    if (db.prepare('SELECT COUNT(*) n FROM crew_members WHERE crew_id = ?').get(c.id).n >= 12) return bad(res, 'This crew is full (12 members).', 409);
    db.prepare("INSERT INTO crew_members (user_id, crew_id, role) VALUES (?,?,'member')").run(req.user.id, c.id);
    db.prepare("INSERT INTO crew_feed (crew_id, user_id, kind, text) VALUES (?,?,'join',?)").run(c.id, req.user.id, `${first(req.user.name)} joined the crew`);
    res.json({ crew: crewView(req.user.id) });
  });
  app.post('/api/crew/leave', requireAuth, (req, res) => {
    const m = membership(req.user.id); if (!m) return res.json({ ok: true });
    tx(() => {
      db.prepare('DELETE FROM crew_members WHERE user_id = ?').run(req.user.id);
      const left = db.prepare('SELECT user_id FROM crew_members WHERE crew_id = ? ORDER BY joined_at LIMIT 1').get(m.crewId);
      if (!left) db.prepare('DELETE FROM crews WHERE id = ?').run(m.crewId);
      else if (m.role === 'commander') db.prepare("UPDATE crew_members SET role = 'commander' WHERE user_id = ?").run(left.user_id); // the longest-serving member takes over
    });
    res.json({ ok: true });
  });
  app.put('/api/crew/briefing', requireAuth, (req, res) => {
    const m = membership(req.user.id); if (!m) return bad(res, 'Join a crew first.', 404);
    if (m.role !== 'commander') return bad(res, 'Only the commander can set the shared mission.', 403);
    const raw = JSON.stringify(req.body?.briefing ?? null); if (raw.length > 4000 || raw === 'null') return bad(res, 'Invalid mission briefing.');
    db.prepare("UPDATE crews SET briefing = ?, briefing_at = datetime('now') WHERE id = ?").run(raw, m.crewId);
    db.prepare("INSERT INTO crew_feed (crew_id, user_id, kind, text) VALUES (?,?,'mission',?)").run(m.crewId, req.user.id, 'The commander updated the shared mission');
    res.json({ crew: crewView(req.user.id) });
  });
  app.post('/api/crew/feed', requireAuth, (req, res) => {
    const m = membership(req.user.id); if (!m) return bad(res, 'Join a crew first.', 404);
    const kind = req.body?.kind === 'announce' ? 'announce' : 'kudos';
    if (kind === 'announce' && m.role !== 'commander') return bad(res, 'Only the commander can post announcements.', 403);
    const text = clip(req.body?.text, 240); if (text.length < 2) return bad(res, 'Write something first.');
    if (!rateLimit(`feed:${req.user.id}`, 20, 3600e3)) return bad(res, 'Slow down a little.', 429);
    db.prepare('INSERT INTO crew_feed (crew_id, user_id, kind, text) VALUES (?,?,?,?)').run(m.crewId, req.user.id, kind, text);
    res.json({ crew: crewView(req.user.id) });
  });
  app.post('/api/crew/pulse', requireAuth, (req, res) => {
    const m = membership(req.user.id); if (!m) return bad(res, 'Join a crew first.', 404);
    const mood = Number(req.body?.mood), stress = Number(req.body?.stress);
    if (![mood, stress].every(v => Number.isInteger(v) && v >= 1 && v <= 5)) return bad(res, 'Mood and stress are 1 to 5.');
    db.prepare('INSERT INTO crew_pulse (crew_id, day, tag, mood, stress) VALUES (?,?,?,?,?) ON CONFLICT(crew_id, day, tag) DO UPDATE SET mood = excluded.mood, stress = excluded.stress').run(m.crewId, today(), tagOf(req.user.id, m.crewId), mood, stress);
    res.json({ crew: crewView(req.user.id) });
  });

  // ---------------------------------------------------------------- anonymous peer reports (read by flight surgeons only)
  const CATS = ['health', 'mood', 'fatigue', 'conflict', 'safety', 'other'];
  app.post('/api/crew/report', requireAuth, (req, res) => {
    const m = membership(req.user.id); if (!m) return bad(res, 'Join a crew first.', 404);
    const about = Number(req.body?.aboutId), category = CATS.includes(req.body?.category) ? req.body.category : 'other', message = clip(req.body?.message, 500);
    if (about === req.user.id) return bad(res, 'To ask for help for yourself, use the support button in the wellbeing check.');
    if (!db.prepare('SELECT 1 FROM crew_members WHERE user_id = ? AND crew_id = ?').get(about, m.crewId)) return bad(res, 'That person is not in your crew.', 404);
    if (message.length < 5) return bad(res, 'Describe what you noticed (at least 5 characters).');
    const tag = tagOf(req.user.id, m.crewId);
    if (db.prepare("SELECT COUNT(*) n FROM peer_reports WHERE tag = ? AND created_at > datetime('now','-1 day')").get(tag).n >= 6) return bad(res, 'You have sent several reports today. A surgeon will review them.', 429);
    db.prepare('INSERT INTO peer_reports (crew_id, about_user_id, category, message, tag) VALUES (?,?,?,?,?)').run(m.crewId, about, category, message, tag);
    if (category === 'safety' || category === 'health') for (const a of adminIds()) notify(`u:${a}`, { type: 'concern', category });
    res.json({ ok: true });
  });
  app.get('/api/admin/reports', requireAdmin, (_req, res) => {
    const rows = db.prepare(`SELECT r.id, r.category, r.message, r.status, r.created_at AS at, r.about_user_id AS aboutId, u.name AS about, c.name AS crew,
        (SELECT COUNT(DISTINCT tag) FROM peer_reports p WHERE p.about_user_id = r.about_user_id AND p.created_at > datetime('now','-14 days')) AS voices
      FROM peer_reports r JOIN users u ON u.id = r.about_user_id JOIN crews c ON c.id = r.crew_id ORDER BY (r.status = 'new') DESC, r.id DESC LIMIT 100`).all();
    res.json({ reports: rows, open: rows.filter(r => r.status === 'new').length });
  });
  app.post('/api/admin/reports/:id/seen', requireAdmin, (req, res) => { db.prepare("UPDATE peer_reports SET status = 'seen' WHERE id = ?").run(Number(req.params.id)); res.json({ ok: true }); });
  app.get('/api/admin/crews', requireAdmin, (_req, res) => res.json({ crews: db.prepare("SELECT c.id, c.name, c.code, (SELECT COUNT(*) FROM crew_members m WHERE m.crew_id = c.id) AS members FROM crews c ORDER BY c.name").all() }));

  // ---------------------------------------------------------------- family
  const famView = f => ({ id: f.id, name: f.name, relation: f.relation, token: f.token, online: online(`f:${f.id}`), unread: db.prepare('SELECT COUNT(*) n FROM family_messages WHERE contact_id = ? AND from_family = 1 AND id > COALESCE((SELECT last_read FROM family_read WHERE contact_id = ?), 0)').get(f.id, f.id).n });
  db.exec('CREATE TABLE IF NOT EXISTS family_read (contact_id INTEGER PRIMARY KEY, last_read INTEGER NOT NULL)');
  app.get('/api/me/family', requireAuth, (req, res) => res.json({ family: db.prepare('SELECT * FROM family_contacts WHERE user_id = ? ORDER BY id').all(req.user.id).map(famView) }));
  app.post('/api/me/family', requireAuth, (req, res) => {
    const name = clip(req.body?.name, 40); if (name.length < 2) return bad(res, 'Enter their name.');
    if (db.prepare('SELECT COUNT(*) n FROM family_contacts WHERE user_id = ?').get(req.user.id).n >= 12) return bad(res, 'You can add up to 12 family members.', 409);
    const { lastInsertRowid: id } = db.prepare('INSERT INTO family_contacts (user_id, name, relation, token) VALUES (?,?,?,?)').run(req.user.id, name, clip(req.body?.relation, 30), randomBytes(18).toString('base64url'));
    res.json({ contact: famView(db.prepare('SELECT * FROM family_contacts WHERE id = ?').get(id)) });
  });
  app.delete('/api/me/family/:id', requireAuth, (req, res) => { db.prepare('DELETE FROM family_contacts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id); res.json({ ok: true }); });
  app.get('/api/me/family/:id/messages', requireAuth, (req, res) => {
    const f = db.prepare('SELECT * FROM family_contacts WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id); if (!f) return bad(res, 'Not found.', 404);
    const msgs = db.prepare('SELECT id, from_family AS fromFamily, text, created_at AS at FROM family_messages WHERE contact_id = ? ORDER BY id DESC LIMIT 40').all(f.id).reverse();
    if (msgs.length) db.prepare('INSERT INTO family_read (contact_id, last_read) VALUES (?,?) ON CONFLICT(contact_id) DO UPDATE SET last_read = excluded.last_read').run(f.id, msgs[msgs.length - 1].id);
    res.json({ messages: msgs });
  });
  app.post('/api/me/family/:id/messages', requireAuth, (req, res) => {
    const f = db.prepare('SELECT * FROM family_contacts WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id); if (!f) return bad(res, 'Not found.', 404);
    const text = clip(req.body?.text, 500); if (!text) return bad(res, 'Write something first.');
    db.prepare('INSERT INTO family_messages (contact_id, from_family, text) VALUES (?,0,?)').run(f.id, text); notify(`f:${f.id}`, { type: 'message' });
    res.json({ ok: true });
  });
  // public (the link is the credential)
  const byToken = t => (/^[A-Za-z0-9_-]{20,64}$/.test(String(t)) ? db.prepare('SELECT f.*, u.name AS astro FROM family_contacts f JOIN users u ON u.id = f.user_id WHERE f.token = ?').get(String(t)) : null);
  app.get('/api/family/:token/info', (req, res) => { const f = byToken(req.params.token); if (!f) return bad(res, 'This link is not valid.', 404); res.json({ name: f.name, astronaut: first(f.astro), available: onlineUser(f.user_id) }); });
  app.get('/api/family/:token/messages', (req, res) => {
    const f = byToken(req.params.token); if (!f) return bad(res, 'This link is not valid.', 404);
    res.json({ messages: db.prepare('SELECT id, from_family AS fromFamily, text, created_at AS at FROM family_messages WHERE contact_id = ? ORDER BY id DESC LIMIT 40').all(f.id).reverse() });
  });
  app.post('/api/family/:token/messages', (req, res) => {
    const f = byToken(req.params.token); if (!f) return bad(res, 'This link is not valid.', 404);
    if (!rateLimit(`fam:${f.id}`, 20, 3600e3)) return bad(res, 'Too many messages. Try again later.', 429);
    const text = clip(req.body?.text, 500); if (!text) return bad(res, 'Write something first.');
    db.prepare('INSERT INTO family_messages (contact_id, from_family, text) VALUES (?,1,?)').run(f.id, text); notify(`u:${f.user_id}`, { type: 'family-message', name: f.name });
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------- ICE servers for calls and live video (STUN, plus TURN when configured)
  // TURN uses time-limited credentials (the standard TURN REST scheme understood by coturn's use-auth-secret).
  app.get('/api/ice', (req, res) => {
    if (!rateLimit(`ice:${req.ip}`, 60, 60e3)) return bad(res, 'Too many requests.', 429);
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    const host = process.env.TURN_HOST, secret = process.env.TURN_SECRET;
    if (host && secret) {
      const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:hmsc`;
      iceServers.push({ urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`], username, credential: createHmac('sha1', secret).update(username).digest('base64') });
    }
    res.setHeader('Cache-Control', 'no-store'); res.json({ iceServers, turn: !!(host && secret) });
  });

  // ---------------------------------------------------------------- alerts
  app.get('/api/alerts', requireAuth, (req, res) => res.json({ incidents: activeFor(req.user) }));
  app.post('/api/alerts/:id/ack', requireAuth, (req, res) => {
    const i = incidentRow(Number(req.params.id)); if (!i) return bad(res, 'Not found.', 404);
    if (!isAdmin(req.user) && !crewMateIds(i.user_id).includes(req.user.id)) return bad(res, 'Not allowed.', 403);
    const kind = req.body?.kind === 'responding' ? 'responding' : 'seen';
    db.prepare("INSERT INTO incident_acks (incident_id, user_id, kind) VALUES (?,?,?) ON CONFLICT(incident_id, user_id) DO UPDATE SET kind = CASE WHEN excluded.kind = 'responding' THEN 'responding' ELSE kind END").run(i.id, req.user.id, kind);
    const who = db.prepare("SELECT u.name, a.kind FROM incident_acks a JOIN users u ON u.id = a.user_id WHERE a.incident_id = ? AND a.kind = 'responding'").all(i.id).map(r => first(r.name));
    for (const r of recipients(i.user_id)) notify(`u:${r}`, { type: 'incident-update', id: i.id, responding: who });
    res.json({ ok: true, responding: who });
  });
  app.post('/api/admin/alerts/:id/resolve', requireAdmin, (req, res) => {
    const i = incidentRow(Number(req.params.id)); if (!i) return bad(res, 'Not found.', 404);
    const status = req.body?.status === 'false_alarm' ? 'false_alarm' : 'resolved';
    db.prepare("UPDATE incidents SET status = ?, resolved_at = datetime('now'), resolved_by = ?, resolved_note = ? WHERE id = ?").run(status, req.user.id, clip(req.body?.note, 300) || null, i.id);
    for (const r of recipients(i.user_id)) notify(`u:${r}`, { type: 'incident-closed', id: i.id, status });
    notify(`u:${i.user_id}`, { type: 'incident-closed', id: i.id, status });
    res.json({ ok: true });
  });
  app.get('/api/admin/incidents', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT i.*, u.name FROM incidents i JOIN users u ON u.id = i.user_id ORDER BY i.id DESC LIMIT 60').all().map(incidentView);
    res.json({ incidents: rows, active: rows.filter(r => r.status === 'active').length });
  });
  // SOS: the crew member asks for help himself; everybody is alerted exactly as for a camera detection
  app.post('/api/alerts/sos', requireAuth, (req, res) => {
    if (!rateLimit(`sos:${req.user.id}`, 6, 3600e3)) return bad(res, 'Alert already sent. Help is on the way.', 429);
    res.json({ incident: raiseIncident(req.user.id, { kind: 'manual', severity: 'critical', evidence: 'The crew member pressed SOS and asks for help now.', source: 'sos' }) });
  });
  // a test button for demos: raises a clearly-labelled drill that goes through the real pipeline
  app.post('/api/alerts/test', requireAuth, (req, res) => {
    if (!rateLimit(`alerttest:${req.user.id}`, 5, 3600e3)) return bad(res, 'Too many test alerts.', 429);
    res.json({ incident: raiseIncident(req.user.id, { kind: 'manual', severity: 'high', evidence: 'Test alert from the app (drill).', source: 'test' }) });
  });
}
