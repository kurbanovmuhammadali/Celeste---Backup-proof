/**
 * Small persisted app store (profile extras, completed workouts, chat history, device previews).
 * Web: localStorage. Native: a JSON file in the app's document directory.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type ChatMsg = { id: string; role: 'user' | 'astra'; text: string; at: number; files?: string[] };
export type Chat = { id: string; title: string; sub: string; at: number; messages: ChatMsg[] };

export type AppState = {
  profile: { age: string; gender: string; height: string; weight: string; duration: string; missionStart: string; displayName?: string };
  completed: Record<string, string[]>; // yyyy-mm-dd → session ids
  chats: Chat[];
  devices: Record<string, boolean>;
  seeded?: boolean;
  /** Mission briefing (set before tracking; Profile › Mission briefing). Celeste's shape plus the extras the health engine needs. */
  briefing: MissionBrief;
  /** Synthetic Mars demo telemetry (clearly labelled) and the clean presentation mode for judges. */
  settings: { demo: boolean; judge: boolean };
  /** Daily crew checks (Home › Check), newest last. Private mood stays on the device and out of reports. */
  checks: { day: string; at: number; mood: number; moodPrivate: boolean; symptoms: string[]; exerciseMin: number; manual: Record<string, number> }[];
  /** Repeat measurements: metric → latest re-measured value. */
  remeasure: Record<string, { value: number; at: number; source: string }>;
  /** Active solar-particle-event shelter alert. */
  spe: { startedAt: number; shelterBy: number } | null;
  /** Local face enrolment thumbnails (camera tools preview). Server-side recognition uses descriptors, see data/face.ts. */
  face: { enrolledAt: number; samples: string[] } | null;
  /** Manual daily crew health check, keyed by yyyy-mm-dd. */
  manual: Record<string, ManualEntry>;
  /** Personal dosimeter readings (one per interval). */
  radiation: RadEntry[];
  /** Offline medical handoff reports (simulated store-and-forward queue). */
  handoffs: Handoff[];
  /** Judge demo mode: synthetic Mars scenario on top of the app; `prev` restores the user's own settings. */
  judge?: { prev: { duration: string; missionStart: string; briefing?: MissionBrief } };
  /** WHOOP is the only wearable. Either connect it or enter data by hand: chosen during sign-up (required). */
  dataMode?: 'whoop' | 'manual';
  /** EVA / high-exposure events the crew member logged, used by the mission plan (post-exposure checklist). */
  exposures: Exposure[];
  /** Ticked items of the mission plan checklists. */
  planChecks: Record<string, boolean>;
  /** Private wellbeing check, keyed by yyyy-mm-dd. Stays on this device. */
  wellbeing?: Record<string, Wellbeing>;
  /** Pre-EVA checklist ticks, keyed by yyyy-mm-dd. */
  evaChecks?: Record<string, Record<string, boolean>>;
  /** Camera / manual exercise sessions (rep counts). */
  workouts: Workout[];
  /** Food and water log; calories, protein and water per entry. */
  meals: Meal[];
  /** Per-day "did you eat?" marks. */
  mealChecks: Record<string, Partial<Record<MealSlot, { s: 'ate' | 'skipped'; at: number; via?: 'camera' }>>>;
};

/** 1–5 scales. mood / energy / sleepQ: 5 is good. stress / lonely: 5 is high. support: 0 none, 1 would like to talk, 2 need support now. */
export type Wellbeing = { at: number; mood: number; stress: number; energy: number; lonely: number; sleepQ: number; support: 0 | 1 | 2; note?: string };
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ExerciseKey = 'pushup' | 'pullup' | 'squat';
export type Workout = { id: string; at: number; exercise: ExerciseKey; reps: number; seconds: number; source: 'camera' | 'demo' | 'manual' };
export type Meal = { id: string; at: number; day: string; name: string; kcal: number; protein: number; waterMl: number };

export type Exposure = { id: string; at: number; kind: 'eva' | 'storm-shelter' | 'deep-space-transit'; hours: number };

/** The mission briefing in the form the HMSC engines use (derived from MissionBrief, see asBriefing). */
export type Briefing = {
  destination: 'iss' | 'moon' | 'mars'; durationDays: number; objective: string;
  delay: 'none' | 'seconds' | 'minutes'; eva: 'none' | 'weekly' | 'daily'; crew: number; sensors: string[]; at: number;
};
export type MissionBrief = {
  dest: 'iss' | 'moon' | 'mars' | 'jupiter' | 'deep'; commDelayMin: number; evaDates: string[]; crewSize: number; objective: string; custom?: boolean;
  /** Extras used by the plan and hazard engines (optional: derived when missing). */
  durationDays?: number; eva?: 'none' | 'weekly' | 'daily'; sensors?: string[]; at?: number;
};
/** Converts the stored mission brief to the shape the HMSC engines (plan, hazards, handoff, radiation) read. */
export function asBriefing(b: MissionBrief | undefined, profile: AppState['profile']): Briefing | undefined {
  if (!b) return undefined;
  return {
    destination: b.dest === 'iss' || b.dest === 'moon' ? b.dest : 'mars', durationDays: b.durationDays ?? (Number(profile.duration) || 180), objective: b.objective,
    delay: b.commDelayMin <= 0.05 ? 'none' : b.commDelayMin < 1 ? 'seconds' : 'minutes',
    eva: b.eva ?? (b.evaDates.length >= 5 ? 'daily' : b.evaDates.length ? 'weekly' : 'none'), crew: b.crewSize, sensors: b.sensors ?? ['WHOOP'], at: b.at ?? 0,
  };
}
export type ManualEntry = { at: number; sleep?: number; rhr?: number; hrv?: number; stress?: number; mood?: number; exercise?: number; symptoms?: string[]; radiation?: number; spo2?: number; bp?: number; bp2?: number };
export type RadEntry = { id: string; at: number; fromDay: string; toDay: string; mSv: number; device: string; location: string };
export type HandoffLine = { h: string; t: string };
export type Handoff = {
  id: string; createdAt: number; title: string; reason: string; missionDay: number; lines: HandoffLine[];
  /** Set when the crew member queues it. Status is derived from elapsed time (see handoffStatus). */
  queuedAt?: number; delaySec: number; synthetic?: boolean;
  /** Real delivery to the flight surgeon console (not for synthetic reports). */
  sentAt?: number; ackAt?: string; ackNote?: string;
};

