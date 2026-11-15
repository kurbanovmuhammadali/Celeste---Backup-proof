/** The plan a flight surgeon sent to this astronaut (server: /api/me/override), and how it drives "today's session". */
import { useApi } from '../useApi';
import { SESSIONS, TODAY_SESSION, doneToday } from './training';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const DAYS: { key: DayKey; label: string }[] = [
  { key: 'mon', label: 'Monday' }, { key: 'tue', label: 'Tuesday' }, { key: 'wed', label: 'Wednesday' }, { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' }, { key: 'sat', label: 'Saturday' }, { key: 'sun', label: 'Sunday' },
];
export type Override = {
  message?: string; resistancePerWeek?: number; zone2Minutes?: number; intensity?: 'light' | 'normal' | 'push';
  week?: Partial<Record<DayKey, string[]>>; tasks?: { title: string; detail: string }[]; updatedAt?: string; updatedBy?: number;
};

export function useOverride(): Override | null {
  const { data } = useApi<{ override: Override | null }>('/api/me/override');
  return data?.override ?? null;
}

const JS_DAY: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const todayKey3 = (): DayKey => JS_DAY[new Date().getDay()];

/** Today's session: the flight surgeon's schedule if there is one (first one not done yet), else the default. */
export function todaySessionId(o: Override | null): string {
  const ids = (o?.week?.[todayKey3()] ?? []).filter(id => SESSIONS.some(s => s.id === id));
  return ids.find(id => !doneToday(id)) ?? ids[0] ?? TODAY_SESSION;
}
export const hasSchedule = (o: Override | null) => !!o?.week && Object.values(o.week).some(l => l && l.length);
