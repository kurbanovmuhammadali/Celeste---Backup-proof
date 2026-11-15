/**
 * Camera exercise tracking (DEMO). Counts repetitions from body landmarks (MediaPipe Pose, 33 points, y grows downward).
 * Pure functions, no camera code: the same counter runs on a live camera and on the synthetic figure used in demo mode.
 *
 * This is a showcase. In orbit crews train on ARED / CEVIS / T2, not with push-ups or pull-ups, and HMSC is not
 * integrated with those devices, so a phone camera stands in for them in this prototype.
 */
export type ExerciseKey = 'pushup' | 'pullup' | 'squat';
export type Lm = { x: number; y: number; z?: number; visibility?: number };

export const EXERCISES: { key: ExerciseKey; label: string; hint: string }[] = [
  { key: 'pushup', label: 'Push-ups', hint: 'Phone on the floor, filming from the side, whole body in frame.' },
  { key: 'pullup', label: 'Pull-ups', hint: 'Face the camera, bar, hands and head in frame.' },
  { key: 'squat', label: 'Squats', hint: 'Film from the side, full body in frame.' },
];

/** Landmark indices used (MediaPipe Pose). */
export const I = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28 };
export const CONNECTIONS: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [0, 11], [0, 12]];

export const angle = (a: Lm, b: Lm, c: Lm) => {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!d) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))) * 180) / Math.PI;
};
const vis = (p?: Lm) => (p?.visibility ?? 1);

/** Pick the body side whose three joints are most visible. */
function side(lm: Lm[], l: number[], r: number[]) {
  const s = (ids: number[]) => ids.reduce((a, i) => a + vis(lm[i]), 0) / ids.length;
  return s(l) >= s(r) ? { ids: l, v: s(l) } : { ids: r, v: s(r) };
}

type Spec = { up: number; down: number };
const SPEC: Record<'squat', Spec> = { squat: { up: 160, down: 100 } }; // knee angle

/** The measured value for the exercise, or null when the needed joints are not visible. */
export function measure(ex: ExerciseKey, lm: Lm[]): number | null {
  if (!lm || lm.length < 29 || ex !== 'squat') return null;
  const s = side(lm, [I.lHip, I.lKnee, I.lAnk], [I.rHip, I.rKnee, I.rAnk]);
  return s.v < 0.5 ? null : angle(lm[s.ids[0]], lm[s.ids[1]], lm[s.ids[2]]);
}

export type Rep = { phase: 'up' | 'down' | 'wait'; hi: number; lo: number; lastRepAt: number; lastOkAt: number; f: number | null; fT: number; fD: number; med: number[] };
const newRep = (): Rep => ({ phase: 'wait', hi: -Infinity, lo: Infinity, lastRepAt: 0, lastOkAt: 0, f: null, fT: 0, fD: 0, med: [] });
export type Counter = { ex: ExerciseKey; reps: number; phase: 'up' | 'down' | 'wait'; smooth: number | null; lastRepAt: number; value: number | null; hint: string; rep?: Rep };
export const createCounter = (ex: ExerciseKey): Counter => ({ ex, reps: 0, phase: 'wait', smooth: null, lastRepAt: 0, value: null, hint: 'Step into the frame' });

