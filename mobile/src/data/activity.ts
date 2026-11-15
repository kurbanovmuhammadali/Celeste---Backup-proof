/**
 * Local "activity AI" for the camera station. Free, offline, nothing leaves the device:
 *   pose model (MediaPipe)  -> posture and movement per moment (standing, sitting, lying, walking)
 *   exercise counter        -> push-ups, pull-ups, squats and reps
 *   eating detector         -> a meal and its bites
 *   object detector         -> cup, bottle, laptop, phone ... for context
 * These are turned into a timeline and a plain-language report for the flight surgeon. It describes what the camera saw; it does not
 * judge health.
 */
import type { Lm } from './pose';
import { postureOf } from './incident';

export type ActState = 'absent' | 'standing' | 'sitting' | 'lying' | 'walking' | 'exercising' | 'eating';
export type Segment = { state: ActState; label: string; from: number; to: number; detail: string };
const vis = (p?: Lm) => p?.visibility ?? 1;

/** Posture of one frame; `hipVx` is horizontal hip speed in torso lengths per second. */
export function classify(lm: Lm[] | null, ctx: { exercise?: string | null; eating?: boolean; hipVx?: number; aspect?: number } = {}): ActState {
  if (!lm) return 'absent';
  if (ctx.exercise) return 'exercising';
  if (ctx.eating) return 'eating';
  const p = postureOf(lm, ctx.aspect);
  if (!p) return 'absent';
  if (p.posture === 'lying') return 'lying';
  if ((ctx.hipVx ?? 0) > 0.35) return 'walking';
  const kv = Math.min(vis(lm[25]), vis(lm[26]));
  if (kv < 0.4) return 'sitting'; // upper body only: at a desk or close to the camera
  const hipY = (lm[23].y + lm[24].y) / 2, kneeY = (lm[25].y + lm[26].y) / 2;
  return (kneeY - hipY) / Math.max(p.torso, 0.05) < 0.4 ? 'sitting' : 'standing';
}

const WORD: Record<ActState, string> = { absent: 'out of view', standing: 'standing', sitting: 'seated', lying: 'lying down', walking: 'walking around', exercising: 'exercising', eating: 'eating' };
export type Timeline = { cur: ActState | null; since: number; segs: Segment[]; recent: { t: number; s: ActState }[] };
export const createTimeline = (): Timeline => ({ cur: null, since: 0, segs: [], recent: [] });

/** Adds one observation. A state must hold for 2 s to count (so a flicker never makes a segment). */
export function observe(tl: Timeline, state: ActState, now: number, detail = ''): Timeline {
  const recent = [...tl.recent.filter(r => now - r.t < 2500), { t: now, s: state }];
  const counts = new Map<ActState, number>(); recent.forEach(r => counts.set(r.s, (counts.get(r.s) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  let { cur, since, segs } = tl;
  if (cur == null) { cur = top; since = now; }
  else if (top !== cur && recent[0] && now - recent[0].t > 1500) { segs = [...segs, { state: cur, label: WORD[cur], from: since, to: now, detail }]; cur = top; since = now; }
  else if (detail && cur === top) segs = segs.map((s, i) => i === segs.length - 1 && false ? s : s);
  return { cur, since, segs, recent };
}
/** The timeline so far, including the segment still in progress; very short segments are folded into their neighbours. */
export function segments(tl: Timeline, now: number, details: Partial<Record<ActState, string>> = {}): Segment[] {
  const all = tl.cur ? [...tl.segs, { state: tl.cur, label: WORD[tl.cur], from: tl.since, to: now, detail: '' }] : tl.segs;
  const out: Segment[] = [];
  for (const s of all) {
    const dur = s.to - s.from; const last = out[out.length - 1];
    if (last && (last.state === s.state || dur < 4000)) { last.to = s.to; } else out.push({ ...s });
  }
  return out.map(s => ({ ...s, detail: details[s.state] ?? s.detail }));
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const span = (ms: number) => { const s = Math.round(ms / 1000); return s < 90 ? `${s} s` : `${Math.round(s / 60)} min`; };

export type ReportInput = { name: string; from: number; to: number; segs: Segment[]; reps: Record<string, number>; bites: number; objects: Record<string, number>; incidents: string[] };
/** Plain-language report. Deterministic template (no cloud AI): the same input always gives the same words. */
export function buildReport(r: ReportInput): { summary: string; segments: Segment[] } {
  const first = r.name.split(' ')[0] || 'The crew member';
  const total = Math.max(1, r.to - r.from), seen = r.segs.filter(s => s.state !== 'absent');
  const by = new Map<ActState, number>(); seen.forEach(s => by.set(s.state, (by.get(s.state) ?? 0) + (s.to - s.from)));
  const lines: string[] = [`${first} was watched from ${clock(r.from)} to ${clock(r.to)} (${span(total)}).`];
  const mix = [...by.entries()].sort((a, b) => b[1] - a[1]).map(([s, ms]) => `${WORD[s]} ${span(ms)}`);
  if (mix.length) lines.push(`Time in view: ${mix.join(', ')}.`);
  const absent = r.segs.filter(s => s.state === 'absent').reduce((a, s) => a + (s.to - s.from), 0);
  if (absent > total * 0.3) lines.push(`${first} was out of view for ${span(absent)}.`);
  const ex = Object.entries(r.reps).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}${n === 1 ? '' : 's'}`);
  if (ex.length) lines.push(`Exercise counted: ${ex.join(', ')}.`);
  if (r.bites > 0) lines.push(`Eating seen: about ${r.bites} bites.`);
  else if (by.has('eating')) lines.push('Eating seen.');
  const objs = Object.entries(r.objects).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k);
  if (objs.length) lines.push(`Objects seen nearby: ${objs.join(', ')}.`);
  lines.push(r.incidents.length ? `Alerts raised: ${r.incidents.join('; ')}.` : 'No collapse, shaking or long stillness was detected.');
  return { summary: lines.join(' '), segments: r.segs };
}
