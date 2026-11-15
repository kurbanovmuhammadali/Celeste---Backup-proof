/**
 * Emergency detection from body pose (MediaPipe landmarks), 100% on the device. No model was trained: it is geometry and timing.
 *
 *  collapse      standing, then lying within 2 s (a fast fall, not lying down on purpose), and still lying 3 s later
 *  seizure       rhythmic, whole-body shaking (2-8 Hz in at least 5 joints incl. head or shoulders) for 5 s while lying or just after a collapse
 *  unresponsive  after a collapse or a seizure, almost no movement for 20 s
 *
 * IMPORTANT: this is NOT a medical device and cannot see death or diagnose epilepsy. It spots "a person fell / is shaking / is not
 * moving" so that humans check immediately. It can be wrong in both directions, which is why every alert says so.
 */
import type { Lm } from './pose';

const I = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28 };
const JOINTS = [I.nose, I.lSh, I.rSh, I.lEl, I.rEl, I.lWr, I.rWr, I.lHip, I.rHip, I.lAnk, I.rAnk];
const vis = (p?: Lm) => p?.visibility ?? 1;
export type Posture = 'standing' | 'lying' | 'other';
export type IncidentKind = 'collapse' | 'seizure' | 'unresponsive';
export type Detection = { kind: IncidentKind; confidence: number; evidence: string };
type Sample = { t: number; p: [number, number][] };
export type DetectorState = {
  buf: Sample[]; lastUprightAt: number; lyingSince: number | null; collapseAt: number | null; collapseAlerted: boolean; seizureSince: number | null; seizureAt: number | null;
  stillSince: number | null; unresponsiveAlerted: boolean; lastAlert: Record<string, number>; posture: Posture; motion: number; rhythmic: number; torsoLen: number;
};
export const createDetector = (): DetectorState => ({ buf: [], lastUprightAt: 0, lyingSince: null, collapseAt: null, collapseAlerted: false, seizureSince: null, seizureAt: null, stillSince: null, unresponsiveAlerted: false, lastAlert: {}, posture: 'other', motion: 0, rhythmic: 0, torsoLen: 0.25 });

const mid = (a: Lm, b: Lm): [number, number] => [(a.x + b.x) / 2, (a.y + b.y) / 2];

/** Posture from one frame: torso angle from vertical and the body's bounding box. aspect = video width / height. */
export function postureOf(lm: Lm[], aspect = 4 / 3): { posture: Posture; angle: number; ratio: number; torso: number } | null {
  const need = [I.lSh, I.rSh, I.lHip, I.rHip];
  if (!lm || lm.length < 29 || need.some(i => vis(lm[i]) < 0.4)) return null;
  const [sx, sy] = mid(lm[I.lSh], lm[I.rSh]), [hx, hy] = mid(lm[I.lHip], lm[I.rHip]);
  const dx = (hx - sx) * aspect, dy = hy - sy, torso = Math.hypot(dx, dy);
  const angle = (Math.atan2(Math.abs(dx), dy) * 180) / Math.PI; // 0 = upright, 90 = horizontal, >90 = inverted
  const pts = JOINTS.concat([I.lKnee, I.rKnee]).map(i => lm[i]).filter(p => vis(p) >= 0.4);
  const xs = pts.map(p => p.x * aspect), ys = pts.map(p => p.y);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), ratio = h / Math.max(w, 0.01);
  const posture: Posture = angle < 30 && ratio > 1.15 ? 'standing' : angle > 60 && ratio < 1.0 ? 'lying' : 'other';
  return { posture, angle, ratio, torso };
}

const WINDOW_S = 6;
/** Zero-crossing frequency (Hz) and amplitude (in torso lengths) of a detrended signal. */
function oscillation(sig: number[], times: number[], torso: number): { f: number; amp: number } {
  const n = sig.length; if (n < 12) return { f: 0, amp: 0 };
  const dur = (times[n - 1] - times[0]) / 1000; if (dur < 2) return { f: 0, amp: 0 };
  // detrend with a ~1 s moving average
  const hp = sig.map((v, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 4); j <= Math.min(n - 1, i + 4); j++) { s += sig[j]; c++; } return v - s / c; });
  const sd = Math.sqrt(hp.reduce((a, b) => a + b * b, 0) / n);
  let cross = 0; const eps = sd * 0.25;
  for (let i = 1; i < n; i++) if ((hp[i - 1] < -eps && hp[i] > eps) || (hp[i - 1] > eps && hp[i] < -eps)) cross++;
  return { f: cross / 2 / dur, amp: (sd * 2.8) / Math.max(torso, 0.05) };
}

