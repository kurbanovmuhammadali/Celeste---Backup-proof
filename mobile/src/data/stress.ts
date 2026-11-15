/**
 * Stress load for isolation and wellbeing tracking.
 * WHOOP's own Stress Monitor score is not something HMSC can read: the WHOOP developer API exposes recovery, sleep,
 * cycles (strain), workouts and body measurements. So the load is DERIVED from those WHOOP signals against your own
 * baseline (lower HRV, higher resting HR, short sleep, low recovery), or entered by hand (1-5). It is labelled as
 * derived everywhere. If WHOOP ever exposes a stress score, replace `derive` here and keep the rest.
 */
import type { ManualEntry } from './store';

export type StressLevel = 'low' | 'moderate' | 'high' | 'none';
export type StressSummary = { today: number | null; level: StressLevel; series: (number | null)[]; highDays: number; basis: 'manual' | 'derived' | 'none'; note: string };
type H = { recovery: (number | null)[]; sleep: (number | null)[]; hrv: (number | null)[]; rhr: (number | null)[] };

const nums = (a: (number | null)[]) => a.filter((v): v is number => v != null);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const stressLevel = (s: number | null): StressLevel => (s == null ? 'none' : s < 35 ? 'low' : s < 60 ? 'moderate' : 'high');
export const STRESS_WORD: Record<StressLevel, string> = { low: 'Low', moderate: 'Moderate', high: 'High', none: 'No data' };

/** 0-100 for the day at index i using only the days before it as baseline (needs >= 5 of them). */
function derive(h: H, i: number): number | null {
  const base = (a: (number | null)[]) => nums(a.slice(Math.max(0, i - 14), i));
  const parts: [number, number][] = []; // [weight, 0..1]
  const bh = base(h.hrv), br = base(h.rhr), bs = base(h.sleep);
  if (h.hrv[i] != null && bh.length >= 5) parts.push([40, clamp((mean(bh) - (h.hrv[i] as number)) / mean(bh) / 0.25)]);
  if (h.rhr[i] != null && br.length >= 5) parts.push([25, clamp(((h.rhr[i] as number) - mean(br)) / 10)]);
  if (h.sleep[i] != null && bs.length >= 5) parts.push([20, clamp((mean(bs) - (h.sleep[i] as number)) / 2)]);
  if (h.recovery[i] != null) parts.push([15, clamp((67 - (h.recovery[i] as number)) / 40)]);
  if (parts.length < 2) return null;
  const w = parts.reduce((a, [x]) => a + x, 0);
  return Math.round((parts.reduce((a, [x, v]) => a + x * v, 0) / w) * 100);
}

export function computeStress(h: H, manualToday?: ManualEntry | null): StressSummary {
  const n = h.sleep.length;
  const series = Array.from({ length: 7 }, (_, k) => derive(h, n - 7 + k));
  let basis: StressSummary['basis'] = series[6] == null ? 'none' : 'derived';
  if (manualToday?.stress != null) { series[6] = manualToday.stress * 20 - 10; basis = 'manual'; }
  const today = series[6];
  const highDays = series.filter(v => v != null && v >= 60).length;
  const note = basis === 'manual' ? 'Entered by hand (1 to 5).' : basis === 'derived' ? 'Derived from your WHOOP HRV, resting heart rate, sleep and recovery against your own baseline. WHOOP\'s own stress score is not available to apps.' : 'Not enough data yet: enter a stress level or add a few days of data.';
  return { today, level: stressLevel(today), series, highDays, basis, note };
}
