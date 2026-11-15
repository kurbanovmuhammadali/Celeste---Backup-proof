import { db } from '../db.js';
import { METRICS, SYSTEMS, SYMPTOMS, DEFAULT_MISSION_PLAN } from './catalog.js';

const RANK = { green: 0, amber: 1, red: 2, none: -1 };
const worst = list => list.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'none');
const round = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
export const today = () => new Date().toISOString().slice(0, 10);
export const parseTs = s => new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
export const toSql = (d = new Date()) => d.toISOString().slice(0, 19).replace('T', ' ');

export function baselineOf(userId, metric) {
  const row = db.prepare(`SELECT AVG(value) v, AVG(value2) v2, COUNT(*) n FROM measurements
    WHERE user_id = ? AND metric = ? AND recorded_at BETWEEN datetime('now','-30 days') AND datetime('now','-7 days')`).get(userId, metric);
  if (row?.n >= 3) return { value: row.v, value2: row.v2 };
  const all = db.prepare('SELECT AVG(value) v, AVG(value2) v2, COUNT(*) n FROM measurements WHERE user_id = ? AND metric = ?').get(userId, metric);
  return all?.n ? { value: all.v, value2: all.v2 } : null;
}

export function evaluate(key, value, value2, baseline) {
  const m = METRICS[key];
  if (!m || value == null) return { status: 'none' };
  const r = m.range;
  switch (r.kind) {
    case 'min': return { status: value >= r.g ? 'green' : value >= r.a ? 'amber' : 'red' };
    case 'max': return { status: value <= r.g ? 'green' : value <= r.a ? 'amber' : 'red' };
    case 'abs': {
      const inn = ([lo, hi]) => value >= lo && value <= hi;
      return { status: inn(r.green) ? 'green' : inn(r.amber) ? 'amber' : 'red' };
    }
    case 'bp': {
      const s = value, d = value2 ?? 0;
      if (s >= 140 || d >= 90 || s < 90) return { status: 'red' };
      if (s >= 130 || d >= 85) return { status: 'amber' };
      return { status: 'green' };
    }
    case 'baseline': {
      if (!baseline?.value) return { status: 'green', deviation: 0 };
      const dev = ((value - baseline.value) / baseline.value) * 100;
      const bad = r.dir === 'low' ? -dev : dev;
      return { status: bad >= r.red ? 'red' : bad >= r.amber ? 'amber' : 'green', deviation: round(dev) };
    }
  }
  return { status: 'none' };
}

export function series(userId, metric, days = 30) {
  return db.prepare(`SELECT date(recorded_at) day, AVG(value) value, AVG(value2) value2 FROM measurements
    WHERE user_id = ? AND metric = ? AND recorded_at >= datetime('now', ?) GROUP BY day ORDER BY day`)
    .all(userId, metric, `-${days} days`).map(r => ({ day: r.day, value: round(r.value), value2: round(r.value2) }));
}

export function metricSnapshot(userId, key) {
  const m = METRICS[key];
  const last = db.prepare('SELECT * FROM measurements WHERE user_id = ? AND metric = ? ORDER BY recorded_at DESC LIMIT 1').get(userId, key);
  const base = baselineOf(userId, key);
  const ev = last ? evaluate(key, last.value, last.value2, base) : { status: 'none' };
  const spark = series(userId, key, 7).map(p => p.value);
  const ageH = last ? (Date.now() - parseTs(last.recorded_at).getTime()) / 36e5 : null;
  return {
    key, label: m.label, unit: m.unit, system: m.system,
    value: last ? round(last.value) : null, value2: last?.value2 != null ? round(last.value2) : null,
    status: ev.status, deviation: ev.deviation ?? (base?.value && last ? round(((last.value - base.value) / base.value) * 100) : null),
    baseline: base ? round(base.value) : null,
    recordedAt: last?.recorded_at ?? null, stale: ageH != null && ageH > 72, source: last?.source ?? null, spark,
  };
}

export function latestCheckin(userId) {
  const c = db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1').get(userId);
  if (!c) return null;
  return { ...c, symptoms: JSON.parse(c.symptoms) };
}

export function systemsFor(userId, snaps, checkin) {
  const recentSymptoms = checkin && (Date.now() - parseTs(checkin.recorded_at).getTime()) < 48 * 36e5 ? checkin.symptoms : [];
  return Object.entries(SYSTEMS).map(([key, s]) => {
    const parts = s.metrics.map(k => snaps[k]).filter(x => x && x.status !== 'none');
    const reasons = parts.filter(p => p.status !== 'green').map(p => ({ metric: p.key, label: p.label, status: p.status }));
    const sym = recentSymptoms.filter(k => SYMPTOMS[k]?.system === key);
    sym.forEach(k => reasons.push({ symptom: k, label: SYMPTOMS[k].label, status: SYMPTOMS[k].severity }));
    const status = worst([...parts.map(p => p.status), ...sym.map(k => SYMPTOMS[k].severity)]);
    return { key, label: s.label, hazard: s.hazard, blurb: s.blurb, status: status === 'none' ? 'green' : status, reasons, metrics: s.metrics };
  });
}

