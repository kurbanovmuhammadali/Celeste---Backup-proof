import test from 'node:test';
import assert from 'node:assert/strict';
import { createCounter, update, syntheticPose, cycle } from '../src/data/pose.ts';
type Lm = { x: number; y: number; z?: number; visibility?: number };
let seed = 7; const rnd = (a: number) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * a; };
function run(ex: 'pushup' | 'pullup' | 'squat', truth: number, o: { period?: number; amp?: number; jitter?: number; warp?: (lm: Lm[]) => Lm[]; lead?: number; fps?: number } = {}) {
  const { period = 2.6, amp = 1, jitter = 0, warp, lead = 3, fps = 20 } = o;
  let c = createCounter(ex); const T = lead + truth * period + 2;
  for (let f = 0; f < T * fps; f++) {
    const t = f / fps, p = t < lead ? 0 : cycle(t - lead, period) * (t - lead > truth * period ? 0 : 1);
    const world = syntheticPose(ex, Math.max(0, p * amp)) as Lm[];
    let lm = world.map(q => ({ ...q }));
    if (jitter) lm = lm.map(q => ({ ...q, x: q.x + rnd(jitter), y: q.y + rnd(jitter) }));
    if (warp) lm = warp(lm);
    c = update(c, lm, 1e6 + t * 1000, world);
  }
  return c.reps;
}
const squeeze = (k: number) => (lm: Lm[]) => lm.map(q => ({ ...q, x: 0.5 + (q.x - 0.5) * k }));
for (const ex of ['pushup', 'pullup'] as const) {
  test(`${ex}: normal, fast, slow`, () => { assert.equal(run(ex, 6), 6); assert.equal(run(ex, 8, { period: 1.8 }), 8); assert.equal(run(ex, 3, { period: 5 }), 3); });
  test(`${ex}: noisy landmarks`, () => assert.equal(run(ex, 6, { jitter: 0.015 }), 6));
  test(`${ex}: camera angle squeezes the 2D image (world 3D still correct)`, () => assert.equal(run(ex, 6, { warp: squeeze(0.55) }), 6));
  test(`${ex}: standing still counts nothing`, () => { assert.equal(run(ex, 0, { lead: 40 }), 0); assert.equal(run(ex, 0, { lead: 40, jitter: 0.012 }), 0); });
}
test('push-up: a person standing upright is not counted', () => {
  let c = createCounter('pushup');
  for (let f = 0; f < 400; f++) { const t = f / 20; const lm = syntheticPose('squat', 0) as Lm[]; lm[13] = { x: 0.4, y: 0.4 + 0.1 * Math.sin(t * 3), visibility: 1 }; c = update(c, lm, 1e6 + t * 1000); }
  assert.equal(c.reps, 0);
});
test('squats still work', () => assert.equal(run('squat', 5), 5));
