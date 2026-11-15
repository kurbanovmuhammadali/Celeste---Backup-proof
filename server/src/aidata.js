/**
 * What the SI knows about the person: a compact, server-built snapshot of their real measurements (WHOOP + hand-entered),
 * with the source and age of every number, so it never guesses. Also refreshes WHOOP first when the last sync is old.
 * Blood pressure is NOT measured by WHOOP: it only ever appears here when the person typed it in.
 */
import { db } from './db.js';
import { syncWhoop } from './whoop.js';

const METRICS = ['recovery', 'sleep', 'hrv', 'rhr', 'spo2', 'temp', 'strain', 'exercise', 'bp', 'glucose', 'weight', 'mood', 'radiation', 'co2', 'ntx', 'vitd'];
const ms = s => Date.parse(String(s).replace(' ', 'T') + 'Z');
const sql = t => new Date(t).toISOString().slice(0, 19).replace('T', ' ');
const r1 = x => (x == null ? null : Math.round(x * 10) / 10);

export function aiSnapshot(userId, now = Date.now()) {
  const vitals = {};
  const last = db.prepare('SELECT value, value2, unit, source, recorded_at FROM measurements WHERE user_id = ? AND metric = ? ORDER BY recorded_at DESC LIMIT 1');
  const avg = db.prepare('SELECT AVG(value) a, AVG(value2) a2, COUNT(*) n FROM measurements WHERE user_id = ? AND metric = ? AND recorded_at >= ?');
  for (const k of METRICS) {
    const l = last.get(userId, k);
    if (!l) continue;
    const a7 = avg.get(userId, k, sql(now - 7 * 864e5)), a28 = avg.get(userId, k, sql(now - 28 * 864e5));
    const two = k === 'bp';
    vitals[k] = {
      latest: two && l.value2 != null ? `${Math.round(l.value)}/${Math.round(l.value2)}` : r1(l.value), unit: l.unit,
      source: /whoop/i.test(l.source) ? 'WHOOP' : l.source === 'manual' ? 'entered by hand' : l.source,
      hoursAgo: Math.max(0, Math.round((now - ms(l.recorded_at)) / 36e5)),
      avg7d: a7.n ? (two && a7.a2 != null ? `${Math.round(a7.a)}/${Math.round(a7.a2)}` : r1(a7.a)) : null, readings7d: a7.n,
      avg28d: a28.n ? (two && a28.a2 != null ? `${Math.round(a28.a)}/${Math.round(a28.a2)}` : r1(a28.a)) : null, readings28d: a28.n,
    };
  }
  const w = db.prepare("SELECT status, last_sync FROM integrations WHERE user_id = ? AND provider = 'whoop'").get(userId);
  const whoop = { connected: w?.status === 'connected', lastSyncMinutesAgo: w?.last_sync ? Math.max(0, Math.round((now - ms(w.last_sync)) / 6e4)) : null };
  const checkins = db.prepare('SELECT mood, symptoms, note, recorded_at FROM checkins WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 3').all(userId).map(c => { let sy = []; try { sy = JSON.parse(c.symptoms); } catch {} return { hoursAgo: Math.max(0, Math.round((now - ms(c.recorded_at)) / 36e5)), mood: c.mood, symptoms: sy, note: c.note ? String(c.note).slice(0, 160) : null }; });
  return { whoop, vitals, recentCheckins: checkins, note: 'WHOOP provides recovery, sleep, HRV, resting heart rate, strain, SpO2 and skin temperature; it does NOT measure blood pressure. Blood pressure, glucose and weight appear only if the person typed them in.' };
}

/** Pulls fresh WHOOP data right before an answer when the last sync is older than `maxAgeMs`. Never throws, never blocks long. */
export async function freshenWhoop(userId, maxAgeMs = 10 * 60e3, timeoutMs = 6000) {
  try {
    const w = db.prepare("SELECT status, last_sync FROM integrations WHERE user_id = ? AND provider = 'whoop'").get(userId);
    if (w?.status !== 'connected') return false;
    if (w.last_sync && Date.now() - ms(w.last_sync) < maxAgeMs) return false;
    await Promise.race([syncWhoop(userId, 3), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeoutMs))]);
    return true;
  } catch { return false; }
}
