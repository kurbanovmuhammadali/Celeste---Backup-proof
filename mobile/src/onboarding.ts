import { useSyncExternalStore } from 'react';

/** Sign-up answers collected across the onboarding screens, sent once with the email code. */
export type Draft = {
  firstName: string; lastName: string; acceptTerms: boolean; age: number; heightCm: number; weightKg: number; missionYears: number;
  /** Optional mission goal: where they are going and what they will mainly do there. */
  goalDest: GoalDest | null; goalTasks: GoalTask[];
  email: string; devCode: string;
  /** HMSC extra used by the personal plan (kept on this device). */
  sex: 'Male' | 'Female' | 'Prefer not to say' | '';
};
const initial: Draft = { firstName: '', lastName: '', acceptTerms: false, age: 32, heightCm: 175, weightKg: 72, missionYears: 1, goalDest: null, goalTasks: [], email: '', devCode: '', sex: '' };

let state: Draft = { ...initial };
const subs = new Set<() => void>();
export const draft = {
  get: () => state,
  set: (patch: Partial<Draft>) => { state = { ...state, ...patch }; subs.forEach(f => f()); },
  reset: () => { state = { ...initial }; subs.forEach(f => f()); },
};
export function useDraft(): [Draft, (p: Partial<Draft>) => void] {
  const s = useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, draft.get, draft.get);
  return [s, draft.set];
}

/** Mission length → where the crew is going. Drives the route animation and the label under the number. */
export type Destination = 'orbit' | 'moon' | 'mars' | 'jupiter';
export const destinationFor = (y: number): Destination => (y <= 1 ? 'orbit' : y <= 2 ? 'moon' : y <= 4 ? 'mars' : 'jupiter');
export const DEST_LABEL: Record<Destination, string> = { orbit: 'Earth orbit', moon: 'Moon', mars: 'Mars round trip', jupiter: 'Deep space' };
export const DEST_RANGE: Record<Destination, [number, number]> = { orbit: [0.5, 1], moon: [1.5, 2], mars: [2.5, 4], jupiter: [4.5, 10] };

/** Optional mission-goal answers (sign-up step 6). */
export type GoalDest = 'iss' | 'moon' | 'mars' | 'jupiter' | 'deep';
export type GoalTask = 'repair' | 'science' | 'assembly' | 'eva' | 'piloting' | 'medical' | 'surface';
export const GOAL_DEST: { key: GoalDest; label: string; sub: string }[] = [
  { key: 'iss', label: 'Earth orbit', sub: 'ISS · station' },
  { key: 'moon', label: 'Moon', sub: 'Lunar base' },
  { key: 'mars', label: 'Mars', sub: 'Surface mission' },
  { key: 'jupiter', label: 'Jupiter', sub: 'Moons survey' },
  { key: 'deep', label: 'Deep space', sub: 'Beyond Jupiter' },
];
export const GOAL_TASK: { key: GoalTask; label: string }[] = [
  { key: 'repair', label: 'Spaceship repair' },
  { key: 'science', label: 'Science & experiments' },
  { key: 'assembly', label: 'Station assembly' },
  { key: 'eva', label: 'Spacewalks (EVA)' },
  { key: 'piloting', label: 'Piloting' },
  { key: 'medical', label: 'Crew medical officer' },
  { key: 'surface', label: 'Surface exploration' },
];
export const GOAL_DEST_NAME: Record<GoalDest, string> = { iss: 'Earth orbit', moon: 'Moon', mars: 'Mars', jupiter: 'Jupiter', deep: 'Deep space' };

export const ftIn = (cm: number) => { const t = Math.round(cm / 2.54); return `${Math.floor(t / 12)}′${t % 12}″`; };
