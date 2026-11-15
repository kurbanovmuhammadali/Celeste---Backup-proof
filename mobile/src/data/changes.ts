/**
 * What changed since yesterday: only meaningful changes, in one short list. Quiet days say so.
 */
import type { useCrew } from './crew';
import { counts } from './mealchecks';
import { dayKey, getStore } from './store';
import type { Wellbeing } from './store';

type Crew = ReturnType<typeof useCrew>;
export type Change = { tone: 'watch' | 'flag' | 'ok'; text: string };

const r0 = (v: number) => Math.round(v);
export function whatChanged(crew: Crew, well: Record<string, Wellbeing> | undefined): { items: Change[]; basis: string } {
  const t = crew.days[6], y = crew.days[5];
  const out: Change[] = [];
  const both = (a: number | null, b: number | null) => a != null && b != null;
  if (t.sleep == null) out.push({ tone: 'watch', text: 'No sleep reading for last night.' });
  else if (both(t.sleep, y.sleep) && y.sleep! - t.sleep >= 1) out.push({ tone: t.sleep < 5.5 ? 'flag' : 'watch', text: `Sleep fell by ${(y.sleep! - t.sleep).toFixed(1)} h (${y.sleep!.toFixed(1)} → ${t.sleep.toFixed(1)} h).` });
  if (both(t.hrv, y.hrv)) { const p = ((t.hrv! - y.hrv!) / y.hrv!) * 100; if (p <= -10) out.push({ tone: p <= -20 ? 'flag' : 'watch', text: `HRV is down ${r0(-p)}% (${r0(y.hrv!)} → ${r0(t.hrv!)} ms, ${crew.hrvMethod}).` }); }
  if (both(t.rhr, y.rhr) && t.rhr! - y.rhr! >= 4) out.push({ tone: t.rhr! - y.rhr! >= 8 ? 'flag' : 'watch', text: `Resting heart rate is up ${r0(t.rhr! - y.rhr!)} bpm (${r0(y.rhr!)} → ${r0(t.rhr!)}).` });
  if (both(t.recovery, y.recovery) && y.recovery! - t.recovery! >= 15) out.push({ tone: 'watch', text: `Recovery dropped ${r0(y.recovery! - t.recovery!)} points (${r0(y.recovery!)} → ${r0(t.recovery!)}%).` });
  const sym = crew.synthetic ? ['Headache'] : crew.manualToday?.symptoms ?? [];
  if (sym.length) out.push({ tone: 'watch', text: `New symptom reported today: ${sym.join(', ').toLowerCase()}.` });
  if (!crew.synthetic) {
    const s = getStore(), yTrain = (s.completed[dayKey(-1)] ?? []).length + s.workouts.filter(w => new Date(w.at).toISOString().slice(0, 10) === dayKey(-1)).length;
    if (!yTrain && !(y.workoutMin && y.workoutMin > 0)) out.push({ tone: 'watch', text: 'No training was logged yesterday.' });
    const skipped = counts(s.mealChecks[dayKey(-1)]).skipped; if (skipped >= 2) out.push({ tone: 'watch', text: `${skipped} meals were skipped yesterday.` });
    const w = well?.[dayKey(0)], wy = well?.[dayKey(-1)];
    if (w && wy && (wy.mood - w.mood >= 2 || wy.energy - w.energy >= 2)) out.push({ tone: 'watch', text: 'Mood or energy dropped sharply in your private check.' });
    if (w?.support === 2) out.push({ tone: 'flag', text: 'You asked for support in your private check.' });
  }
  if (both(t.dose, y.dose) && y.dose! > 0 && Math.abs(t.dose! - y.dose!) / y.dose! >= 0.3) out.push({ tone: 'watch', text: `Radiation dose rate changed ${t.dose! > y.dose! ? 'up' : 'down'} by ${r0((Math.abs(t.dose! - y.dose!) / y.dose!) * 100)}% (${y.dose!.toFixed(2)} → ${t.dose!.toFixed(2)} mSv/day).` });
  out.sort((a, b) => (a.tone === 'flag' ? 0 : 1) - (b.tone === 'flag' ? 0 : 1));
  const basis = `Today compared with yesterday${crew.synthetic ? ' (synthetic scenario)' : crew.isSample ? ' (sample data)' : ''}. Small ups and downs are left out.`;
  return { items: out.length ? out : [{ tone: 'ok', text: 'Nothing meaningful changed since yesterday.' }], basis };
}
