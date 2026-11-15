/**
 * Mission health engine. One place that turns telemetry into what the crew sees:
 *   readings (value · source · freshness · confidence · personal baseline from the SAME source/method),
 *   NASA's five hazards (RIDGE), one attention card, "what changed since yesterday",
 *   dose history with coverage gaps, a day-by-day risk timeline and the EVA readiness gates.
 *
 * No demo data: without WHOOP only hand-entered values are shown, everything else is honestly missing.
 * With demo off only real WHOOP values (via the server) are shown — everything else is honestly "missing".
 */
import { useMemo } from 'react';
import { useStore, type AppState } from './store';
import { useCrew } from './crew';
import { useAuth } from '../auth';

export type Fresh = 'received' | 'stale' | 'missing' | 'waiting' | 'error';
export type Tone = 'ok' | 'watch' | 'flag' | 'none';
export type SourceKey = 'whoop' | 'apple' | 'manual' | 'lab' | 'dosimeter' | 'cabin' | 'checkin';
export const SOURCE: Record<SourceKey, string> = { whoop: 'WHOOP', apple: 'Apple Watch', manual: 'Manual entry', lab: 'Lab result', dosimeter: 'Dosimeter', cabin: 'Cabin sensors', checkin: 'Crew check-in' };

export type Reading = {
  key: string; label: string; unit: string; value: number | null; text: string;
  source: SourceKey; at: number | null; fresh: Fresh; demo: boolean; confidence: number; note?: string;
  baseline?: { lo: number; hi: number; label: string }; tone: Tone; series: (number | null)[];
};
export type Hazard = { key: 'R' | 'I' | 'D' | 'G' | 'E'; label: string; long: string; tone: Tone; line: string; signals: string[] };
export type Attention = { tone: Tone; title: string; body: string; action: string; remeasure?: string; signals: string[]; to?: string };
export type Gate = { label: string; ok: boolean; source: string; why: string };

const H = 3600e3, DAY = 24 * H;
const rnd = (i: number, k: number) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const num = (a: (number | null)[]) => a.filter((v): v is number => v != null);
export const fmtH = (h: number) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
export const COMM_DELAY: Record<string, number> = { iss: 0, moon: 0.02, mars: 12, jupiter: 45, deep: 90 };
export const DEST_NAME: Record<string, string> = { iss: 'Earth orbit', moon: 'Moon', mars: 'Mars', jupiter: 'Jupiter', deep: 'Deep space' };

/** Scripted synthetic Mars telemetry, oldest → today (n days). */
function demoSeries(n: number) {
  const last = n - 1;
  const S = (k: number, f: (i: number, r: number) => number | null) => Array.from({ length: n }, (_, i) => f(i, rnd(i, k)));
  const sleep = S(1, (i, r) => (i === last ? 5.8 : i === last - 1 ? 6.67 : i === last - 2 ? 6.2 : 6.9 + r * 0.7));
  const hrv = S(2, (i, r) => (i === last ? 38 : i === last - 1 ? 49 : 51 + r * 6));
  const rhr = S(3, (i, r) => (i === last ? 61 : 57 + r * 2.5));
  const recovery = S(4, (i, r) => (i === last ? 32 : 55 + r * 18));
  const mood = S(5, (i, r) => ([last - 5, last - 2, last].includes(i) ? 52 + r * 6 : 68 + r * 12));
  const dose = S(6, (i, r) => (i === last - 3 ? null : i === last ? 0.51 : i === last - 2 ? 0.49 : 0.39 + r * 0.06));
  const spo2 = S(7, (i, r) => (i >= last - 1 ? null : 97 + Math.round(r)));
  const bp = S(8, (i, r) => (i > last - 4 ? null : i % 3 === 0 ? 116 + Math.round(r * 6) : null));
  const co2 = S(9, (i, r) => 2.5 + r * 0.6);
  const temp = S(10, (i, r) => 22 + r * 0.8);
  const ntx = S(11, i => (i === last - 3 ? 18 : i === Math.round(n * 0.66) ? 9 : i === Math.round(n * 0.33) ? 3 : null));
  const exercise = S(12, (i, r) => (i === last ? null : 30 + Math.round(r * 35)));
  return { sleep, hrv, rhr, recovery, mood, dose, spo2, bp, co2, temp, ntx, exercise };
}

