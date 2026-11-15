/**
 * Attention card: ONE main signal, the reason, and one clear action: instead of many noisy alerts.
 * Compares today with the person's own baseline (up to 14 comparable days before the last 3 nights).
 * With too little data it says so, it never shows a green "normal" it cannot back up.
 */
import type { useCrew } from './crew';
import { staleSleep, STATE_WORD } from './freshness';
import { dayKey, getStore } from './store';
import { counts } from './mealchecks';
import type { SourceStatus } from './freshness';

type Crew = ReturnType<typeof useCrew>;
export type AttentionLevel = 'ok' | 'watch' | 'flag' | 'nodata';
export type ActionId = 'rhr-check' | 'checkin' | 'training' | 'handoff' | 'daily' | 'sources' | 'keep';
export type Trend = { key: string; label: string; unit: string; values: (number | null)[]; band: [number, number] | null; baselineDays: number; today: number | null; method?: string };
export type Attention = {
  level: AttentionLevel; missionDay: number; headline: string; changes: string[]; baselineNote: string; sources: string[];
  why: string; actions: { id: ActionId; text: string }[]; trends: Trend[]; gaps: number; whatChanged: string[];
};

const nums = (a: (number | null)[]) => a.filter((v): v is number => v != null);
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
const r1 = (v: number) => Math.round(v * 10) / 10;

function baseline(h: (number | null)[]) {
  const base = nums(h.slice(Math.max(0, h.length - 3 - 14), Math.max(0, h.length - 3)));
  if (!base.length) return { n: 0, mean: 0, s: 0, lo: 0, hi: 0 };
  const m = mean(base), s = sd(base);
  return { n: base.length, mean: m, s, lo: m - s, hi: m + s };
}

const RED_SYMPTOMS = ['chest pain', 'shortness of breath', 'fainting', 'vision changes'];

