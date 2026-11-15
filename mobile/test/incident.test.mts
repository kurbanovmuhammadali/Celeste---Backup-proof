import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetector, detect } from '../src/data/incident.ts';
type Lm = { x: number; y: number; visibility?: number };
/** A standing figure, rotated about the hips by `deg` (0 upright, 90 lying), plus optional shaking of every joint. */
function figure(deg: number, shake = 0, t = 0, hipX = 0.5): Lm[] {
  const base: Record<number, [number, number]> = { 0: [0, -0.35], 11: [-0.06, -0.25], 12: [0.06, -0.25], 13: [-0.1, -0.12], 14: [0.1, -0.12], 15: [-0.12, 0.0], 16: [0.12, 0.0], 23: [-0.04, 0], 24: [0.04, 0], 25: [-0.04, 0.18], 26: [0.04, 0.18], 27: [-0.04, 0.36], 28: [0.04, 0.36] };
  const a = (deg * Math.PI) / 180, lm: Lm[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  for (const [i, [x, y]] of Object.entries(base)) {
    const X = (x * Math.cos(a) - y * Math.sin(a)) / (4 / 3) * 1, Y = x * Math.sin(a) + y * Math.cos(a);
    const w = shake ? Math.sin(2 * Math.PI * 4 * t + Number(i)) * shake : 0;
    lm[Number(i)] = { x: hipX + X + w * 0.5, y: 0.6 + Y + w * 0.4, visibility: 1 };
  }
  return lm;
}
const run = (frames: (t: number) => Lm[] | null, secs: number, fps = 15, exercising = false) => {
  let s = createDetector(); const ev: { kind: string; at: number }[] = [];
  for (let f = 0; f < secs * fps; f++) { const t = f / fps; const r = detect(s, frames(t), 1e6 + t * 1000, { exercising }); s = r.state; r.events.forEach(e => ev.push({ kind: e.kind, at: t })); }
  return ev;
};
const kinds = (e: { kind: string }[]) => [...new Set(e.map(x => x.kind))];

test('standing, walking and sitting still raise nothing', () => {
  assert.deepEqual(run(() => figure(0), 60), []);
  assert.deepEqual(run(t => figure(0, 0, t, 0.3 + 0.2 * Math.sin(t / 3)), 60), []);
});
test('a fast fall is a collapse, then no movement is unresponsive', () => {
  const ev = run(t => figure(t < 5 ? 0 : t < 5.6 ? ((t - 5) / 0.6) * 90 : 90), 50);
  assert.ok(kinds(ev).includes('collapse')); assert.ok(kinds(ev).includes('unresponsive'));
  assert.ok(ev.find(e => e.kind === 'collapse')!.at < 10);
  assert.ok(ev.find(e => e.kind === 'unresponsive')!.at > 20);
});
test('lying down slowly on purpose (10 s) is not a collapse, even lying still for minutes', () => {
  assert.deepEqual(run(t => figure(t < 5 ? 0 : t < 15 ? ((t - 5) / 10) * 90 : 90), 200), []);
});
test('a fall while the exercise counter is active is ignored (floor exercises)', () => {
  assert.deepEqual(run(t => figure(t < 5 ? 0 : t < 5.6 ? ((t - 5) / 0.6) * 90 : 90), 30, 15, true), []);
});
test('rhythmic shaking after a fall is a seizure alert', () => {
  const ev = run(t => figure(t < 3 ? 0 : t < 3.5 ? ((t - 3) / 0.5) * 90 : 90, t >= 4 && t < 20 ? 0.06 : 0, t), 40);
  assert.ok(kinds(ev).includes('seizure'), JSON.stringify(ev)); assert.ok(kinds(ev).includes('collapse'));
});
test('shaking while standing (dancing, tremor) is not a seizure', () => assert.deepEqual(run(t => figure(0, 0.05, t), 40), []));
test('nobody in frame, or a person who walks out, raises nothing', () => { assert.deepEqual(run(() => null, 60), []); assert.deepEqual(run(t => (t < 10 ? figure(0) : null), 60), []); });
