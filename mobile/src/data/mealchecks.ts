/** "Did you eat?": per-day ate / skipped marks for breakfast, lunch, dinner and snack. Reported to the surgeon console. */
import { dayKey, getStore, setStore } from './store';
import type { MealSlot } from './store';

export const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' }, { key: 'lunch', label: 'Lunch' }, { key: 'dinner', label: 'Dinner' }, { key: 'snack', label: 'Snack' },
];
export const MAIN: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/** The meal that fits the current time of day. */
export function slotNow(d = new Date()): MealSlot {
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 10 * 60 + 30 ? 'breakfast' : m < 15 * 60 + 30 ? 'lunch' : m < 21 * 60 ? 'dinner' : 'snack';
}

export function setMealCheck(slot: MealSlot, s: 'ate' | 'skipped' | null, day = dayKey(0), via?: 'camera') {
  setStore(st => {
    const cur = { ...(st.mealChecks[day] ?? {}) };
    if (s == null) delete cur[slot]; else cur[slot] = { s, at: Date.now(), ...(via ? { via } : {}) };
    return { ...st, mealChecks: { ...st.mealChecks, [day]: cur } };
  });
}
/** Logging food counts as eating the meal of the current time of day (unless already marked). */
export function markAteNow() {
  const day = dayKey(0), slot = slotNow();
  if (!getStore().mealChecks[day]?.[slot]) setMealCheck(slot, 'ate', day);
}

export type DayChecks = Partial<Record<MealSlot, { s: 'ate' | 'skipped'; at: number; via?: 'camera' }>>;
export const counts = (c: DayChecks | undefined) => ({
  ate: MAIN.filter(k => c?.[k]?.s === 'ate').length,
  skipped: MAIN.filter(k => c?.[k]?.s === 'skipped').length,
});
export function weekSummary(all: Record<string, DayChecks>) {
  let ate = 0, skipped = 0;
  for (let i = 0; i < 7; i++) { const c = counts(all[dayKey(-i)]); ate += c.ate; skipped += c.skipped; }
  return { ate, skipped };
}