export function computeAttention(crew: Crew, sources: SourceStatus[]): Attention {
  const H = crew.history;
  const today = { sleep: crew.days[6].sleep, hrv: crew.days[6].hrv, rhr: crew.days[6].rhr };
  const bSleep = baseline(H.sleep), bHrv = baseline(H.hrv), bRhr = baseline(H.rhr);
  const changes: string[] = [];
  const whatChanged: string[] = [];
  let level: AttentionLevel = 'ok';
  let why = 'HMSC compares you with your own baseline so small drifts show up before they become problems.';
  const raise = (l: 'watch' | 'flag') => { if (l === 'flag' || level !== 'flag') level = l; };

  // sleep: nights below your own normal range
  const sleepFloor = Math.max(0.5, bSleep.s);
  const sleepLo = bSleep.mean - sleepFloor;
  const recent = H.sleep.slice(-3);
  const below = bSleep.n >= 5 ? recent.filter(v => v != null && v < sleepLo).length : 0;
  if (below >= 2) {
    raise(below === 3 && today.sleep != null && today.sleep < sleepLo - 1.5 ? 'flag' : 'watch');
    changes.push(`Sleep is below your normal range for ${below} night${below > 1 ? 's' : ''} (${r1(today.sleep ?? 0)} h vs ${r1(sleepLo)}–${r1(bSleep.mean + sleepFloor)} h).`);
    why = 'Short sleep and circadian disruption are tracked by NASA\'s Human Research Program as risks to performance and health on long missions.';
  }
  // HRV vs baseline (same method only)
  if (bHrv.n >= 5 && today.hrv != null) {
    const pct = ((today.hrv - bHrv.mean) / bHrv.mean) * 100;
    if (pct <= -10) {
      raise(pct <= -20 ? 'flag' : 'watch');
      changes.push(`HRV is ${Math.round(Math.abs(pct))}% below your personal baseline (${Math.round(today.hrv)} ms vs ${Math.round(bHrv.mean)} ms, ${crew.hrvMethod}).`);
      if (below < 2) why = 'A drop in HRV against your own baseline can reflect stress, poor recovery or illness. It is a prompt to check in, not a diagnosis.';
    }
  }
  if (bRhr.n >= 5 && today.rhr != null) {
    const d = today.rhr - bRhr.mean;
    if (d >= 5) {
      raise(d >= 10 ? 'flag' : 'watch');
      changes.push(`Resting heart rate is ${Math.round(d)} bpm above your baseline (${Math.round(today.rhr)} vs ${Math.round(bRhr.mean)} bpm).`);
    }
  }
  // symptoms
  const symptoms = crew.synthetic ? ['Headache'] : crew.manualToday?.symptoms ?? [];
  if (symptoms.length) {
    raise(symptoms.some(s => RED_SYMPTOMS.includes(s.toLowerCase())) ? 'flag' : 'watch');
    changes.push(`Reported today: ${symptoms.join(', ').toLowerCase()}.`);
  }
  // eating: skipped meals today
  const skippedMeals = crew.synthetic ? 0 : counts(getStore().mealChecks[dayKey(0)]).skipped;
  if (skippedMeals >= 2) { raise('watch'); changes.push(`Skipped ${skippedMeals} meals today.`); if (below < 2) why = 'Skipping meals on a long mission slows recovery and bone and muscle protection. Eat something today and tell your flight surgeon if you have no appetite.'; }
  // isolation: sustained stress load
  if (!crew.handMode && crew.stress.highDays >= 3) { raise('watch'); changes.push(`Stress load has been high on ${crew.stress.highDays} of the last 7 days.`); if (below < 2) why = 'Sustained stress and low recovery are early signs of strain from isolation and confinement. Reach out to someone you trust, and use the family-voice companion if it helps.'; }
  // data quality
  const stale = staleSleep(crew);
  if (stale) changes.push(`Sleep source has not updated for ${stale.hours} hours. Check WHOOP or enter a manual measurement.`);
  const dos = sources.find(s => s.key === 'dosimeter');
  if (dos) changes.push(dos.state === 'received' ? 'Radiation sensor is current.' : dos.state === 'demo' ? `Radiation values are ${crew.synthetic ? 'synthetic' : 'demo'} values.` : dos.state === 'stale' ? 'Radiation sensor is stale: enter a new reading.' : 'No radiation reading yet.');

  // not enough to judge → never green
  const haveBaseline = [bSleep, bHrv, bRhr].filter(b => b.n >= 5).length;
  const haveToday = [today.sleep, today.hrv, today.rhr].some(v => v != null);
  const gaps = [H.sleep, H.hrv, H.rhr].reduce((a, h) => a + h.slice(-14).filter(v => v == null).length, 0);
  let headline: string;
  if (level === 'ok' && (!haveToday || haveBaseline < 2)) {
    level = 'nodata';
    headline = !haveToday ? 'No data received today' : 'Not enough data to judge yet';
    changes.unshift(!haveToday ? 'No sleep, HRV or resting HR arrived today.' : `Your personal baseline is still building (${Math.max(bSleep.n, bHrv.n, bRhr.n)} of 14 days).`);
    why = 'HMSC will not call something normal when it has no data to compare. Add a source or enter today\'s check.';
  } else if (level === 'ok') {
    headline = 'Within your normal range';
    changes.unshift('Sleep, HRV and resting heart rate are inside your personal range.');
  } else headline = level === 'flag' ? 'Priority: act on this today' : 'Watch: something is drifting';

  const actions: Attention['actions'] = level === 'nodata'
    ? [{ id: 'daily', text: 'Enter today\'s measurements by hand' }, { id: 'sources', text: 'Connect or check a data source' }]
    : level === 'ok'
      ? [{ id: 'keep', text: 'Keep today\'s plan' }, { id: 'daily', text: 'Add today\'s daily check' }]
      : [{ id: 'rhr-check', text: 'Repeat resting-heart-rate check' }, { id: 'checkin', text: 'Complete a short wellbeing check-in' }, { id: 'training', text: 'Reduce optional training' }, { id: 'handoff', text: 'Add this event to the next medical handoff' }];

  const t = (key: string, label: string, unit: string, vals: (number | null)[], b: ReturnType<typeof baseline>, now: number | null, method?: string): Trend =>
    ({ key, label, unit, values: vals.slice(-14), band: b.n >= 5 ? [b.lo, b.hi] : null, baselineDays: b.n, today: now, method });
  const srcLines = sources.filter(s => ['whoop', 'manual'].includes(s.key)).map(s => `${s.label}: ${STATE_WORD[s.state]} · ${s.detail}`);

  return {
    level, missionDay: crew.missionDay, headline, changes, whatChanged, why, actions, gaps,
    baselineNote: haveBaseline ? `Personal baseline from ${Math.max(bSleep.n, bHrv.n, bRhr.n)} comparable days (14 is ideal). HRV is compared only within ${crew.hrvMethod}.` : 'No personal baseline yet.',
    sources: srcLines,
    trends: [t('sleep', 'Sleep', 'h', H.sleep, bSleep, today.sleep), t('hrv', 'HRV', 'ms', H.hrv, bHrv, today.hrv, crew.hrvMethod), t('rhr', 'Resting HR', 'bpm', H.rhr, bRhr, today.rhr)],
  };
}