const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };
const at = (offsetDays: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() + offsetDays); d.setHours(h, m, 0, 0); return d.getTime(); };

const initial = (): AppState => ({
  profile: { age: '32', gender: 'Prefer not to say', height: '178', weight: '74', duration: '180', missionStart: day(-41) },
  completed: {},
  devices: {},
  briefing: { dest: 'mars', commDelayMin: 12, evaDates: [day(1), day(9)], crewSize: 4, objective: 'Surface science and habitat assembly', eva: 'weekly', sensors: ['WHOOP'] },
  settings: { demo: false, judge: false },
  checks: [],
  remeasure: {},
  spe: null,
  face: null,
  manual: {},
  radiation: [],
  handoffs: [],
  exposures: [],
  planChecks: {},
  workouts: [],
  meals: [],
  mealChecks: {},
  chats: [
    { id: 'c-dose', title: 'Reading my dose report', sub: 'Dosimetry report attached', at: at(0, 9, 18), messages: [
      { id: 'm1', role: 'user', text: 'Can you read my dose report?', at: at(0, 9, 17), files: ['dosimeter-nov.pdf'] },
      { id: 'm2', role: 'astra', text: 'Your personal dosimeter logged 0.43 mSv yesterday, close to your 7‑day average. Mission total is 18.6 mSv. Cabin monitors are reported separately from your personal dose.', at: at(0, 9, 18) },
    ] },
    { id: 'c-sleep', title: 'Last night’s sleep', sub: 'Recovery and sleep trend', at: at(0, 7, 42), messages: [
      { id: 'm1', role: 'user', text: 'How did I sleep last night?', at: at(0, 7, 41) },
      { id: 'm2', role: 'astra', text: 'You slept 5 h 48 m — about 50 minutes under your weekly average, and recovery dropped to 47%. Consider a lighter session today and an earlier lights-out.', at: at(0, 7, 42) },
    ] },
    { id: 'c-week', title: 'Review my weekly training', sub: 'Crew workout summary', at: at(-2, 18, 5), messages: [
      { id: 'm1', role: 'user', text: 'Review my weekly training', at: at(-2, 18, 4) },
      { id: 'm2', role: 'astra', text: 'Five sessions this week: two resistance blocks on ARED, two CEVIS rides and one mobility flow. You’re on track with the crew plan.', at: at(-2, 18, 5) },
    ] },
  ],
});

const KEY = 'astra.app.v1';
let state: AppState = initial();
let loaded = false;
const subs = new Set<() => void>();

async function read(): Promise<AppState | null> {
  try {
    if (Platform.OS === 'web') { const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null; return v ? JSON.parse(v) : null; }
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, 'astra-app.json');
    if (!f.exists) return null;
    return JSON.parse(await (f as any).text());
  } catch { return null; }
}
async function write() {
  try {
    const s = JSON.stringify(state);
    if (Platform.OS === 'web') { localStorage.setItem(KEY, s); return; }
    const { File, Paths } = await import('expo-file-system');
    const f = new File(Paths.document, 'astra-app.json');
    if (!f.exists) f.create();
    f.write(s);
  } catch {}
}

export async function loadStore() {
  if (loaded) return;
  loaded = true;
  const saved = await read();
  if (saved) { const i = initial(); state = { ...i, ...saved, profile: { ...i.profile, ...saved.profile }, settings: { ...i.settings, ...(saved as any).settings, demo: false, judge: false }, briefing: { ...i.briefing, ...(saved as any).briefing } }; }
  subs.forEach(f => f());
}

export function getStore() { return state; }
export function setStore(fn: (s: AppState) => AppState) {
  state = fn(state);
  subs.forEach(f => f());
  write();
}

export function useStore<T>(pick: (s: AppState) => T): T {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(n => n + 1);
    subs.add(f);
    loadStore();
    return () => { subs.delete(f); };
  }, []);
  return pick(state);
}

export const todayKey = () => day(0);
export const dayKey = day;
export const uid = () => Math.random().toString(36).slice(2, 10);

/** The mission briefing in HMSC-engine form (use this in plan, hazards, handoff, radiation code). */
export const getBriefing = (): Briefing | undefined => asBriefing(state.briefing, state.profile);
export function useBriefing(): Briefing | undefined {
  const b = useStore(s => s.briefing), p = useStore(s => s.profile);
  return asBriefing(b, p);
}