export function readiness(snaps, systems) {
  if (snaps.recovery?.value == null && snaps.sleep?.value == null) return 0; // no WHOOP and nothing typed in: no score, never an invented one
  const pts = { green: 100, amber: 62, red: 25 };
  const rec = snaps.recovery?.value ?? 60;
  const sleep = Math.min(100, ((snaps.sleep?.value ?? 7) / 8) * 100);
  const mood = snaps.mood?.value ?? 65;
  const sys = systems.reduce((a, s) => a + pts[s.status], 0) / systems.length;
  return Math.round(rec * 0.35 + sleep * 0.2 + mood * 0.15 + sys * 0.3);
}

export function gamification(userId) {
  const xp = db.prepare('SELECT COALESCE(SUM(xp),0) xp FROM task_completions WHERE user_id = ?').get(userId).xp;
  const days = new Set(db.prepare(`SELECT DISTINCT date(recorded_at) d FROM checkins WHERE user_id = ? AND recorded_at >= datetime('now','-60 days')`).all(userId).map(r => r.d));
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1); // today not done yet keeps streak alive
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
  const level = Math.floor(xp / 300) + 1;
  const badges = [
    { key: 'first-light', label: 'First light', earned: days.size > 0, hint: 'Complete your first check-in' },
    { key: 'orbit-7', label: '7-day orbit', earned: streak >= 7, hint: '7-day check-in streak' },
    { key: 'bone-guard', label: 'Bone guardian', earned: db.prepare(`SELECT COUNT(*) n FROM task_completions WHERE user_id = ? AND task_key LIKE 'adapt-bone%'`).get(userId).n > 0, hint: 'Complete an adaptive bone task' },
    { key: 'commander', label: 'Commander', earned: level >= 5, hint: 'Reach level 5' },
  ];
  return { xp, level, levelProgress: (xp % 300) / 300, nextLevelXp: 300 - (xp % 300), streak, badges };
}

export function dashboard(userId) {
  const snaps = Object.fromEntries(Object.keys(METRICS).map(k => [k, metricSnapshot(userId, k)]));
  const checkin = latestCheckin(userId);
  const systems = systemsFor(userId, snaps, checkin);
  const alerts = [];
  for (const s of Object.values(snaps)) {
    if (s.status !== 'red' || s.stale) continue;
    if (METRICS[s.key].clinical) alerts.push({ level: 'red', metric: s.key, title: `${s.label} out of range`, body: escalationText(s), escalate: true });
    else alerts.push({ level: 'amber', metric: s.key, title: `${s.label} below target`, body: `Latest ${s.value}${s.unit ? ' ' + s.unit : ''}. Your plan has been adapted — see the Plan tab.` });
  }
  for (const k of checkin?.symptoms ?? []) if (SYMPTOMS[k]?.severity === 'red') alerts.push({ level: 'red', title: SYMPTOMS[k].label, body: 'Reported in your check-in. Contact the flight surgeon at the next opportunity.', escalate: true });
  for (const s of systems) if (s.status === 'amber' && !alerts.some(a => s.metrics.includes(a.metric))) alerts.push({ level: 'amber', system: s.key, title: `${s.label}: watch`, body: s.reasons.map(r => r.label).join(', ') + ' trending away from your baseline.' });
  return {
    readiness: readiness(snaps, systems),
    metrics: snaps, systems, alerts, checkin,
    checkedInToday: checkin?.recorded_at?.slice(0, 10) === today(),
    game: gamification(userId),
  };
}

function escalationText(s) {
  const v = s.value2 != null ? `${s.value}/${s.value2}` : s.value;
  return `Latest ${v}${s.unit ? ' ' + s.unit : ''}. Re-measure following the instructions. If it stays in the red zone, contact the flight surgeon.`;
}

// ---------------------------------------------------------------- adaptive plan
export function missionPlan(userId) {
  const row = db.prepare('SELECT * FROM plans WHERE user_id = ?').get(userId);
  return row ? { source: row.source, items: JSON.parse(row.items), updatedAt: row.updated_at } : { source: 'Default ISS crew template', items: DEFAULT_MISSION_PLAN, updatedAt: null };
}

/**
 * Builds today's plan: the mission plan is kept untouched; the engine ADDS or MODIFIES with an
 * explicit reason. Anything outside the crew protocol is marked `needsApproval` (flight surgeon).
 */
