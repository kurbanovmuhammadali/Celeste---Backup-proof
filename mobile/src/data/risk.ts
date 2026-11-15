/**
 * Mission risk report: six areas the NASA challenge cares about (cardio, sleep, immune, bone & muscle, mind, radiation),
 * each with a tone (ok / watch / flag), a one-line reason and an action. Simple fixed thresholds on top of the
 * crew view-model (src/data/crew.ts). Illustrative only, not medical advice.
 */
import type { Tone } from '@/kit/tokens';

export type RiskId = 'cardio' | 'sleep' | 'immune' | 'bone' | 'mind' | 'radiation';
export type Risk = { id: RiskId; title: string; note: string; tone: Tone; tip: string };

export type RiskInput = { recovery: number | null; sleep: number | null; hrv: number | null; rhr: number | null; workoutMin: number | null };

const tone = (known: boolean, ok: boolean, watch: boolean): Tone => (!known ? 'none' : ok ? 'ok' : watch ? 'watch' : 'flag');
const fmtH = (h: number) => `${Math.floor(h)}h ${String(Math.round((h % 1) * 60)).padStart(2, '0')}m`;

export function assessRisks(d: RiskInput, missionDays: number): Risk[] {
  const { recovery: rec, sleep: sl, hrv, rhr, workoutMin: wm } = d;
  return [
    { id: 'cardio', title: 'Cardiovascular', tip: 'Add 20 min of low-intensity cardio today (CEVIS or treadmill).',
      note: hrv == null || rhr == null ? 'No heart data yet' : `HRV ${Math.round(hrv)} ms · resting HR ${Math.round(rhr)} bpm`,
      tone: tone(hrv != null && rhr != null, (hrv ?? 0) >= 50 && (rhr ?? 99) <= 60, (hrv ?? 0) >= 35 && (rhr ?? 99) <= 70) },
    { id: 'sleep', title: 'Sleep & circadian', tip: 'Dim lights 90 minutes before sleep and keep a fixed wake time.',
      note: sl == null ? 'No sleep data yet' : `${fmtH(sl)} last night`,
      tone: tone(sl != null, (sl ?? 0) >= 7.5, (sl ?? 0) >= 6) },
    { id: 'immune', title: 'Immune & recovery', tip: 'Lower today’s strain and log any symptoms in your check-in.',
      note: rec == null ? 'No recovery data yet' : `Recovery ${Math.round(rec)}%`,
      tone: tone(rec != null, (rec ?? 0) >= 67, (rec ?? 0) >= 34) },
    { id: 'bone', title: 'Bone & muscle', tip: 'Complete the resistive exercise block: bone loss is the biggest long-mission risk.',
      note: wm == null ? 'No training logged' : `${Math.round(wm)} min of training`,
      tone: tone(wm != null, (wm ?? 0) >= 60, (wm ?? 0) >= 30) },
    { id: 'mind', title: 'Mental wellbeing', tip: 'Schedule a call with family and 15 minutes of quiet time.',
      note: 'Isolation risk grows with mission length',
      tone: tone(rec != null && sl != null, (rec ?? 0) >= 67 && (sl ?? 0) >= 7, (rec ?? 0) >= 34) },
    { id: 'radiation', title: 'Radiation', tip: 'Sleep in the shielded crew quarters when possible.',
      note: `${missionDays}-day mission profile`,
      tone: missionDays <= 730 ? 'ok' : missionDays <= 1825 ? 'watch' : 'flag' },
  ];
}
