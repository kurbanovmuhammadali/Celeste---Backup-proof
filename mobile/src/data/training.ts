/**
 * Example crew exercise plan (sample data). Device names follow the ISS countermeasure hardware:
 * CEVIS cycle ergometer, ARED resistance device, T2 treadmill. Photos: NASA (public domain).
 */
import { dayKey, getStore, setStore, todayKey } from './store';

export type Phase = { id: string; title: string; sub: string; min: number; group: 'Warm-up' | 'Main session' | 'Cool-down'; target?: string };
export type Session = {
  id: string; title: string; device: string; category: 'aerobic' | 'resistance' | 'mobility'; kind: string; minutes: number;
  img: any | null; imgFocus?: any; thumb?: any; credit?: string; muscles: string[]; blurb: string; phases: Phase[];
};

export const IMG_TRAINING = {
  cevis: require('../../assets/training/cycle-banner.jpg'),
  cevisFocus: require('../../assets/training/cycle-focus.jpg'),
  cevisThumb: require('../../assets/training/cycle-thumb.jpg'),
  ared: require('../../assets/training/ared.jpg'),
  treadmill: require('../../assets/training/treadmill.jpg'),
};

export const SESSIONS: Session[] = [
  {
    id: 'station-cycle', title: 'Station cycle', device: 'CEVIS', category: 'aerobic', kind: 'Aerobic block', minutes: 32, img: IMG_TRAINING.cevis, imgFocus: IMG_TRAINING.cevisFocus, thumb: IMG_TRAINING.cevisThumb,
    muscles: ['Quads', 'Glutes', 'Calves'],
    blurb: 'A steady cycling session from the crew exercise plan. Keeps your heart and legs conditioned for gravity.',
    phases: [
      { id: 'p1', title: 'Easy spin', sub: 'Prepare for the main block', min: 4, group: 'Warm-up' },
      { id: 'p2', title: 'Cadence ramp', sub: 'Build to planned cadence', min: 3, group: 'Warm-up', target: '70 → 85 rpm' },
      { id: 'p3', title: 'Steady ride', sub: 'Follow crew protocol', min: 20, group: 'Main session', target: 'Zone 2 · 60–70% HR max' },
      { id: 'p4', title: 'Cool-down', sub: 'Easy finish', min: 5, group: 'Cool-down' },
    ],
  },
  {
    id: 'lower-strength', title: 'Lower-body strength', device: 'ARED', category: 'resistance', kind: 'Resistance block', minutes: 40, img: IMG_TRAINING.ared,
    credit: 'NASA · iss072e126509', muscles: ['Quads', 'Glutes', 'Hamstrings'],
    blurb: 'Loaded squats and hinges on the resistive device to protect bone density and muscle mass in microgravity.',
    phases: [
      { id: 'p1', title: 'Activation', sub: 'Bodyweight squats and hip hinges', min: 5, group: 'Warm-up' },
      { id: 'p2', title: 'Back squat', sub: '4 × 8 · controlled tempo', min: 12, group: 'Main session', target: '4 × 8 reps' },
      { id: 'p3', title: 'Romanian deadlift', sub: '3 × 8 · neutral spine', min: 10, group: 'Main session', target: '3 × 8 reps' },
      { id: 'p4', title: 'Heel raise', sub: '3 × 15 · full range', min: 6, group: 'Main session', target: '3 × 15 reps' },
      { id: 'p5', title: 'Stretch', sub: 'Hips, calves, lower back', min: 7, group: 'Cool-down' },
    ],
  },
  {
    id: 'harness-run', title: 'Harnessed run', device: 'T2', category: 'aerobic', kind: 'Aerobic block', minutes: 30, img: IMG_TRAINING.treadmill,
    credit: 'NASA · iss070e100775', muscles: ['Calves', 'Quads', 'Core'],
    blurb: 'Intervals on the treadmill with the harness loading your skeleton like walking on Earth.',
    phases: [
      { id: 'p1', title: 'Walk-in', sub: 'Adjust harness load', min: 5, group: 'Warm-up' },
      { id: 'p2', title: 'Intervals', sub: '6 × 2 min brisk / 40 s easy', min: 16, group: 'Main session', target: '6 rounds' },
      { id: 'p3', title: 'Steady jog', sub: 'Conversational pace', min: 4, group: 'Main session' },
      { id: 'p4', title: 'Cool-down', sub: 'Walk and unload', min: 5, group: 'Cool-down' },
    ],
  },
  {
    id: 'mobility', title: 'Mobility flow', device: 'Crew mobility', category: 'mobility', kind: 'Mobility block', minutes: 20, img: null,
    muscles: ['Hips', 'Spine', 'Shoulders'],
    blurb: 'A gentle sequence to counter spinal lengthening and stiffness from long days in the module.',
    phases: [
      { id: 'p1', title: 'Breathing', sub: 'Box breathing, 4-4-4-4', min: 3, group: 'Warm-up' },
      { id: 'p2', title: 'Hip openers', sub: 'Slow, held positions', min: 6, group: 'Main session' },
      { id: 'p3', title: 'Thoracic rotation', sub: 'Both sides', min: 6, group: 'Main session' },
      { id: 'p4', title: 'Shoulder flow', sub: 'Easy finish', min: 5, group: 'Cool-down' },
    ],
  },
];
export const TODAY_SESSION = 'station-cycle';
export const sessionById = (id?: string) => SESSIONS.find(s => s.id === id) ?? SESSIONS[0];

/** Sample history for the past 6 days (sessions per day). */
const PAST = [1, 2, 1, 0, 0, 1];
/** Last 7 days (oldest → today) with session counts; today's count comes from completed workouts. */
export function week() {
  const st = getStore();
  return Array.from({ length: 7 }, (_, i) => {
    const off = i - 6;
    const d = new Date(); d.setDate(d.getDate() + off);
    const done = (st.completed[dayKey(off)] ?? []).length;
    return { key: dayKey(off), label: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.getDate(), count: off === 0 ? done : PAST[i] + done, today: off === 0 };
  });
}
/** Seven weeks × seven days of sessions (sample history + this week's real counts). */
export function frequency(): number[][] {
  const seed = [1, 0, 2, 1, 0, 1, 0, 1, 1, 0, 2, 0, 1, 1, 0, 2, 1, 1, 0, 1, 0, 1, 1, 2, 0, 1, 2, 0, 2, 1, 0, 1, 1, 0, 1, 1, 2, 1, 0, 1, 1, 0];
  const rows: number[][] = [];
  for (let w = 0; w < 6; w++) rows.push(seed.slice(w * 7, w * 7 + 7));
  rows.push(week().map(d => d.count));
  return rows;
}
export function completeSession(id: string) {
  const k = todayKey();
  setStore(s => ({ ...s, completed: { ...s.completed, [k]: [...(s.completed[k] ?? []), id] } }));
}
export const doneToday = (id: string) => (getStore().completed[todayKey()] ?? []).includes(id);
