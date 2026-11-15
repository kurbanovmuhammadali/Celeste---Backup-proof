/**
 * Astronaut background file: CV, characteristics, health conditions, allergies, medications, uploaded files.
 * Sensitive health data: the astronaut writes it (and sees exactly what is stored); flight surgeons can read it and add
 * private notes. The companion AI reads a short summary of it to be gentler and more relevant (see `aiSummary`).
 *
 *  GET/PUT    /api/me/background          read / write own background (never includes surgeon notes)
 *  GET/POST   /api/me/files               list / upload a file (base64, max ~700 KB, 5 files)
 *  DELETE     /api/me/files/:id
 *  PUT        /api/admin/crew/:id/notes   surgeon-only private notes
 *  GET        /api/admin/crew/:id/files/:fid   download (surgeon)
 */
import { db } from './db.js';
import { requireAuth } from './auth.js';
import { requireAdmin } from './roles.js';

db.exec(`
CREATE TABLE IF NOT EXISTS backgrounds (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}',
  admin_notes TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS crew_files (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
const MAX_FILE = 700 * 1024;
const MIMES = new Set(['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export function cleanBackground(b) {
  if (!b || typeof b !== 'object') return { error: 'Missing background.' };
  const conditions = Array.isArray(b.conditions) ? b.conditions : [];
  if (conditions.length > 20) return { error: 'At most 20 health conditions.' };
  return {
    value: {
      cvText: str(b.cvText, 8000), characteristics: str(b.characteristics, 2000), allergies: str(b.allergies, 500), medications: str(b.medications, 500),
      conditions: conditions.map(c => ({ name: str(c?.name, 80), notes: str(c?.notes, 300) })).filter(c => c.name),
      sharedConsent: b.sharedConsent === true,
    },
  };
}

export const readBackground = id => {
  const r = db.prepare('SELECT data, updated_at FROM backgrounds WHERE user_id = ?').get(id);
  return r ? { ...JSON.parse(r.data), updatedAt: r.updated_at } : null;
};
export const readNotes = id => db.prepare('SELECT admin_notes FROM backgrounds WHERE user_id = ?').get(id)?.admin_notes ?? '';
export const listFiles = id => db.prepare('SELECT id, name, mime, size, created_at AS createdAt FROM crew_files WHERE user_id = ? ORDER BY id DESC').all(id);

/** Short plain-text summary handed to the companion AI. Only when the astronaut agreed to share it. */
export function aiSummary(id) {
  const b = readBackground(id);
  if (!b || !b.sharedConsent) return '';
  const parts = [];
  if (b.characteristics) parts.push(`Character and preferences: ${b.characteristics.slice(0, 700)}`);
  if (b.allergies) parts.push(`ALLERGIES (important, never suggest anything containing them): ${b.allergies}`);
  if (b.medications) parts.push(`Current medications: ${b.medications}`);
  if (b.conditions?.length) parts.push(`Known health conditions (never diagnose, never raise them unless the crew member does): ${b.conditions.map(c => c.name).join(', ')}`);
  if (b.cvText) parts.push(`Background: ${b.cvText.slice(0, 500)}`);
  return parts.join('\n');
}

/** The files the astronaut uploaded to their background, handed to the SI only when they agreed to share it (text inline, PDF/photo natively). */
export function aiFiles(id) {
  const b = readBackground(id);
  if (!b || !b.sharedConsent) return { text: [], files: [], names: [] };
  const rows = db.prepare('SELECT name, mime, data FROM crew_files WHERE user_id = ? ORDER BY id DESC LIMIT 3').all(id);
  const out = { text: [], files: [], names: rows.map(r => r.name) };
  for (const r of rows) {
    const buf = Buffer.from(r.data);
    if (r.mime === 'text/plain') out.text.push({ name: r.name, text: buf.toString('utf8').slice(0, 8000) });
    else if (/^(application\/pdf|image\/(png|jpeg))$/.test(r.mime)) out.files.push({ name: r.name, mime: r.mime, data: buf.toString('base64') });
  }
  return out;
}

export function mountBackground(app) {
  app.get('/api/me/background', requireAuth, (req, res) => res.json({ background: readBackground(req.user.id), files: listFiles(req.user.id) }));

  app.put('/api/me/background', requireAuth, (req, res) => {
    const { value, error } = cleanBackground(req.body);
    if (error) return bad(res, error);
    db.prepare("INSERT INTO backgrounds (user_id, data, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at").run(req.user.id, JSON.stringify(value));
    res.json({ ok: true, background: readBackground(req.user.id) });
  });

  app.post('/api/me/files', requireAuth, (req, res) => {
    const { name, mime, data } = req.body ?? {};
    if (!MIMES.has(mime)) return bad(res, 'Use a PDF, Word, text, PNG or JPEG file.');
    if (typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) return bad(res, 'Invalid file data.');
    const buf = Buffer.from(data, 'base64');
    if (!buf.length || buf.length > MAX_FILE) return bad(res, 'Files can be up to 700 KB.', 413);
    if (db.prepare('SELECT COUNT(*) AS n FROM crew_files WHERE user_id = ?').get(req.user.id).n >= 5) return bad(res, 'You can keep up to 5 files. Delete one first.');
    db.prepare('INSERT INTO crew_files (user_id, name, mime, size, data) VALUES (?,?,?,?,?)').run(req.user.id, str(name, 120) || 'file', mime, buf.length, buf);
    res.json({ ok: true, files: listFiles(req.user.id) });
  });

  app.delete('/api/me/files/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM crew_files WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    res.json({ ok: true, files: listFiles(req.user.id) });
  });

  app.put('/api/admin/crew/:id/notes', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(id)) return bad(res, 'Crew member not found.', 404);
    db.prepare("INSERT INTO backgrounds (user_id, admin_notes, updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(user_id) DO UPDATE SET admin_notes = excluded.admin_notes").run(id, str(req.body?.notes, 4000));
    res.json({ ok: true });
  });

  app.get('/api/admin/crew/:id/files/:fid', requireAdmin, (req, res) => {
    const f = db.prepare('SELECT name, mime, data FROM crew_files WHERE id = ? AND user_id = ?').get(Number(req.params.fid), Number(req.params.id));
    if (!f) return bad(res, 'File not found.', 404);
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${f.name.replace(/[^\w.\- ]/g, '_')}"`);
    res.send(Buffer.from(f.data));
  });
}