// ---------------------------------------------------------------- push-ups and pull-ups
// Method (the standard approach in open-source pose rep counters, hardened):
//  1. Angles come from MediaPipe WORLD landmarks (metric 3D), so they do not depend on camera angle or distance. Without
//     world landmarks the 2D image points are used.
//  2. Posture gate: push-ups only count while the torso is roughly horizontal; pull-ups only while the hands are above the
//     shoulders. Walking around or standing still can never count.
//  3. The elbow angle is median-filtered, then smoothed with a One Euro filter (low lag on real motion, little jitter).
//  4. A two-threshold state machine (hysteresis) counts a rep on the way back up, only if the elbow swung at least MIN_SWING
//     degrees, and not faster than a person could do it.
const ANGLE = {
  pushup: { up: 150, down: 105, swing: 35, gap: 600 },
  pullup: { up: 140, down: 100, swing: 40, gap: 900 },
} as const;
const LOST_MS = 1200;
const d3 = (a: Lm, b: Lm) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
export function angle3(a: Lm, b: Lm, c: Lm) {
  const v1 = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)], v2 = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const d = Math.hypot(...v1) * Math.hypot(...v2);
  if (!d) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / d))) * 180) / Math.PI;
}
const ARM = { L: [I.lSh, I.lEl, I.lWr], R: [I.rSh, I.rEl, I.rWr] } as const;
/** Elbow angle in degrees: visibility-weighted mean of the visible arms (3D from world landmarks when given). */
export function elbowAngle(lm: Lm[], world?: Lm[] | null): number | null {
  let sum = 0, w = 0;
  for (const ids of [ARM.L, ARM.R]) {
    const v = Math.min(...ids.map(i => vis(lm[i])));
    if (v < 0.4) continue;
    const src = world && world.length >= 29 ? world : lm;
    const [s, e, r] = ids.map(i => src[i]);
    if (!s || !e || !r || d3(s, e) < 1e-3 || d3(e, r) < 1e-3) continue;
    sum += angle3(s, e, r) * v; w += v;
  }
  return w ? sum / w : null;
}
export const armRatio = (lm: Lm[], ids: readonly number[]): number | null => {
  const [s, e, w] = ids.map(i => lm[i]);
  if (!s || !e || !w || Math.min(vis(s), vis(e), vis(w)) < 0.3) return null;
  const a = d3(s, e), b = d3(e, w);
  return a < 0.02 || b < 0.02 ? null : Math.min(1, d3(s, w) / (a + b));
};

type Gate = { ok: boolean; hint: string };
/** Push-up: torso within 40 degrees of horizontal (film from the side). Pull-up: wrists not below the shoulders. */
function gate(ex: 'pushup' | 'pullup', lm: Lm[], aspect: number): Gate {
  const sh = [lm[I.lSh], lm[I.rSh]], hp = [lm[I.lHip], lm[I.rHip]];
  if (ex === 'pushup') {
    const sv = Math.min(vis(sh[0]), vis(sh[1])), hv = Math.min(vis(hp[0]), vis(hp[1]));
    if (Math.max(vis(sh[0]), vis(sh[1])) < 0.4 || Math.max(vis(hp[0]), vis(hp[1])) < 0.4) return { ok: false, hint: 'Show your shoulders and hips' };
    const S = vis(sh[0]) >= vis(sh[1]) ? sh[0] : sh[1], H = vis(hp[0]) >= vis(hp[1]) ? hp[0] : hp[1];
    void sv; void hv;
    const deg = (Math.atan2(Math.abs(H.y - S.y), Math.abs(H.x - S.x) * aspect) * 180) / Math.PI;
    return deg < 40 ? { ok: true, hint: '' } : { ok: false, hint: 'Get into plank, camera from the side' };
  }
  const wr = [lm[I.lWr], lm[I.rWr]];
  if (Math.min(vis(wr[0]), vis(wr[1]), vis(sh[0]), vis(sh[1])) < 0.4) return { ok: false, hint: 'Face the camera, hands and shoulders in frame' };
  const wy = (wr[0].y + wr[1].y) / 2, sy = (sh[0].y + sh[1].y) / 2;
  return wy <= sy + 0.03 ? { ok: true, hint: '' } : { ok: false, hint: 'Hang from the bar, hands above your shoulders' };
}

const median3 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const alpha = (cut: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cut) / dt);
/** One Euro filter: smooth when slow, responsive when fast. */
function euro(r: Rep, x: number, now: number): { f: number; r: Partial<Rep> } {
  if (r.f == null) return { f: x, r: { f: x, fT: now, fD: 0 } };
  const dt = Math.max(0.005, (now - r.fT) / 1000);
  const dRaw = (x - r.f) / dt, aD = alpha(1, dt), dHat = r.fD + aD * (dRaw - r.fD);
  const f = r.f + alpha(1.2 + 0.03 * Math.abs(dHat), dt) * (x - r.f);
  return { f, r: { f, fT: now, fD: dHat } };
}