export function adaptivePlan(userId, day = today()) {
  const { items, source } = missionPlan(userId);
  const d = dashboard(userId);
  const m = d.metrics;
  const sys = Object.fromEntries(d.systems.map(s => [s.key, s]));
  const adaptations = [];
  const add = a => adaptations.push({ xp: 30, category: 'adaptive', ...a });

  if (sys.bones.status !== 'green') {
    const why = [m.ntx.status !== 'green' && `bone resorption marker ${m.ntx.deviation > 0 ? '+' : ''}${m.ntx.deviation ?? '?'} % vs baseline`, m.strain.status !== 'green' && `strain ${m.strain.value} below target`, m.exercise.status !== 'green' && `exercise ${m.exercise.value} min`].filter(Boolean);
    add({ key: 'adapt-bone-run', kind: 'add', baseKey: 'treadmill', title: '+1 km loaded treadmill', detail: 'Your plan says 1 km. Run one more — impact loading is what tells bones to rebuild.', reason: why.join(' · '), target: 1, unit: 'km', xp: 50, needsApproval: m.ntx.status === 'red' });
    add({ key: 'adapt-bone-heel', kind: 'add', baseKey: 'ared', title: '+10 min heel raises & squats', detail: 'Extra loaded set on ARED targeting hip & spine.', reason: why.join(' · '), target: 10, unit: 'min', xp: 40 });
  }
  if (m.recovery.status === 'red') {
    add({ key: 'adapt-recovery', kind: 'modify', baseKey: 'cevis', title: 'Keep CEVIS in zone 2 only', detail: 'Same 30 min, lower intensity. Volume stays, intensity drops.', reason: `Recovery ${m.recovery.value} % — body is under-recovered`, xp: 20 });
  }
  if (sys.brain.status !== 'green') {
    if (m.sleep.status !== 'green') add({ key: 'adapt-sleep', kind: 'add', baseKey: 'sleep', title: 'Light hygiene from 21:30', detail: 'Dim station lights, no screens, eye mask on. Optional 20-min nap before 15:00.', reason: `Sleep ${m.sleep.value} h (goal 7+)`, xp: 30 });
    if (m.mood.status !== 'green' || m.hrv.status !== 'green') add({ key: 'adapt-mind', kind: 'add', title: '10-min breathing + call home', detail: 'Box breathing 4-4-4-4, then a family or crew-support conference.', reason: [m.mood.status !== 'green' && `mood ${m.mood.value}`, m.hrv.status !== 'green' && `HRV ${m.hrv.deviation} % vs baseline`].filter(Boolean).join(' · '), xp: 30 });
  }
  if (m.bp.status !== 'green') add({ key: 'adapt-bp', kind: 'add', baseKey: 'bp', title: 'Re-check blood pressure tonight', detail: m.bp.status === 'red' ? 'If still ≥ 140/90, send the report to the flight surgeon.' : 'Reduce added salt today, re-measure seated.', reason: `BP ${m.bp.value}/${m.bp.value2}`, needsApproval: m.bp.status === 'red', escalate: m.bp.status === 'red', xp: 20 });
  if (m.glucose.status !== 'green') add({ key: 'adapt-glucose', kind: 'add', title: '15-min walk after meals', detail: 'Light activity after eating lowers glucose spikes. Swap one sweet pouch for protein.', reason: `Glucose ${m.glucose.value} mg/dL`, xp: 20 });
  if (m.weight.status !== 'green') add({ key: 'adapt-weight', kind: 'add', title: 'Add a 400 kcal snack', detail: 'Body mass is dropping — eat the full menu plus one extra protein snack.', reason: `Mass ${m.weight.deviation} % vs baseline`, xp: 20 });
  if (m.vitd.status !== 'green') add({ key: 'adapt-vitd', kind: 'escalate', baseKey: 'vitd', title: 'Ask surgeon about vitamin D dose', detail: 'Lab value is low; dosage changes need flight surgeon approval.', reason: `Vitamin D ${m.vitd.value} ng/mL`, needsApproval: true, escalate: true, xp: 10 });
  if (m.co2.status !== 'green' || (d.checkin?.symptoms ?? []).includes('headache')) add({ key: 'adapt-co2', kind: 'add', title: 'Check ventilation at sleep station', detail: 'Make sure the fan is on and nothing blocks airflow. Note headaches in the check-in.', reason: m.co2.status !== 'green' ? `CO₂ ${m.co2.value} mmHg` : 'headache reported', xp: 15 });
  if (m.radiation.status === 'red') add({ key: 'adapt-rad', kind: 'escalate', title: 'Move to shielded module', detail: 'Follow the solar particle event procedure and log your dosimeter.', reason: `Dose ${m.radiation.value} mSv today`, escalate: true, xp: 10 });

  const done = new Set(db.prepare('SELECT task_key FROM task_completions WHERE user_id = ? AND day = ?').all(userId, day).map(r => r.task_key));
  const base = items.map(i => ({ ...i, origin: 'mission', done: done.has(i.key), adaptations: adaptations.filter(a => a.baseKey === i.key).map(a => a.key) }));
  const adapt = adaptations.map(a => ({ ...a, origin: 'perigee', done: done.has(a.key) }));
  const all = [...base, ...adapt];
  return { day, source, items: base, adaptations: adapt, progress: all.length ? all.filter(t => t.done).length / all.length : 0, xpAvailable: all.reduce((s, t) => s + (t.done ? 0 : t.xp), 0), readiness: d.readiness };
}
