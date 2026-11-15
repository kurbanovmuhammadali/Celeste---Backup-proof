/**
 * Meal detection from body pose. In orbit food is precooked: nobody cooks or photographs it, so the camera only has to
 * answer one question: did the astronaut have their meal? A bite is a hand travelling from far away to the mouth and
 * back. A meal is several bites in one sitting. Uses the same pretrained MediaPipe Pose landmarks as the exercise
 * counter (no training). Drinking looks similar, which is why a meal needs at least MIN_BITES bites in one session.
 *
 * Landmarks (MediaPipe Pose): 9/10 mouth, 11/12 shoulders, 15/16 wrists. y grows downward.
 */
import type { Lm } from './pose';

export const MIN_BITES = 4;
const NEAR = 0.5, FAR = 0.9;          // hand-to-mouth distance in shoulder widths
const MIN_GAP_MS = 800;               // two bites cannot be closer than this
const IDLE_END_MS = 150_000;          // a session ends after this long without a bite
const LOST_END_MS = 60_000;           // ... or this long without seeing the person

export type EatState = { armed: boolean; lastBite: number; lastSeen: number; sessionStart: number | null; bites: number; reported: boolean };
export const createEating = (): EatState => ({ armed: false, lastBite: 0, lastSeen: 0, sessionStart: null, bites: 0, reported: false });

const vis = (p?: Lm) => p?.visibility ?? 1;
const dist = (a: Lm, b: Lm) => Math.hypot(a.x - b.x, a.y - b.y);

/** Hand-to-mouth distance in shoulder widths, or null if the face, shoulders and a wrist are not visible. */
export function handMouth(lm: Lm[] | null): number | null {
  if (!lm || lm.length < 17) return null;
  const [ml, mr, ls, rs] = [lm[9], lm[10], lm[11], lm[12]];
  if (Math.min(vis(ml), vis(mr), vis(ls), vis(rs)) < 0.5) return null;
  const mouth = { x: (ml.x + mr.x) / 2, y: (ml.y + mr.y) / 2 };
  const shoulder = dist(ls, rs);
  if (shoulder < 0.05) return null;
  const wrists = [lm[15], lm[16]].filter(w => vis(w) >= 0.4);
  if (!wrists.length) return null;
  return Math.min(...wrists.map(w => dist(w, mouth))) / shoulder;
}

export type EatEvent = { kind: 'meal' | 'end'; bites: number; start: number; end: number } | null;

/** Feed one frame (null when no person). Returns the new state and an event when a meal is first recognised or a session ends. */
export function eatStep(s: EatState, lm: Lm[] | null, now: number): { state: EatState; event: EatEvent; d: number | null } {
  const d = handMouth(lm);
  let st: EatState = { ...s };
  let event: EatEvent = null;
  if (d != null) {
    st.lastSeen = now;
    if (d > FAR) st.armed = true;
    else if (d < NEAR && st.armed && now - st.lastBite > MIN_GAP_MS) {
      st.armed = false; st.lastBite = now; st.bites += 1; st.sessionStart = st.sessionStart ?? now;
      if (st.bites >= MIN_BITES && !st.reported) { st.reported = true; event = { kind: 'meal', bites: st.bites, start: st.sessionStart, end: now }; }
    }
  }
  const last = Math.max(st.lastBite, 0);
  const idle = st.sessionStart != null && (now - last > IDLE_END_MS || (st.lastSeen && now - st.lastSeen > LOST_END_MS));
  if (idle) {
    if (st.reported) event = { kind: 'end', bites: st.bites, start: st.sessionStart!, end: last };
    st = { ...createEating(), lastSeen: st.lastSeen };
  }
  return { state: st, event, d };
}

/** Synthetic seated person for tests and the no-camera demo. `phase` 0 = hand on the table, 1 = hand at the mouth. */
export function seatedPose(phase: number, opts: { handHeight?: number } = {}): Lm[] {
  const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const set = (i: number, x: number, y: number) => { lm[i] = { x, y, visibility: 1 }; };
  set(0, 0.5, 0.28); set(9, 0.48, 0.31); set(10, 0.52, 0.31); set(11, 0.4, 0.45); set(12, 0.6, 0.45);
  const far = { x: 0.64, y: opts.handHeight ?? 0.72 }, near = { x: 0.53, y: 0.33 };
  set(16, far.x + (near.x - far.x) * phase, far.y + (near.y - far.y) * phase); set(15, 0.36, 0.72);
  return lm;
}
