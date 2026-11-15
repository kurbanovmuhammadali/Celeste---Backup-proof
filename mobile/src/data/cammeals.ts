/**
 * Meals the remote camera saw (server: /api/me/meal-events). Precooked food: the camera only checks whether the
 * astronaut ate. A detected meal marks that slot as "ate (camera)" in the app, which then reports it to the surgeon.
 */
import { useEffect } from 'react';
import { api } from '@/api';
import { dayKey } from './store';
import type { MealSlot } from './store';
import { setMealCheck } from './mealchecks';
import { getStore } from './store';

export type CamMeal = { day: string; slot: MealSlot; bites: number; startedAt: number; endedAt: number };

export function useCameraMeals(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const pull = () => api<{ events: CamMeal[] }>('/api/me/meal-events').then(r => {
      if (!alive) return;
      r.events.filter(e => e.day === dayKey(0)).forEach(e => { if (getStore().mealChecks[e.day]?.[e.slot]?.via !== 'camera') setMealCheck(e.slot, 'ate', e.day, 'camera'); });
    }).catch(() => {});
    pull(); const t = setInterval(pull, 15000);
    return () => { alive = false; clearInterval(t); };
  }, [enabled]);
}
