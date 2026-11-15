/**
 * Private wellbeing check: mood, stress, energy, loneliness, sleep quality and "do you need support".
 * Stays on this device. Nothing is sent unless the crew member chooses to prepare a handoff for the flight surgeon.
 */
import { dayKey, getStore, setStore } from './store';
import type { Wellbeing } from './store';

export const QUESTIONS: { key: 'mood' | 'stress' | 'energy' | 'lonely' | 'sleepQ'; label: string; low: string; high: string }[] = [
  { key: 'mood', label: 'Mood', low: 'Very low', high: 'Very good' },
  { key: 'stress', label: 'Stress', low: 'Calm', high: 'Very high' },
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Full' },
  { key: 'lonely', label: 'Loneliness', low: 'Connected', high: 'Very lonely' },
  { key: 'sleepQ', label: 'Sleep quality', low: 'Poor', high: 'Great' },
];
export const SUPPORT = ['No, I am okay', 'I would like to talk to someone', 'I need support now'] as const;

export const blankWellbeing = (): Wellbeing => ({ at: Date.now(), mood: 3, stress: 3, energy: 3, lonely: 2, sleepQ: 3, support: 0 });
export const saveWellbeing = (w: Wellbeing, day = dayKey(0)) => setStore(s => ({ ...s, wellbeing: { ...(s.wellbeing ?? {}), [day]: { ...w, at: Date.now() } } }));
export const wellbeingFor = (day = dayKey(0)) => getStore().wellbeing?.[day];

export type Insight = { level: 'none' | 'ok' | 'watch' | 'flag'; lines: string[]; family: boolean };
/** Looks at the last three days of private checks. Never a diagnosis: it only suggests who to talk to. */
export function wellbeingInsight(all: Record<string, Wellbeing> | undefined): Insight {
  const days = [0, -1, -2].map(i => all?.[dayKey(i)]).filter((w): w is Wellbeing => !!w);
  if (!days.length) return { level: 'none', lines: ['No wellbeing check yet. It takes about 30 seconds and stays on this device.'], family: false };
  const lines: string[] = []; let level: Insight['level'] = 'ok'; let family = false;
  const up = (l: 'watch' | 'flag') => { if (l === 'flag' || level !== 'flag') level = l; };
  if (days[0].support === 2) { up('flag'); lines.push('You said you need support now. Please contact your flight surgeon or behavioral health team.'); }
  else if (days.some(d => d.support === 1)) { up('watch'); family = true; lines.push('You asked to talk to someone recently. A message to your flight surgeon can help.'); }
  if (days.filter(d => d.lonely >= 4).length >= 2) { up('watch'); family = true; lines.push('Loneliness was high on 2 of the last 3 days.'); }
  if (days.length >= 2 && days.filter(d => d.mood <= 2).length >= 2) { up('watch'); lines.push('Low mood on 2 of the last 3 days.'); }
  if (days.length >= 2 && days.filter(d => d.stress >= 4).length >= 2) { up('watch'); lines.push('High stress on 2 of the last 3 days.'); }
  if (days.length >= 2 && days.filter(d => d.energy <= 2 && d.sleepQ <= 2).length >= 2) { up('watch'); lines.push('Low energy and poor sleep on 2 of the last 3 days.'); }
  if (!lines.length) lines.push('Nothing concerning in your last checks.');
  return { level, lines, family };
}
