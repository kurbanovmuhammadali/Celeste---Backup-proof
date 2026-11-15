/**
 * WHOOP Developer API v2 integration (OAuth 2.0 authorization code flow).
 * Docs: https://developer.whoop.com/api/  ·  Scopes: https://developer.whoop.com/docs/developing/oauth/
 */
import { db } from './db.js';
import { encrypt, decrypt, token } from './auth.js';
import { toSql, parseTs } from './health/engine.js';

const AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const API = 'https://api.prod.whoop.com/developer/v2';
export const SCOPES = ['offline', 'read:recovery', 'read:cycles', 'read:sleep', 'read:workout', 'read:body_measurement'];

export const whoopConfigured = () => Boolean(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
const redirectUri = () => process.env.WHOOP_REDIRECT_URI?.trim() || (process.env.APP_URL?.trim() ? `${process.env.APP_URL.trim().replace(/\/$/, '')}/api/integrations/whoop/callback` : `http://localhost:${process.env.PORT || 4000}/api/integrations/whoop/callback`);

export function authorizeUrl(userId, platform) {
  const state = token(24);
  db.prepare('INSERT INTO oauth_states (state, user_id, platform, expires_at) VALUES (?,?,?,?)').run(state, userId, platform, Date.now() + 10 * 60e3);
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({ response_type: 'code', client_id: process.env.WHOOP_CLIENT_ID, redirect_uri: redirectUri(), scope: SCOPES.join(' '), state }).toString();
  return u.toString();
}

export function consumeState(state) {
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(String(state || ''));
  if (row) db.prepare('DELETE FROM oauth_states WHERE state = ?').run(row.state);
  return row && row.expires_at > Date.now() ? row : null;
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: process.env.WHOOP_CLIENT_ID, client_secret: process.env.WHOOP_CLIENT_SECRET }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`WHOOP token request failed (${res.status}).`);
  const t = await res.json();
  return { access_token: t.access_token, refresh_token: t.refresh_token, expires_at: Date.now() + (t.expires_in ?? 3600) * 1000 };
}

export async function exchangeCode(userId, code) {
  const t = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  db.prepare(`INSERT INTO integrations (user_id, provider, status, tokens, meta) VALUES (?, 'whoop', 'connected', ?, '{}')
    ON CONFLICT(user_id, provider) DO UPDATE SET status='connected', tokens=excluded.tokens`).run(userId, encrypt(t));
}

const refreshing = new Map(); // userId -> in-flight refresh (the three parallel sync calls must share ONE refresh: the old token dies after first use)
async function accessToken(userId) {
  const row = db.prepare(`SELECT tokens FROM integrations WHERE user_id = ? AND provider = 'whoop'`).get(userId);
  const t = decrypt(row?.tokens);
  if (!t) throw new Error('WHOOP is not connected.');
  if (Date.now() <= t.expires_at - 60e3) return t.access_token;
  if (!t.refresh_token) throw new Error('WHOOP session expired. Reconnect.');
  if (!refreshing.has(userId)) {
    refreshing.set(userId, (async () => {
      try {
        // WHOOP rotates refresh tokens: the one in the reply replaces the old one
        const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token, scope: SCOPES.join(' ') });
        const next = { ...fresh, refresh_token: fresh.refresh_token || t.refresh_token };
        db.prepare(`UPDATE integrations SET tokens = ? WHERE user_id = ? AND provider = 'whoop'`).run(encrypt(next), userId);
        return next.access_token;
      } catch { db.prepare(`UPDATE integrations SET status = 'error' WHERE user_id = ? AND provider = 'whoop'`).run(userId); throw new Error('WHOOP session expired. Reconnect WHOOP in Settings.'); }
      finally { refreshing.delete(userId); }
    })());
  }
  return refreshing.get(userId);
}

