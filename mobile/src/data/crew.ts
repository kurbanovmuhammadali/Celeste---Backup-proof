/**
 * Crew health view-model: merges the server dashboard (WHOOP / demo measurements) with clearly-labelled
 * sample values for signals the server does not store yet (workout heart rate). Works offline with samples.
 */
import { useMemo } from 'react';
import { useApi } from '../useApi';
import type { Dashboard, Snap } from '../types';
import { dayKey, todayKey, useStore } from './store';
import { computeStress } from './stress';
import { SCENARIO } from './scenario';
import { entriesToPerDay, radiationSummary, scenarioPerDay, seriesToPerDay } from './radiation';

export type DayView = {
  key: string; label: string; short: string; date: Date;
  recovery: number | null; sleep: number | null; hrv: number | null; rhr: number | null; workoutHr: number | null; workoutMin: number | null; dose: number | null;
  steps: number | null; kcal: number | null;
};

/** No sample values anywhere: without WHOOP (or hand entries) every series is empty and the screens say so. */
const none = (n: number) => Array(n).fill(null) as (number | null)[];
const SAMPLE = { recovery: none(7), sleep: none(7), hrv: none(7), rhr: none(7), workoutHr: none(7), workoutMin: none(7), dose: none(7), steps: none(7), kcal: none(7) };

/** Active calories for the last 28 days (oldest first) — sample until Apple Health activity is connected. */
export const ACTIVITY_28: (number | null)[] = Array(28).fill(null);

const pad7 = (a: (number | null)[] | undefined, fallback: (number | null)[]) => {
  if (!a || !a.length || a.every(v => v == null)) return fallback.slice();
  const s = a.slice(-7);
  return [...Array(Math.max(0, 7 - s.length)).fill(null), ...s];
};

export const fmtSleep = (h: number | null | undefined) => (h == null ? '—' : `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`);

