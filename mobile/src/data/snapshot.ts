/**
 * Reports this astronaut's own progress to the server so the flight surgeon console can show it:
 * body numbers, mission, stress, radiation tracking, logged exposures and completed sessions.
 * Not sent while the synthetic judge scenario is on (that data is invented).
 */
import { useEffect, useMemo } from 'react';
import { api } from '@/api';
import { dayKey, useStore , useBriefing} from './store';
import { bodyNumbers } from './plan';
import { weekSummary } from './mealchecks';
import type { useCrew } from './crew';

type Crew = ReturnType<typeof useCrew>;

export function useSnapshotSync(crew: Crew, enabled: boolean) {
  const profile = useStore(s => s.profile);
  const briefing = useBriefing();
  const exposures = useStore(s => s.exposures);
  const completed = useStore(s => s.completed);
  const dataMode = useStore(s => s.dataMode);
  const meals = useStore(s => s.meals);
  const workouts = useStore(s => s.workouts);
  const mealChecks = useStore(s => s.mealChecks);
  const snap = useMemo(() => {
    const body = { age: Number(profile.age) || 0, sex: profile.gender, heightCm: Number(profile.height) || 0, weightKg: Number(profile.weight) || 0 };
    let sessionsThisWeek = 0;
    for (let i = 0; i < 7; i++) sessionsThisWeek += (completed[dayKey(-i)] ?? []).length;
    const day = dayKey(0), todayMeals = meals.filter(m => m.day === day);
    const todayW = workouts.filter(w => new Date(w.at).toISOString().slice(0, 10) === day);
    const reps: Record<string, number> = {};
    todayW.forEach(w => { reps[w.exercise] = (reps[w.exercise] ?? 0) + w.reps; });
    return {
      mealsToday: Object.fromEntries(Object.entries(mealChecks[day] ?? {}).map(([k, v]) => [k, v?.s])), mealsWeek: weekSummary(mealChecks),
      nutritionToday: { kcal: todayMeals.reduce((a, m) => a + m.kcal, 0), protein: todayMeals.reduce((a, m) => a + m.protein, 0), waterMl: todayMeals.reduce((a, m) => a + m.waterMl, 0) },
      camera: { todayReps: reps, lastSessions: workouts.slice(0, 3).map(w => ({ exercise: w.exercise, reps: w.reps, seconds: w.seconds, source: w.source, at: w.at })) },
      body, numbers: body.heightCm && body.weightKg ? bodyNumbers(body) : null, dataMode: dataMode ?? null,
      briefing: briefing ? { destination: briefing.destination, durationDays: briefing.durationDays, objective: briefing.objective, eva: briefing.eva, delay: briefing.delay } : null,
      missionDay: crew.missionDay, stress: { level: crew.stress.level, highDays: crew.stress.highDays, basis: crew.stress.basis },
      radiation: { rate: crew.radiation.rate, interval: crew.radiation.interval, cumulative: crew.radiation.cumulative, coveredDays: crew.radiation.coveredDays, missing: crew.radiation.missing, source: crew.radiation.source },
      exposures: exposures.slice(0, 5).map(e => ({ kind: e.kind, hours: e.hours, at: e.at })), sessionsThisWeek,
    };
  }, [profile, briefing, exposures, completed, dataMode, meals, workouts, mealChecks, crew.missionDay, crew.stress, crew.radiation]);
  const key = JSON.stringify(snap);
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => { api('/api/me/snapshot', { method: 'PUT', body: snap }).catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [key, enabled]);
}