function updateAngle(c: Counter, lm: Lm[], world: Lm[] | null | undefined, now: number, aspect: number): Counter {
  const ex = c.ex as 'pushup' | 'pullup', sp = ANGLE[ex];
  let r = c.rep ?? newRep();
  const lost = (hint: string): Counter => {
    const stale = now - r.lastOkAt > LOST_MS;
    return { ...c, value: null, hint, phase: stale ? 'wait' : c.phase, rep: stale ? { ...newRep(), lastRepAt: r.lastRepAt } : r };
  };
  const g = gate(ex, lm, aspect);
  if (!g.ok) return lost(g.hint);
  const raw = elbowAngle(lm, world);
  if (raw == null) return lost('Show your arms to the camera');
  const med = [...r.med, raw].slice(-3);
  const e = euro(r, median3(med), now);
  const x = e.f;
  r = { ...r, ...e.r, med, lastOkAt: now };
  let { phase, hi, lo, lastRepAt } = r, reps = c.reps, hint = '';
  if (phase === 'wait') { if (x >= sp.up) { phase = 'up'; hi = x; lo = Infinity; } else if (x <= sp.down) { phase = 'down'; lo = x; hi = -Infinity; } }
  else if (phase === 'up') {
    hi = Math.max(hi, x);
    if (x <= sp.down) { phase = 'down'; lo = x; }
  } else {
    lo = Math.min(lo, x);
    if (x >= sp.up) {
      if (hi !== -Infinity && hi - lo >= sp.swing && now - lastRepAt > sp.gap) { reps += 1; lastRepAt = now; hint = `Rep ${reps}`; }
      phase = 'up'; hi = x; lo = Infinity;
    }
  }
  if (!hint) hint = phase === 'wait' ? (ex === 'pushup' ? 'Straighten your arms to start' : 'Hang with straight arms') : ex === 'pushup' ? (phase === 'up' ? 'Lower your chest' : 'Push up') : (phase === 'up' ? 'Pull up' : 'Lower with control');
  if (ex === 'pullup' && phase === 'down' && lm[I.nose] && vis(lm[I.nose]) > 0.4) {
    const wy = (lm[I.lWr].y + lm[I.rWr].y) / 2;
    if (x < sp.down && lm[I.nose].y > wy + 0.05) hint = 'Chin over the bar';
  }
  return { ...c, reps, phase, rep: { ...r, phase, hi, lo, lastRepAt }, value: x, hint, lastRepAt };
}

/** Feed one frame. `world` = MediaPipe worldLandmarks[0] when available. Returns a new counter state (the input is not mutated). */
export function update(c: Counter, lm: Lm[] | null, now: number, world?: Lm[] | null, aspect = 4 / 3): Counter {
  if (c.ex === 'pushup' || c.ex === 'pullup') return lm && lm.length >= 29 ? updateAngle(c, lm, world, now, aspect) : { ...c, value: null, hint: 'Step into the frame' };
  const v = lm ? measure(c.ex, lm) : null;
  if (v == null) return { ...c, value: null, hint: 'Step back so your whole body is visible' };
  const sm = c.smooth == null ? v : c.smooth * 0.55 + v * 0.45; // light smoothing against landmark jitter
  const sp = SPEC[c.ex as 'squat'];
  let { phase, reps, lastRepAt } = c;
  let hint = phase === 'wait' ? 'Get into the start position' : phase === 'up' ? 'Go down' : 'Come back up';
  if (sm >= sp.up) {
    if (phase === 'down' && now - lastRepAt > 350) { reps += 1; lastRepAt = now; hint = `Rep ${reps}`; }
    phase = 'up';
  } else if (sm <= sp.down && phase === 'up') phase = 'down';
  return { ...c, reps, phase, smooth: sm, lastRepAt, value: sm, hint };
}

// ---------------------------------------------------------------- synthetic figure (demo mode, no camera needed)
const blank = (): Lm[] => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
const set = (lm: Lm[], i: number, x: number, y: number) => { lm[i] = { x, y, visibility: 1 }; };
const both = (lm: Lm[], l: number, r: number, x: number, y: number, dx = 0.02) => { set(lm, l, x - dx, y); set(lm, r, x + dx, y); };

