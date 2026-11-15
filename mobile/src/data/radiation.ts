/**
 * Radiation module logic. Four different numbers, never mixed up:
 *   rate        mSv per day on the most recent covered day
 *   interval    dose over the last 7 days (only covered days are counted, `intervalDays` says how many)
 *   cumulative  total mission dose: ONLY when every mission day has a reading; otherwise null ("Cumulative dose unavailable")
 *   context     NASA DONKI space-weather events: environment context, not personal dose (see donki.ts)
 */
import { dayKey } from './store';
import type { RadEntry } from './store';
import { scenarioDose } from './scenario';

export type RadSource = 'dosimeter' | 'demo' | 'synthetic' | 'none';
export type RadSummary = {
  source: RadSource; rate: number | null; interval: number | null; intervalDays: number;
  cumulative: number | null; coveredDays: number; missionDay: number; missing: number; lastAt: number | null;
};

const dayMs = 864e5;
const parse = (k: string) => new Date(k + 'T00:00:00Z').getTime();

/** Spread each dosimeter interval evenly over its days (latest entry wins when intervals overlap). */
export function entriesToPerDay(entries: RadEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  [...entries].sort((a, b) => a.at - b.at).forEach(e => {
    const a = parse(e.fromDay), b = parse(e.toDay);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return;
    const n = Math.round((b - a) / dayMs) + 1;
    for (let i = 0; i < n; i++) out[new Date(a + i * dayMs).toISOString().slice(0, 10)] = e.mSv / n;
  });
  return out;
}

/** Full daily history of the synthetic crew (judge demo). */
export function scenarioPerDay(missionDay: number): Record<string, number> {
  const out: Record<string, number> = {};
  scenarioDose(missionDay).forEach((v, i) => { out[dayKey(-(missionDay - 1 - i))] = v; });
  return out;
}

/** Last 7 days of a demo series (server demo dataset) as a per-day map. */
export function seriesToPerDay(dose: (number | null)[]): Record<string, number> {
  const out: Record<string, number> = {};
  dose.forEach((v, i) => { if (v != null) out[dayKey(i - (dose.length - 1))] = v; });
  return out;
}

export function radiationSummary(perDay: Record<string, number>, missionDay: number, source: RadSource, lastAt: number | null): RadSummary {
  const days = Array.from({ length: missionDay }, (_, i) => dayKey(-(missionDay - 1 - i)));
  const covered = days.filter(d => perDay[d] != null);
  const last7 = days.slice(-7).filter(d => perDay[d] != null);
  const latest = [...covered].pop();
  const complete = covered.length === missionDay && missionDay > 0;
  return {
    source: covered.length ? source : 'none',
    rate: latest ? +perDay[latest].toFixed(2) : null,
    interval: last7.length ? +last7.reduce((a, d) => a + perDay[d], 0).toFixed(2) : null,
    intervalDays: last7.length,
    cumulative: complete ? +covered.reduce((a, d) => a + perDay[d], 0).toFixed(1) : null,
    coveredDays: covered.length, missionDay, missing: missionDay - covered.length, lastAt,
  };
}