export function useCrew() {
  const { data, error, reload, loading } = useApi<Dashboard>('/api/dashboard');
  const profile = useStore(s => s.profile);
  const judge = useStore(s => !!s.judge);
  const manual = useStore(s => s.manual);
  const radEntries = useStore(s => s.radiation);
  const dataMode = useStore(s => s.dataMode);
  return useMemo(() => {
    const m: Record<string, Snap> = data?.metrics ?? {};
    const sampleOnly = !data;
    const src = (k: string) => (m[k]?.source && m[k].source !== 'demo' ? m[k].source! : 'sample');
    const series = {
      recovery: pad7(m.recovery?.spark, SAMPLE.recovery), sleep: pad7(m.sleep?.spark, SAMPLE.sleep), hrv: pad7(m.hrv?.spark, SAMPLE.hrv),
      rhr: pad7(m.rhr?.spark, SAMPLE.rhr), workoutMin: pad7(m.exercise?.spark ? m.exercise.spark.map(v => (v == null ? null : Math.round(v / 4))) : undefined, SAMPLE.workoutMin),
      workoutHr: none(7), dose: pad7(m.radiation?.spark, SAMPLE.dose),
      steps: none(7), kcal: none(7),
    };
    // Full-length history (oldest → newest) for personal baselines. Server sparks keep more than 7 days.
    const hist = (k: string, fb: (number | null)[]): (number | null)[] => (m[k]?.spark?.some(v => v != null) ? m[k].spark : [...none(21), ...fb]);
    const history = { recovery: hist('recovery', SAMPLE.recovery), sleep: hist('sleep', SAMPLE.sleep), hrv: hist('hrv', SAMPLE.hrv), rhr: hist('rhr', SAMPLE.rhr) };
    const handMode = dataMode === 'manual' && !judge;
    if (handMode) { // data by hand: only what the crew member typed in. No sample or demo values, gaps stay gaps.
      const mk = (k: 'sleep' | 'rhr' | 'hrv') => Array.from({ length: 28 }, (_, i) => manual[dayKey(i - 27)]?.[k] ?? null);
      history.sleep = mk('sleep'); history.rhr = mk('rhr'); history.hrv = mk('hrv'); history.recovery = Array(28).fill(null);
      series.sleep = history.sleep.slice(-7); series.rhr = history.rhr.slice(-7); series.hrv = history.hrv.slice(-7); series.recovery = Array(7).fill(null);
      series.workoutMin = Array.from({ length: 7 }, (_, i) => manual[dayKey(i - 6)]?.exercise ?? null);
      series.workoutHr = Array(7).fill(null); series.dose = Array(7).fill(null);
    }
    if (judge) { // synthetic Mars scenario replaces the numbers everywhere (clearly labelled in the UI)
      const last7 = (a: (number | null)[]) => a.slice(-7);
      series.recovery = last7(SCENARIO.recovery); series.sleep = last7(SCENARIO.sleep); series.hrv = last7(SCENARIO.hrv);
      series.rhr = last7(SCENARIO.rhr); series.workoutMin = last7(SCENARIO.workoutMin);
      history.recovery = SCENARIO.recovery; history.sleep = SCENARIO.sleep; history.hrv = SCENARIO.hrv; history.rhr = SCENARIO.rhr;
    }
    const man = judge ? null : manual[todayKey()] ?? null;
    const manualSrc = { sleep: false, rhr: false };
    if (man) { // a manual measurement for today beats sensor data and is labelled "manual"
      if (man.sleep != null) { series.sleep[6] = man.sleep; history.sleep = [...history.sleep.slice(0, -1), man.sleep]; manualSrc.sleep = true; }
      if (man.rhr != null) { series.rhr[6] = man.rhr; history.rhr = [...history.rhr.slice(0, -1), man.rhr]; manualSrc.rhr = true; }
      if (man.exercise != null) series.workoutMin[6] = man.exercise;
    }
    const days: DayView[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() + i - 6);
      return {
        key: d.toISOString().slice(0, 10), date: d,
        label: i === 6 ? `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        short: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        recovery: series.recovery[i], sleep: series.sleep[i], hrv: series.hrv[i], rhr: series.rhr[i], workoutHr: series.workoutHr[i], workoutMin: series.workoutMin[i], dose: series.dose[i], steps: series.steps[i], kcal: series.kcal[i],
      };
    });
    const start = new Date(profile.missionStart + 'T00:00:00');
    const missionDay = Math.max(1, Math.floor((Date.now() - start.getTime()) / 864e5) + 1);
    const duration = Number(profile.duration) || 180;
    const doses = series.dose.filter((v): v is number => v != null);
    const avgDose = doses.length ? doses.reduce((a, b) => a + b, 0) / doses.length : 0;
    // Cumulative dose is only shown when every mission day has a reading; otherwise null ("Cumulative dose unavailable").
    const serverRad = !!m.radiation?.source && m.radiation.source !== 'demo';
    const perDay = judge ? scenarioPerDay(missionDay) : radEntries.length ? entriesToPerDay(radEntries) : handMode ? {} : seriesToPerDay(series.dose);
    const radSource = judge ? 'synthetic' : radEntries.length || serverRad || handMode ? 'dosimeter' : 'demo';
    const lastAt = judge ? Date.now() : radEntries.length ? Math.max(...radEntries.map(e => e.at)) : Date.now();
    const radiation = radiationSummary(perDay, missionDay, radSource, lastAt);
    const doseTotal = radiation.cumulative;
    const isSample = false; // there is no sample data any more
    const stress = computeStress(history, man);
    const hrvSrc = judge ? 'synthetic' : src('hrv');
    const hrvMethod = hrvSrc.toLowerCase().includes('whoop') ? 'RMSSD (WHOOP)' : judge ? 'RMSSD (synthetic)' : 'RMSSD (sample)';
    return {
      loading: loading && !data, error, reload, raw: data, dosePerDay: perDay, days, series, history, missionDay, duration, doseTotal, avgDose, isSample, radiation,
      synthetic: judge, manualToday: man, hrvMethod, stress, handMode,
      source: judge ? { recovery: 'synthetic', sleep: 'synthetic', hrv: 'synthetic', rhr: 'synthetic' }
        : handMode ? { recovery: 'manual', sleep: 'manual', hrv: 'manual', rhr: 'manual' }
        : { recovery: src('recovery'), sleep: manualSrc.sleep ? 'manual' : src('sleep'), hrv: src('hrv'), rhr: manualSrc.rhr ? 'manual' : src('rhr') },
      alerts: judge || handMode ? [] : data?.alerts ?? [], systems: data?.systems ?? [],
    };
  }, [data, error, loading, profile.missionStart, profile.duration, judge, manual, radEntries, dataMode]);
}

// ----------------------------------------------------------------------------- body systems
export type LayerKey = 'overview' | 'circulatory' | 'nervous' | 'skin' | 'digestive' | 'muscular' | 'skeletal';
export const LAYERS: { key: LayerKey; label: string; topic: string; text: string; rows: [string, string][] }[] = [
  { key: 'overview', label: 'Overview', topic: 'Whole body · system layers', text: 'Recorded findings appear as markers. Areas without data stay unmarked.', rows: [] },
  { key: 'circulatory', label: 'Circulatory', topic: 'Heart & blood vessels', text: 'Resting heart rate and HRV compared with your own baseline. Blood pressure comes from a cuff reading.', rows: [['Resting heart rate', 'WHOOP'], ['HRV', 'WHOOP'], ['Blood pressure', 'Cuff reading']] },
  { key: 'nervous', label: 'Nervous', topic: 'Brain, spinal cord & nerves', text: 'Reported headache, balance and vision changes. A clinical eye exam is a separate source.', rows: [['Balance check', 'Crew check-in'], ['Vision exam', 'Flight surgeon']] },
  { key: 'skin', label: 'Skin', topic: 'Skin & surface temperature', text: 'Overnight skin temperature and reported skin changes.', rows: [['Skin temperature', 'WHOOP'], ['Skin changes', 'Crew check-in']] },
  { key: 'digestive', label: 'Digestive', topic: 'Digestion & nutrition', text: 'Appetite and digestive symptoms from crew check-ins.', rows: [['Appetite', 'Crew check-in'], ['Body mass', 'Mass measurement device']] },
  { key: 'muscular', label: 'Muscular', topic: 'Muscles & strength', text: 'Resistance sessions and exercise logs during microgravity exposure.', rows: [['Resistance', 'Training log'], ['Strength test', 'Assessment']] },
  { key: 'skeletal', label: 'Skeletal', topic: 'Bones & loading', text: 'Loading sessions and clinician-provided bone assessments.', rows: [['Exercise loading', 'Training log'], ['Bone marker', 'Lab result']] },
];

/** `at` = marker position on the glass-body image (x, y as fractions of its width / height). `pos` = legacy 3D point. */
export type Finding = { id: string; label: string; title: string; sub: string; tone: 'ok' | 'watch' | 'flag'; pos: [number, number, number]; at: [number, number]; layers: LayerKey[]; route?: string };
export function findings(rhr: number | null): Finding[] {
  return [
    { id: 'mood', label: 'Brain', title: 'Mood & sleep', sub: 'Lower mood 3 of 7 days · check-in', tone: 'watch', pos: [0, 1.66, 0], at: [0.5, 0.035], layers: ['overview', 'nervous'], route: '/checkin' },
    { id: 'vision', label: 'Vision', title: 'Vision check', sub: 'New symptom · crew medical flag', tone: 'flag', pos: [0.032, 1.585, 0.105], at: [0.5, 0.075], layers: ['overview', 'nervous', 'skin'], route: '/checkin' },
    { id: 'heart', label: 'Heart', title: 'Resting heart rate', sub: `${rhr ?? 61} bpm · within personal baseline`, tone: 'ok', pos: [0.03, 1.29, 0.06], at: [0.535, 0.205], layers: ['overview', 'circulatory', 'muscular', 'skeletal'], route: '/signals' },
    { id: 'bone', label: 'Bone', title: 'Bone loss marker', sub: 'NTx +18% vs baseline · lab result', tone: 'watch', pos: [0, 0.95, 0], at: [0.5, 0.465], layers: ['overview', 'skeletal'], route: '/metric/ntx' },
    { id: 'knee', label: 'Knee', title: 'Right knee', sub: 'Discomfort · crew check-in', tone: 'watch', pos: [-0.095, 0.5, 0.045], at: [0.39, 0.72], layers: ['overview', 'muscular', 'skeletal', 'skin'], route: '/checkin' },
  ];
}
