import { randomBytes, scryptSync, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { db } from './db.js';

export const SESSION_COOKIE = 'pg_session';
const SESSION_DAYS = 30;
export const LEGAL_VERSION = '2026-11-08';

export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const token = (n = 32) => randomBytes(n).toString('base64url');

export function hashPassword(pw) {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = scryptSync(pw, Buffer.from(salt, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.';
  if (pw.length > 128) return 'Password is too long.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use at least one letter and one number.';
  return null;
}

export function ageFrom(dob, now = new Date()) {
  const d = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return NaN;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

export function createSession(userId, client) {
  const t = token();
  db.prepare('INSERT INTO sessions (token_hash, user_id, client, expires_at) VALUES (?, ?, ?, ?)')
    .run(sha256(t), userId, client, Date.now() + SESSION_DAYS * 864e5);
  return t;
}

export function setSessionCookie(res, t) {
  res.cookie(SESSION_COOKIE, t, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

function readToken(req) {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return { t: h.slice(7), via: 'bearer' };
  const m = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`).exec(req.headers.cookie || '');
  return m ? { t: decodeURIComponent(m[1]), via: 'cookie' } : null;
}

export function sessionUser(req) {
  const r = readToken(req);
  if (!r) return null;
  const row = db.prepare(`SELECT u.*, s.expires_at, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha256(r.t));
  if (!row || row.expires_at < Date.now()) return null;
  return { user: row, via: r.via, tokenHash: row.token_hash };
}

/** Requires a valid session. Cookie-authenticated writes must carry a custom header (CSRF defence). */
export function requireAuth(req, res, next) {
  const s = sessionUser(req);
  if (!s) return res.status(401).json({ error: 'Please sign in.' });
  if (s.via === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers['x-requested-with'] !== 'perigee') {
    return res.status(403).json({ error: 'Missing CSRF header.' });
  }
  req.user = s.user;
  req.session = s;
  next();
}

const parseGoal = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export const publicUser = u => ({
  id: u.id, email: u.email, name: u.name, dob: u.dob, role: u.role, mission: u.mission,
  environment: u.environment, missionYears: u.mission_years ?? null,
  heightCm: u.height_cm ?? null, weightKg: u.weight_kg ?? null, missionGoal: parseGoal(u.mission_goal),
  leader: u.role === 'leader', demo: /@demo\.celeste$/i.test(String(u.email)),
  admin: ['surgeon', 'leader'].includes(u.role) || (process.env.ADMIN_EMAILS || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean).includes(String(u.email).toLowerCase()),
  passwordless: u.password_hash === '!', createdAt: u.created_at,
});

// --- simple in-memory rate limiter -------------------------------------------------
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n++;
  return b.n <= max;
}

// --- encryption for third-party tokens at rest ----------------------------------------
const encKey = () => createHash('sha256').update(process.env.TOKEN_ENC_KEY || 'dev-only-key-change-me').digest();
export function encrypt(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(s) {
  if (!s) return null;
  const [iv, tag, data] = s.split('.').map(p => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', encKey(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}