async function getAll(userId, path, start, maxPages = 4) {
  const at = await accessToken(userId);
  const out = [];
  let next;
  for (let p = 0; p < maxPages; p++) {
    const u = new URL(API + path);
    u.searchParams.set('limit', '25');
    u.searchParams.set('start', start);
    if (next) u.searchParams.set('nextToken', next);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${at}` }, signal: AbortSignal.timeout(15000) });
    if (res.status === 429) throw new Error('WHOOP rate limit reached — try again in a minute.');
    if (!res.ok) throw new Error(`WHOOP ${path} failed (${res.status}).`);
    const body = await res.json();
    out.push(...(body.records ?? []));
    next = body.next_token;
    if (!next) break;
  }
  return out;
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Pull last N days and upsert as normalised measurements (source = 'whoop'). */
export async function syncWhoop(userId, days = 30) {
  const start = new Date(Date.now() - days * 864e5).toISOString();
  const up = db.prepare(`INSERT INTO measurements (user_id, metric, value, value2, unit, source, external_id, recorded_at) VALUES (?,?,?,?,?, 'whoop', ?, ?)
    ON CONFLICT(user_id, metric, source, external_id) WHERE external_id IS NOT NULL DO UPDATE SET value = excluded.value, recorded_at = excluded.recorded_at`);
  const at = s => toSql(parseTs(s));
  let count = 0;
  const stat = { recoveries: 0, recoveriesScored: 0, calibrating: 0, sleeps: 0, sleepsScored: 0, cycles: 0 };
  const put = (metric, v, unit, ext, when) => { if (v != null) { up.run(userId, metric, v, null, unit, ext, at(when)); count++; } };

  const [recoveries, sleeps, cycles] = await Promise.all([
    getAll(userId, '/recovery', start), getAll(userId, '/activity/sleep', start), getAll(userId, '/cycle', start),
  ]);
  stat.recoveries = recoveries.length; stat.sleeps = sleeps.length; stat.cycles = cycles.length;
  for (const r of recoveries) {
    if (r.score?.user_calibrating) stat.calibrating++;
    if (r.score_state !== 'SCORED' || !r.score || r.score.user_calibrating) continue;
    stat.recoveriesScored++;
    const when = r.created_at ?? r.updated_at; const id = String(r.sleep_id ?? r.cycle_id);
    put('recovery', num(r.score.recovery_score), '%', id, when);
    put('hrv', num(r.score.hrv_rmssd_milli), 'ms', id, when);
    put('rhr', num(r.score.resting_heart_rate), 'bpm', id, when);
    put('spo2', num(r.score.spo2_percentage), '%', id, when);
  }
  for (const s of sleeps) {
    if (s.score_state !== 'SCORED' || s.nap || !s.score?.stage_summary) continue;
    stat.sleepsScored++;
    const st = s.score.stage_summary;
    const ms = (st.total_light_sleep_time_milli ?? 0) + (st.total_slow_wave_sleep_time_milli ?? 0) + (st.total_rem_sleep_time_milli ?? 0);
    put('sleep', +(ms / 36e5).toFixed(2), 'h', String(s.id), s.end ?? s.updated_at);
  }
  for (const c of cycles) {
    if (c.score_state !== 'SCORED' || !c.score) continue;
    put('strain', num(c.score.strain) != null ? +c.score.strain.toFixed(1) : null, '', String(c.id), c.end ?? c.start);
  }
  try {
    const bodyRes = await fetch(`${API}/user/measurement/body`, { headers: { Authorization: `Bearer ${await accessToken(userId)}` }, signal: AbortSignal.timeout(15000) });
    if (bodyRes.ok) { const b = await bodyRes.json(); put('weight', num(b.weight_kilogram), 'kg', `body-${new Date().toISOString().slice(0, 10)}`, new Date().toISOString()); }
  } catch { /* optional */ }
  const result = { imported: count, ...stat, at: new Date().toISOString() };
  db.prepare(`UPDATE integrations SET last_sync = datetime('now'), status = 'connected', meta = ? WHERE user_id = ? AND provider = 'whoop'`).run(JSON.stringify({ last: result }), userId);
  return result;
}

export async function disconnectWhoop(userId) {
  try {
    const at = await accessToken(userId);
    await fetch(`${API}/user/access`, { method: 'DELETE', headers: { Authorization: `Bearer ${at}` }, signal: AbortSignal.timeout(10000) });
  } catch { /* revoke best-effort */ }
  db.prepare(`DELETE FROM integrations WHERE user_id = ? AND provider = 'whoop'`).run(userId);
}

let autoTimer = null;
/** Keeps every connected member's data fresh without them pressing Sync (WHOOP has no live stream; webhooks are not used). */
export function startWhoopAutoSync(everyMs = 20 * 60e3) {
  if (autoTimer || !whoopConfigured()) return;
  const run = async () => {
    for (const r of db.prepare(`SELECT user_id FROM integrations WHERE provider = 'whoop' AND status = 'connected'`).all()) {
      try { await syncWhoop(r.user_id, 3); } catch (e) { console.error('[whoop] auto-sync failed for user', r.user_id, String(e.message).slice(0, 80)); }
      await new Promise(ok => setTimeout(ok, 1500)); // stay far below the 100 requests/minute limit
    }
  };
  autoTimer = setInterval(run, everyMs); autoTimer.unref?.(); setTimeout(run, 30e3).unref?.();
}