function freshness(at: number | null, staleAfterH: number, now: number): Fresh {
  if (at == null) return 'missing';
  return now - at > staleAfterH * H ? 'stale' : 'received';
}

export function buildMission(st0: AppState, crew: ReturnType<typeof useCrew>, user: { missionGoal?: { dest: string | null } | null; missionYears?: number | null } | null = null, now = Date.now()) {
  // the destination the crew picked at sign-up wins until they edit the mission briefing
  const yrs = user?.missionYears ?? null;
  const fromYears = yrs == null ? null : yrs <= 1 ? 'iss' : yrs <= 2 ? 'moon' : yrs <= 4 ? 'mars' : 'jupiter';
  const signupDest = (user?.missionGoal?.dest ?? fromYears) as AppState['briefing']['dest'] | null;
  const st: AppState = st0.briefing.custom || !signupDest ? st0 : { ...st0, briefing: { ...st0.briefing, dest: signupDest, commDelayMin: COMM_DELAY[signupDest] } };
  const demo = false; // the scripted demo is gone: only WHOOP values and what the crew member types in are shown
  const day = crew.missionDay, n = Math.max(14, Math.min(120, day));
  const todayKey = new Date(now).toISOString().slice(0, 10);
  const D = demoSeries(n);
  // ---- real / hybrid mode: every HMSC source, each day of the window. Nothing is invented: a day without a value stays empty.
  const dayOf = (i: number) => { const d = new Date(now); d.setDate(d.getDate() - (n - 1 - i)); return d.toISOString().slice(0, 10); };
  const hist = (k: 'sleep' | 'hrv' | 'rhr' | 'recovery'): (number | null)[] => { const h = (crew.history[k] ?? []) as (number | null)[]; return Array.from({ length: n }, (_, i) => h[h.length - (n - i)] ?? null); };
  const mood100 = (m: number) => (m - 1) * 25; // 1-5 scales -> 0-100
  const checkMood = (d: string): number | null => { const c = st.checks.filter(x => x.day === d).slice(-1)[0]; if (c) return c.mood; const w = st.wellbeing?.[d]; return w ? mood100(w.mood) : null; };
  const manualAt = (d: string, k: 'sleep' | 'rhr' | 'hrv' | 'exercise' | 'radiation') => (st.manual?.[d]?.[k] ?? null) as number | null;
  const realSeries: Record<string, (number | null)[]> = {
    sleep: hist('sleep').map((v, i) => manualAt(dayOf(i), 'sleep') ?? v), hrv: hist('hrv').map((v, i) => manualAt(dayOf(i), 'hrv') ?? v), rhr: hist('rhr').map((v, i) => manualAt(dayOf(i), 'rhr') ?? v), recovery: hist('recovery'),
    exercise: Array.from({ length: n }, (_, i) => { const m = manualAt(dayOf(i), 'exercise'); if (m != null) return m; const w = i >= n - 7 ? (crew.series.workoutMin[i - (n - 7)] as number | null) : null; const done = (st.completed[dayOf(i)] ?? []).length; return w ?? (done ? done * 30 : null); }),
    dose: Array.from({ length: n }, (_, i) => (crew.dosePerDay as Record<string, number>)[dayOf(i)] ?? manualAt(dayOf(i), 'radiation')),
    mood: Array.from({ length: n }, (_, i) => checkMood(dayOf(i))),
  };
  const sampleData = !demo && crew.isSample && !crew.handMode; // the server's demo dataset: shown, but labelled
  const pick = (k: keyof typeof D): (number | null)[] => (demo ? D[k] : realSeries[k] ?? Array(n).fill(null));
  const lastIdx = (a: (number | null)[]) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return i; return -1; };
  const atOf = (i: number, hour: number) => (i < 0 ? null : now - (n - 1 - i) * DAY - (new Date(now).getHours() - hour) * H);
  const baselineOf = (a: (number | null)[], label: string, k = 1.2) => { const b = num(a.slice(0, 14)); if (b.length < 5) return undefined; const m = mean(b), s = Math.max(sd(b), m * 0.03); return { lo: +(m - k * s).toFixed(1), hi: +(m + k * s).toFixed(1), label }; };

  const make = (key: string, label: string, unit: string, src: SourceKey, hour: number, staleH: number, fmt: (v: number) => string,
    toneOf: (v: number, b?: { lo: number; hi: number }) => Tone, opts: { conf?: number; note?: string; base?: boolean; waiting?: boolean } = {}): Reading => {
    let series = pick(key as keyof typeof D);
    let i = lastIdx(series);
    let at = atOf(i, hour), value = i >= 0 ? (series[i] as number) : null, source = src, conf = opts.conf ?? 92, note = opts.note;
    const rm = st.remeasure[key];
    if (rm && new Date(rm.at).toISOString().slice(0, 10) === todayKey) { // a repeat measurement replaces today's value (same device)
      value = rm.value; at = rm.at; conf = 95; note = 'Re-measured today'; series = [...series.slice(0, -1), rm.value];
    }
    const baseline = opts.base === false ? undefined : baselineOf(series, `${SOURCE[source]} ${label} · first 14 days`);
    let fresh = opts.waiting && i !== n - 1 ? 'waiting' as Fresh : freshness(at, staleH, now);
    if (key === 'dose' && st.spe && demo) fresh = 'received';
    return { key, label, unit, value, text: value == null ? '—' : fmt(value), source, at, fresh, demo: demo || (sampleData && ['sleep', 'hrv', 'rhr', 'recovery', 'exercise', 'dose'].includes(key)), confidence: value == null ? 0 : conf, note,
      baseline, tone: value == null ? 'none' : toneOf(value, baseline), series };
  };
  const band = (v: number, b?: { lo: number; hi: number }, low = true, high = true): Tone =>
    !b ? 'ok' : (low && v < b.lo - (b.hi - b.lo) * 0.6) || (high && v > b.hi + (b.hi - b.lo) * 0.6) ? 'flag' : (low && v < b.lo) || (high && v > b.hi) ? 'watch' : 'ok';

  const readings: Record<string, Reading> = {
    sleep: make('sleep', 'Sleep', 'h', 'whoop', 6, 30, fmtH, v => (v < 6 ? 'watch' : 'ok'), { base: true }),
    hrv: make('hrv', 'HRV', 'ms', 'whoop', 6, 30, v => `${Math.round(v)} ms`, (v, b) => band(v, b, true, false), { conf: demo ? 72 : 90, note: demo ? 'Loose strap during the reading' : undefined }),
    rhr: make('rhr', 'Resting HR', 'bpm', 'whoop', 6, 30, v => `${Math.round(v)} bpm`, (v, b) => band(v, b, false, true)),
    recovery: make('recovery', 'Recovery', '%', 'whoop', 6, 30, v => `${Math.round(v)}%`, v => (v < 34 ? 'watch' : 'ok'), { base: false }),
    spo2: make('spo2', 'SpO₂', '%', 'manual', 8, 30, v => `${Math.round(v)}%`, v => (v < 92 ? 'flag' : v < 95 ? 'watch' : 'ok'), { base: false }),
    bp: make('bp', 'Blood pressure', 'mmHg', 'manual', 8, 72, v => `${Math.round(v)}`, v => (v >= 140 ? 'flag' : v >= 130 ? 'watch' : 'ok'), { base: false }),
    mood: make('mood', 'Mood', '/100', 'checkin', 8, 30, v => `${Math.round(v)}`, v => (v < 55 ? 'watch' : 'ok'), { base: false }),
    dose: make('dose', 'Radiation dose', 'mSv', 'dosimeter', 4, 30, v => `${v.toFixed(2)} mSv`, (v, b) => band(v, b, false, true)),
    co2: make('co2', 'Cabin CO₂', 'mmHg', 'cabin', new Date(now).getHours(), 2, v => `${v.toFixed(1)} mmHg`, v => (v > 4 ? 'flag' : v > 3.3 ? 'watch' : 'ok'), { base: false }),
    temp: make('temp', 'Cabin temp', '°C', 'cabin', new Date(now).getHours(), 2, v => `${v.toFixed(1)} °C`, () => 'ok', { base: false }),
    ntx: make('ntx', 'Bone marker NTx', '% vs baseline', 'lab', 10, 48, v => `+${Math.round(v)}%`, v => (v >= 15 ? 'flag' : v >= 8 ? 'watch' : 'ok'), { base: false }),
    exercise: make('exercise', 'Exercise', 'min', 'apple', 20, 30, v => `${Math.round(v)} min`, v => (v < 30 ? 'watch' : 'ok'), { base: false, waiting: true }),
  };
  // the daily check can supply manual values (SpO₂, BP) and mood
  const todayCheck = st.checks.filter(c => c.day === todayKey).slice(-1)[0];
  if (todayCheck) {
    for (const [k, v] of Object.entries(todayCheck.manual)) if (k !== 'bp2' && readings[k]) Object.assign(readings[k], { value: v, text: k === 'bp' ? `${v}/${todayCheck.manual.bp2 ?? '—'}` : `${v}${readings[k].unit === '%' ? '%' : ''}`, at: todayCheck.at, fresh: 'received', confidence: 88, tone: k === 'spo2' ? (v < 92 ? 'flag' : v < 95 ? 'watch' : 'ok') : v >= 140 ? 'flag' : v >= 130 ? 'watch' : 'ok' });
    Object.assign(readings.mood, { value: todayCheck.mood, text: String(todayCheck.mood), at: todayCheck.at, fresh: 'received', tone: todayCheck.mood < 55 ? 'watch' : 'ok', note: todayCheck.moodPrivate ? 'Private · stays on this device' : undefined });
  }
  const symptoms: string[] = demo ? ['vision', 'knee'] : [];
  for (const x of crew.manualToday?.symptoms ?? []) { const l = x.toLowerCase(); const k = l.includes('vision') ? 'vision' : l.includes('head') ? 'headache' : l.includes('chest') ? 'chest_pain' : l.includes('dizz') || l.includes('faint') ? 'dizziness' : l.includes('knee') ? 'knee' : null; if (k && !symptoms.includes(k)) symptoms.push(k); }
  if (todayCheck) for (const s of todayCheck.symptoms) if (!symptoms.includes(s)) symptoms.push(s);

  // ---------------------------------------------------------------- radiation
  const doseS = readings.dose.series;
  const doseNums = num(doseS);
  const avg = doseNums.length ? mean(doseNums) : 0;
  const total = +(doseNums.reduce((a, b) => a + b, 0) + (demo ? avg * Math.max(0, day - n) : 0)).toFixed(1);
  const gaps = doseS.map((v, i) => (v == null ? i : -1)).filter(i => i >= 0 && i > n - 15);
  const week = doseS.slice(-7);
  const radiation = { total, limit: 600, avg, week, interval: +num(week).reduce((a, b) => a + b, 0).toFixed(2), gaps: gaps.map(i => n - 1 - i), today: readings.dose.value, spe: st.spe };

  // ---------------------------------------------------------------- hazards (NASA RIDGE)
  const moodS = readings.mood.series.slice(-7), lowMood = num(moodS).filter(v => v < 58).length;
  const missing = Object.values(readings).filter(r => r.fresh === 'missing' || r.fresh === 'stale').length;
  const queued = st.handoffs.filter(h => !h.ackAt && !h.sentAt).length;
  const delay = st.briefing.commDelayMin;
  const worst = (...t: Tone[]): Tone => (t.includes('flag') ? 'flag' : t.includes('watch') ? 'watch' : t.every(x => x === 'none') ? 'none' : 'ok');
  const hazards: Hazard[] = [
    { key: 'R', label: 'Radiation', long: 'Space radiation', tone: st.spe ? 'flag' : readings.dose.value == null ? 'none' : readings.dose.value > avg * 1.12 ? 'watch' : 'ok',
      line: readings.dose.value == null ? 'No dosimeter reading' : `${total} mSv total · today ${readings.dose.text}${st.spe ? ' · solar event' : readings.dose.value > avg * 1.12 ? ' (above average)' : ''}`, signals: ['dose'] },
    { key: 'I', label: 'Isolation', long: 'Isolation & confinement', tone: readings.mood.value == null ? 'none' : lowMood >= 3 || (readings.sleep.value ?? 8) < 6 ? 'watch' : 'ok',
      line: readings.mood.value == null ? 'No mood check yet' : `Lower mood ${lowMood} of 7 days${(readings.sleep.value ?? 8) < 6.5 ? ' · sleep shorter' : ''}`, signals: ['mood', 'sleep'] },
    { key: 'D', label: 'Distance', long: 'Distance from Earth', tone: missing > 4 || queued > 1 ? 'watch' : 'ok',
      line: `${delay >= 1 ? `${delay} min one-way` : 'Live link'} · ${queued} report${queued === 1 ? '' : 's'} waiting · ${missing} values missing`, signals: ['spo2', 'bp'] },
    { key: 'G', label: 'Gravity', long: 'Altered gravity', tone: worst(readings.ntx.tone, symptoms.includes('vision') ? 'flag' : 'ok'),
      line: [readings.ntx.value != null ? `Bone marker NTx ${readings.ntx.text}` : 'No bone lab yet', symptoms.includes('vision') ? 'vision symptom reported' : ''].filter(Boolean).join(' · '), signals: ['ntx', 'exercise'] },
    { key: 'E', label: 'Environment', long: 'Closed environment', tone: worst(readings.co2.tone, symptoms.includes('headache') ? 'watch' : 'ok'),
      line: readings.co2.value == null ? 'No cabin data' : `CO₂ ${readings.co2.text} · ${readings.temp.text}`, signals: ['co2', 'temp'] },
  ];

  // ---------------------------------------------------------------- attention card: several signals → one explanation, one action
  const hrvLow = readings.hrv.tone !== 'ok' && readings.hrv.tone !== 'none', sleepShort = (readings.sleep.value ?? 9) < 6.2, doseUp = hazards[0].tone !== 'ok' && hazards[0].tone !== 'none';
  let attention: Attention | null = null;
  if (st.spe) attention = { tone: 'flag', title: 'Solar particle event — go to shelter', body: 'NASA DONKI reports a solar particle event. Move to the radiation shelter before the countdown ends.', action: 'Open the shelter checklist', signals: ['dose'], to: '/radiation' };
  else if (hrvLow && sleepShort) {
    const b = readings.hrv.baseline, pct = b ? Math.round(((readings.hrv.value! - (b.lo + b.hi) / 2) / ((b.lo + b.hi) / 2)) * 100) : 0;
    attention = { tone: 'flag', title: 'Your body is under-recovered',
      body: `Short sleep (${readings.sleep.text}), HRV ${readings.hrv.text} (${pct}% vs your WHOOP baseline)${doseUp ? ' and a higher dose day' : ''} point the same way.`,
      action: '20 min rest before EVA prep. Keep today’s cycle session in zone 2.', remeasure: readings.hrv.confidence < 85 ? 'hrv' : undefined, signals: ['sleep', 'hrv', 'dose'] };
  } else if (hazards[3].tone === 'flag') attention = { tone: 'flag', title: 'Bone loss marker rising', body: `${readings.ntx.text} vs your pre-flight baseline${symptoms.includes('vision') ? ', and a new vision symptom' : ''}. Both belong to altered gravity.`, action: 'Add +1 km loaded treadmill today and send the vision note to your flight surgeon.', signals: ['ntx'], to: '/report' };
  else { const w = hazards.find(h => h.tone === 'watch'); if (w) attention = { tone: 'watch', title: `${w.long}: keep an eye on it`, body: w.line, action: 'Log today’s check to keep the picture complete.', signals: w.signals, to: '/check' }; }

  // ---------------------------------------------------------------- since yesterday
  // amount = size of the change in display units (for count-ups); worse = the change goes the unhealthy way
  const diff = (r: Reading, minAbs: number, k: number, unit: string, dec: number, worseWhenUp: boolean) => {
    const s = r.series, a = s[s.length - 1], b = s[s.length - 2];
    if (a == null || b == null || Math.abs(a - b) < minAbs) return null;
    const amount = Math.abs(a - b) * k;
    return { key: r.key, label: r.label, up: a > b, amount, unit, dec, worse: worseWhenUp ? a > b : a < b,
      text: `${r.label} ${a > b ? '+' : '−'}${amount.toFixed(dec)}${unit ? ' ' + unit : ''}` };
  };
  const changes = [diff(readings.sleep, 0.2, 60, 'min', 0, false), diff(readings.hrv, 3, 1, 'ms', 0, false), diff(readings.dose, 0.03, 1, 'mSv', 2, true), diff(readings.mood, 6, 1, '', 0, false)]
    .filter(Boolean) as { key: string; label: string; up: boolean; amount: number; unit: string; dec: number; worse: boolean; text: string }[];

  // ---------------------------------------------------------------- risk timeline (per hazard, per day: 0 ok · 1 watch · 2 flag · -1 none)
  const T = (f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
  const ntxAt = (i: number) => { let v: number | null = null; for (let j = 0; j <= i; j++) if (D.ntx[j] != null) v = D.ntx[j]; return v ?? 0; };
  const timeline = !demo ? null : {
    R: T(i => (D.dose[i] == null ? -1 : (D.dose[i] as number) > avg * 1.12 ? 1 : 0)),
    I: T(i => (num(D.mood.slice(Math.max(0, i - 6), i + 1)).filter(v => v < 58).length >= 3 ? 1 : 0)),
    D: T(() => 0),
    G: T(i => (ntxAt(i) >= 15 ? 2 : ntxAt(i) >= 8 ? 1 : 0)),
    E: T(i => ((D.co2[i] as number) > 3.3 ? 1 : 0)),
  };

  // ---------------------------------------------------------------- EVA readiness
  const nextEva = [...st.briefing.evaDates].sort().find(d => d >= todayKey) ?? null;
  const sl = num(readings.sleep.series.slice(-2));
  const gates: Gate[] = [
    { label: 'Sleep last 2 nights', ok: sl.length === 2 && sl.every(v => v >= 6), source: 'WHOOP', why: sl.length ? `${sl.map(fmtH).join(', ')} · need 6h+` : 'No sleep data' },
    { label: 'Heart & HRV in range', ok: readings.hrv.tone === 'ok' && readings.rhr.tone !== 'flag', source: 'WHOOP', why: `HRV ${readings.hrv.text} · RHR ${readings.rhr.text}` },
    { label: 'Dose below EVA limit', ok: !st.spe && (readings.dose.value ?? 0) < 1, source: 'Dosimeter', why: st.spe ? 'Solar particle event in progress' : `Today ${readings.dose.text} · limit 1 mSv/day` },
    { label: 'No red symptoms', ok: !symptoms.some(s => ['vision', 'chest_pain', 'dizziness'].includes(s)), source: 'Check-in', why: symptoms.includes('vision') ? 'New vision symptom' : 'None reported' },
  ];

  return { demo, day, n, readings, hazards, attention, changes, radiation, timeline, gates, nextEva, symptoms, delay, dest: st.briefing.dest, missing, queued };
}

export function useMission() {
  const st = useStore(s => s);
  const crew = useCrew();
  const { user } = useAuth();
  return useMemo(() => buildMission(st, crew, user as any), [st, crew, user]);
}

export const toneOrder: Record<Tone, number> = { flag: 0, watch: 1, ok: 2, none: 3 };
export const freshWord: Record<Fresh, string> = { received: 'Received', stale: 'Stale', missing: 'Missing', waiting: 'Waiting to sync', error: 'Error' };
export const ago = (at: number | null) => {
  if (at == null) return '';
  const m = Math.round((Date.now() - at) / 60e3);
  return m < 60 ? `${Math.max(1, m)} min` : m < 36 * 60 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} days`;
};
