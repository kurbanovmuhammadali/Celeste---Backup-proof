import { db, tx } from './db.js';
import { toSql } from './health/engine.js';

/** Deterministic PRNG so every demo account tells the same story. */
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * 30 days of synthetic data shaped like WHOOP v2 + manual crew measurements.
 * Story: day ~120 of an ISS increment. Bone resorption creeping up, exercise sometimes missed,
 * last nights' sleep short → bones & brain amber, the rest green. Clearly marked source='demo'.
 */
export function seedDemo(userId, seed = 7) {
  const r = rng(seed + userId);
  const n = (mean, sd) => mean + (r() + r() + r() - 1.5) * sd * 1.15;
  const insRaw = db.prepare('INSERT INTO measurements (user_id, metric, value, value2, unit, source, external_id, recorded_at) VALUES (?,?,?,?,?,?,?,?)');
  const ins = { run: (...a) => { if (a[7]) insRaw.run(...a); } };
  const chk = db.prepare('INSERT INTO checkins (user_id, mood, energy, symptoms, note, recorded_at) VALUES (?,?,?,?,?,?)');
  tx(() => {
    for (let i = 29; i >= 0; i--) {
      const day = new Date(); day.setUTCHours(6, 30, 0, 0); day.setUTCDate(day.getUTCDate() - i);
      const t = (h, m = 0) => { const d = new Date(day); d.setUTCHours(h, m); const now = new Date(Date.now() - 60e3); return toSql(d > now ? now : d); }; // later-today readings are stamped "just now" so the demo story does not depend on the hour of day
      const late = i < 6; // last week drifts
      const id = (k) => `demo-${k}-${i}`;
      const sleep = late ? n(6.1, 0.35) : n(7.2, 0.45);
      const hrv = late ? n(48, 4) : n(58, 5);
      const rhr = late ? n(61, 2) : n(57, 2);
      const recovery = Math.max(8, Math.min(99, (hrv - 30) * 1.9 + (sleep - 5) * 6 + n(0, 5)));
      ins.run(userId, 'sleep', +sleep.toFixed(2), null, 'h', 'demo', id('sleep'), t(6, 30));
      ins.run(userId, 'hrv', +hrv.toFixed(1), null, 'ms', 'demo', id('hrv'), t(6, 31));
      ins.run(userId, 'rhr', Math.round(rhr), null, 'bpm', 'demo', id('rhr'), t(6, 31));
      ins.run(userId, 'recovery', Math.round(recovery), null, '%', 'demo', id('rec'), t(6, 32));
      ins.run(userId, 'spo2', +n(96.8, 0.6).toFixed(1), null, '%', 'demo', id('spo2'), t(6, 32));
      const missed = r() < (late ? 0.5 : 0.15);
      ins.run(userId, 'strain', +(missed ? n(6.8, 0.8) : n(12.5, 1.5)).toFixed(1), null, '', 'demo', id('strain'), t(21));
      ins.run(userId, 'exercise', Math.round(missed ? n(70, 10) : n(140, 12)), null, 'min', 'demo', id('ex'), t(21));
      if (i % 2 === 0) ins.run(userId, 'bp', Math.round(n(122, 4)), Math.round(n(78, 3)), 'mmHg', 'demo', id('bp'), t(7));
      if (i % 3 === 0) ins.run(userId, 'glucose', Math.round(n(91, 5)), null, 'mg/dL', 'demo', id('glu'), t(7, 10));
      ins.run(userId, 'temp', +n(36.8, 0.15).toFixed(1), null, '°C', 'demo', id('temp'), t(7, 5));
      if (i % 4 === 0) ins.run(userId, 'weight', +(78.4 - (29 - i) * 0.035 + n(0, 0.2)).toFixed(1), null, 'kg', 'demo', id('kg'), t(6, 45));
      ins.run(userId, 'radiation', +n(0.62, 0.08).toFixed(2), null, 'mSv', 'demo', id('rad'), t(23));
      ins.run(userId, 'co2', +n(2.4, 0.3).toFixed(1), null, 'mmHg', 'demo', id('co2'), t(22));
      if (i % 7 === 0) ins.run(userId, 'ntx', +(34 + (29 - i) * 0.26 + n(0, 0.8)).toFixed(1), null, 'nmol/mmol', 'demo', id('ntx'), t(8));
      if (i === 28 || i === 0) ins.run(userId, 'vitd', +(i === 0 ? 33 : 36).toFixed(0), null, 'ng/mL', 'demo', id('vitd'), t(8, 10));
      if (i > 0) {
        const mood = Math.round(late ? n(56, 6) : n(72, 6));
        const symptoms = i === 2 ? ['headache'] : i === 4 ? ['insomnia'] : [];
        if (t(6, 40)) chk.run(userId, mood, Math.round(n(65, 8)), JSON.stringify(symptoms), null, t(6, 40));
        ins.run(userId, 'mood', mood, null, '/100', 'demo', id('mood'), t(6, 40));
      }
    }
    db.prepare(`INSERT INTO integrations (user_id, provider, status, last_sync, meta) VALUES (?, 'demo', 'connected', datetime('now'), '{}')
      ON CONFLICT(user_id, provider) DO UPDATE SET status='connected', last_sync=datetime('now')`).run(userId);
  });
}

export function clearDemo(userId) {
  tx(() => {
    db.prepare(`DELETE FROM measurements WHERE user_id = ? AND source = 'demo'`).run(userId);
    db.prepare(`DELETE FROM checkins WHERE user_id = ? AND note IS NULL AND recorded_at < datetime('now','-1 hours')`).run(userId);
    db.prepare(`DELETE FROM integrations WHERE user_id = ? AND provider = 'demo'`).run(userId);
  });
}
