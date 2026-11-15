/**
 * EVA readiness check: sleep, hydration, fuel, symptoms, radiation context (measured, filled in automatically) plus the
 * equipment and clearance items the crew member ticks. Decision support only: the flight surgeon clears an EVA.
 */
import type { useCrew } from './crew';
import { dayKey, getStore, setStore } from './store';
import { bodyNumbers } from './plan';
import { counts } from './mealchecks';

type Crew = ReturnType<typeof useCrew>;
export type Status = 'pass' | 'caution' | 'fail' | 'unknown';
export type AutoItem = { key: string; label: string; status: Status; detail: string };
export const MANUAL = [
  { key: 'suit', label: 'Suit pressure, seals and battery checked' }, { key: 'comms', label: 'Radio and comms check done' },
  { key: 'tether', label: 'Tethers, tools and safety line verified with the buddy' }, { key: 'plan', label: 'EVA plan and abort criteria reviewed' },
  { key: 'clear', label: 'Flight surgeon medical clearance received' },
];
export const toggleEva = (key: string) => setStore(s => { const d = dayKey(0); const cur = s.evaChecks?.[d] ?? {}; return { ...s, evaChecks: { ...(s.evaChecks ?? {}), [d]: { ...cur, [key]: !cur[key] } } }; });
export const evaToday = () => getStore().evaChecks?.[dayKey(0)] ?? {};

export function autoItems(crew: Crew): AutoItem[] {
  const s = getStore(), p = s.profile, n = bodyNumbers({ age: Number(p.age) || 32, sex: p.gender, heightCm: Number(p.height) || 175, weightKg: Number(p.weight) || 72 });
  const today = crew.days[6], day = dayKey(0), meals = s.meals.filter(m => m.day === day);
  const water = meals.reduce((a, m) => a + m.waterMl, 0) / 1000, kcal = meals.reduce((a, m) => a + m.kcal, 0), ate = counts(s.mealChecks[day]).ate;
  const sym = crew.synthetic ? ['Headache'] : crew.manualToday?.symptoms ?? [];
  const RED = ['chest pain', 'shortness of breath', 'fainting', 'vision changes'];
  const items: AutoItem[] = [];
  items.push(today.sleep == null ? { key: 'sleep', label: 'Sleep', status: 'unknown', detail: 'No reading for last night. Enter it in the daily check.' }
    : { key: 'sleep', label: 'Sleep', status: today.sleep >= 6 ? 'pass' : today.sleep >= 5 ? 'caution' : 'fail', detail: `${today.sleep.toFixed(1)} h last night (6 h or more wanted).` });
  items.push({ key: 'hydration', label: 'Hydration', status: water >= n.waterL * 0.6 ? 'pass' : water >= n.waterL * 0.3 ? 'caution' : 'fail', detail: `${water.toFixed(1)} of ${n.waterL} L logged today.` });
  items.push({ key: 'fuel', label: 'Food', status: ate >= 1 || kcal >= 700 ? 'pass' : 'caution', detail: ate || kcal ? `${ate} meal${ate === 1 ? '' : 's'} eaten, ${kcal} kcal logged.` : 'Nothing eaten or logged yet today.' });
  items.push({ key: 'symptoms', label: 'Symptoms', status: sym.length === 0 ? 'pass' : sym.some(x => RED.includes(x.toLowerCase())) ? 'fail' : 'caution', detail: sym.length ? sym.join(', ') : 'None reported today.' });
  items.push(today.recovery == null ? { key: 'recovery', label: 'Recovery', status: 'unknown', detail: 'No recovery score.' } : { key: 'recovery', label: 'Recovery', status: today.recovery >= 50 ? 'pass' : today.recovery >= 34 ? 'caution' : 'fail', detail: `${Math.round(today.recovery)}% today.` });
  const r = crew.radiation;
  items.push(r.rate == null ? { key: 'radiation', label: 'Radiation context', status: 'unknown', detail: 'No dosimeter reading, so the dose cannot be judged.' } : { key: 'radiation', label: 'Radiation context', status: r.rate <= 1.0 ? 'pass' : r.rate <= 1.5 ? 'caution' : 'fail', detail: `${r.rate.toFixed(2)} mSv/day recently${crew.synthetic ? ' (synthetic)' : crew.radiation.source === 'demo' ? ' (demo)' : ''}.` });
  return items;
}

export function evaVerdict(auto: AutoItem[], manual: Record<string, boolean>): { verdict: 'GO' | 'CAUTION' | 'NO-GO'; why: string[] } {
  const why: string[] = [];
  auto.filter(a => a.status === 'fail').forEach(a => why.push(`${a.label}: ${a.detail}`));
  if (why.length) return { verdict: 'NO-GO', why };
  auto.filter(a => a.status === 'caution' || a.status === 'unknown').forEach(a => why.push(`${a.label}: ${a.detail}`));
  MANUAL.filter(m => !manual[m.key]).forEach(m => why.push(`Still to do: ${m.label}`));
  return { verdict: why.length ? 'CAUTION' : 'GO', why };
}