/** Feed one frame (null = nobody visible). `exercising` suppresses collapse alerts while a rep counter is active. */
export function detect(s: DetectorState, lm: Lm[] | null, now: number, opts: { exercising?: boolean; aspect?: number } = {}): { state: DetectorState; events: Detection[] } {
  const events: Detection[] = [];
  const pst = lm ? postureOf(lm, opts.aspect) : null;
  if (!lm || !pst) return { state: { ...s, posture: 'other' }, events };
  const aspect = opts.aspect ?? 4 / 3;
  const p: [number, number][] = JOINTS.map(i => [lm[i].x * aspect, lm[i].y]);
  const buf = [...s.buf.filter(x => now - x.t < WINDOW_S * 1000), { t: now, p }];
  const st: DetectorState = { ...s, buf, posture: pst.posture, torsoLen: s.torsoLen * 0.9 + pst.torso * 0.1 };
  const fire = (kind: IncidentKind, confidence: number, evidence: string) => {
    if (now - (st.lastAlert[kind] ?? -1e9) < 60_000) return;
    st.lastAlert = { ...st.lastAlert, [kind]: now }; events.push({ kind, confidence, evidence });
  };

  // motion energy: mean joint speed in torso lengths per second over the last 2 s
  const recent = buf.filter(x => now - x.t < 2000);
  if (recent.length >= 4) {
    let tot = 0, n = 0;
    for (let i = 1; i < recent.length; i++) { const dt = (recent[i].t - recent[i - 1].t) / 1000; if (dt <= 0) continue; for (let j = 0; j < JOINTS.length; j++) { tot += Math.hypot(recent[i].p[j][0] - recent[i - 1].p[j][0], recent[i].p[j][1] - recent[i - 1].p[j][1]) / dt; n++; } }
    st.motion = n ? tot / n / Math.max(st.torsoLen, 0.05) : 0;
  }

  // rhythmic whole-body shaking
  let shaking = 0, head = false;
  if (buf.length >= 12 && now - buf[0].t > 4000) {
    const times = buf.map(x => x.t);
    JOINTS.forEach((_, j) => { for (const axis of [0, 1]) { const o = oscillation(buf.map(x => x.p[j][axis]), times, st.torsoLen); if (o.f >= 2 && o.f <= 8 && o.amp > 0.12) { shaking++; if (j <= 2) head = true; break; } } });
  }
  st.rhythmic = shaking;
  const shakingNow = shaking >= 5 && head;

  if (pst.posture === 'standing') { st.lastUprightAt = now; st.lyingSince = null; st.stillSince = null; if (!shakingNow) { st.collapseAt = null; st.collapseAlerted = false; st.unresponsiveAlerted = false; st.seizureSince = null; } }
  if (pst.posture === 'lying' && st.lyingSince == null) {
    st.lyingSince = now;
    if (now - st.lastUprightAt < 2000 && st.lastUprightAt > 0 && !opts.exercising) { st.collapseAt = now; st.collapseAlerted = false; } // upright and lying within 2 s: a fall
  }
  if (pst.posture !== 'lying' && pst.posture !== 'standing') st.lyingSince = pst.posture === 'other' ? st.lyingSince : null;

  if (st.collapseAt != null && !st.collapseAlerted && pst.posture === 'lying' && now - st.collapseAt >= 3000) { st.collapseAlerted = true; fire('collapse', 0.75, 'Stood up, then was on the floor within 2 seconds and stayed there.'); }

  const lyingOrFell = pst.posture === 'lying' || (st.collapseAt != null && now - st.collapseAt < 25_000);
  if (shakingNow && lyingOrFell && !opts.exercising) {
    st.seizureSince = st.seizureSince ?? now;
    if (now - st.seizureSince >= 5000) { st.seizureAt = now; fire('seizure', pst.posture === 'lying' ? 0.8 : 0.65, `Rhythmic whole-body shaking (${shaking} joints, 2-8 Hz) for ${Math.round((now - st.seizureSince) / 1000)} s${pst.posture === 'lying' ? ' while lying down' : ' after a fall'}.`); }
  } else if (!shakingNow) st.seizureSince = null;

  // not moving after a fall or a seizure
  const downEvent = (st.collapseAt != null && now - st.collapseAt < 180_000) || (st.seizureAt != null && now - st.seizureAt < 180_000);
  if (downEvent && pst.posture === 'lying' && st.motion < 0.12 && !shakingNow) {
    st.stillSince = st.stillSince ?? now;
    if (!st.unresponsiveAlerted && now - st.stillSince >= 20_000) { st.unresponsiveAlerted = true; fire('unresponsive', 0.7, 'Lying on the floor after a fall or shaking, with almost no movement for 20 seconds.'); }
  } else if (st.motion >= 0.2) st.stillSince = null;
  return { state: st, events };
}
