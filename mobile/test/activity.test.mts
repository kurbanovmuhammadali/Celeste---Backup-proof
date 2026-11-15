import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, classify, createTimeline, observe, segments } from '../src/data/activity.ts';
type Lm = { x: number; y: number; visibility?: number };
const fig = (kneeDrop = 0.18, lying = false): Lm[] => {
  const lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  const set = (i: number, x: number, y: number) => { lm[i] = { x, y, visibility: 1 }; };
  if (lying) { set(11, 0.3, 0.6); set(12, 0.3, 0.66); set(23, 0.55, 0.6); set(24, 0.55, 0.66); set(25, 0.72, 0.6); set(26, 0.72, 0.66); set(27, 0.9, 0.6); set(28, 0.9, 0.66); set(0, 0.2, 0.63); set(13, 0.36, 0.7); set(14, 0.36, 0.7); set(15, 0.45, 0.72); set(16, 0.45, 0.72); }
  else { set(0, 0.5, 0.2); set(11, 0.44, 0.3); set(12, 0.56, 0.3); set(23, 0.46, 0.55); set(24, 0.54, 0.55); set(25, 0.46, 0.55 + kneeDrop); set(26, 0.54, 0.55 + kneeDrop); set(27, 0.46, 0.9); set(28, 0.54, 0.9); set(13, 0.42, 0.42); set(14, 0.58, 0.42); set(15, 0.4, 0.54); set(16, 0.6, 0.54); }
  return lm;
};
test('posture classification', () => {
  assert.equal(classify(fig(0.18)), 'standing'); assert.equal(classify(fig(0.02)), 'sitting'); assert.equal(classify(fig(0.18, true)), 'lying');
  assert.equal(classify(null), 'absent'); assert.equal(classify(fig(), { exercise: 'push-up' }), 'exercising'); assert.equal(classify(fig(), { hipVx: 0.6 }), 'walking'); assert.equal(classify(fig(), { eating: true }), 'eating');
});
test('timeline ignores flicker and merges, then the report reads like a person wrote it', () => {
  let tl = createTimeline(); const T0 = new Date(2026, 10, 15, 9, 0).getTime();
  const plan: [number, 'sitting' | 'standing' | 'exercising' | 'absent'][] = [[0, 'sitting'], [600, 'standing'], [602, 'sitting'], [900, 'exercising'], [1200, 'sitting']];
  for (let s = 0; s < 1500; s++) { const st = [...plan].reverse().find(p => s >= p[0])![1]; tl = observe(tl, st, T0 + s * 1000); }
  const segs = segments(tl, T0 + 1500 * 1000);
  assert.deepEqual(segs.map(s => s.state), ['sitting', 'exercising', 'sitting']);
  const r = buildReport({ name: 'Ada Orbit', from: T0, to: T0 + 1500 * 1000, segs, reps: { 'push-up': 24 }, bites: 0, objects: { cup: 3, laptop: 5 }, incidents: [] });
  assert.match(r.summary, /Ada was watched from/); assert.match(r.summary, /24 push-ups/); assert.match(r.summary, /laptop, cup/); assert.match(r.summary, /No collapse/);
});