/** Landmarks of a simple figure doing `ex`; `p` is 0 (start) to 1 (bottom / top for pull-ups). */
export function syntheticPose(ex: ExerciseKey, p: number): Lm[] {
  const lm = blank(); const rad = (d: number) => (d * Math.PI) / 180;
  if (ex === 'squat') {
    const A = { x: 0.5, y: 0.9 }, s = rad(25 * p), t = rad(85 * p), b = rad(10 + 30 * p);
    const K = { x: A.x + 0.2 * Math.sin(s), y: A.y - 0.2 * Math.cos(s) };
    const H = { x: K.x - 0.2 * Math.sin(t), y: K.y - 0.2 * Math.cos(t) };
    const S = { x: H.x + 0.25 * Math.sin(b), y: H.y - 0.25 * Math.cos(b) };
    both(lm, 27, 28, A.x, A.y, 0); both(lm, 25, 26, K.x, K.y, 0); both(lm, 23, 24, H.x, H.y, 0); both(lm, 11, 12, S.x, S.y, 0);
    set(lm, 0, S.x + 0.1 * Math.sin(b), S.y - 0.1 * Math.cos(b)); both(lm, 13, 14, S.x + 0.1, S.y + 0.12, 0); both(lm, 15, 16, S.x + 0.2, S.y + 0.12, 0);
  } else if (ex === 'pushup') {
    const h = 0.28 - 0.17 * p, W = { x: 0.7, y: 0.9 }, S = { x: 0.7, y: 0.9 - h };
    const off = Math.sqrt(Math.max(0, 0.0196 - (h * h) / 4)), E = { x: 0.7 - off, y: 0.9 - h / 2 };
    const A = { x: 0.12, y: 0.88 }, Hp = { x: S.x + 0.55 * (A.x - S.x), y: S.y + 0.55 * (A.y - S.y) }, Kn = { x: S.x + 0.8 * (A.x - S.x), y: S.y + 0.8 * (A.y - S.y) };
    both(lm, 15, 16, W.x, W.y, 0); both(lm, 13, 14, E.x, E.y, 0); both(lm, 11, 12, S.x, S.y, 0); both(lm, 23, 24, Hp.x, Hp.y, 0); both(lm, 25, 26, Kn.x, Kn.y, 0); both(lm, 27, 28, A.x, A.y, 0);
    set(lm, 0, S.x + 0.09, S.y - 0.03);
  } else {
    // pull-up: wrists fixed on the bar, arms of length 0.15 + 0.15 fold outward as the shoulders rise
    const Sy = 0.5 - 0.4 * p * 0.5 - 0.0, L = 0.15;
    for (const sg of [-1, 1]) {
      const W = { x: 0.5 + sg * 0.07, y: 0.2 }, S = { x: 0.5 + sg * 0.08, y: Sy }, dd = Math.hypot(S.x - W.x, S.y - W.y), h = Math.sqrt(Math.max(0, L * L - (dd / 2) ** 2));
      const px = (S.y - W.y) / dd, py = -(S.x - W.x) / dd, o = Math.sign(px) === sg ? 1 : -1; // unit normal pointing away from the body
      const E = { x: (S.x + W.x) / 2 + o * px * h, y: (S.y + W.y) / 2 + o * py * h };
      const i = sg < 0 ? [15, 13, 11] : [16, 14, 12];
      set(lm, i[0], W.x, W.y); set(lm, i[1], E.x, E.y); set(lm, i[2], S.x, S.y);
    }
    set(lm, 0, 0.5, Sy - 0.08); both(lm, 23, 24, 0.5, Sy + 0.3, 0.06); both(lm, 25, 26, 0.5, Sy + 0.52, 0.06); both(lm, 27, 28, 0.5, Sy + 0.72, 0.06);
  }
  return lm;
}
/** Smooth 0 → 1 → 0 motion with the given period in seconds. */
export const cycle = (tSec: number, period = 2.4) => (1 - Math.cos((2 * Math.PI * tSec) / period)) / 2;
