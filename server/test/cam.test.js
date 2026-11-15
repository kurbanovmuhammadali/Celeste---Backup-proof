process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
process.env.CAMERA_STATION = 'on';
import test from 'node:test';
import assert from 'node:assert/strict';
const { app } = await import('../src/index.js');
const { loginAs } = await import('./support/people.js');

const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}`;
const jar = () => { let cookie = ''; return async (method, path, body, raw) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return raw ? r : { status: r.status, body: await r.json() };
}; };
const crew = jar(), admin = jar(), phone = jar(); // the phone has NO account and no cookie
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);
const dataUrl = b => `data:image/jpeg;base64,${b.toString('base64')}`;
let me, token;

test('setup: demo crew and surgeon sign in; the astronaut creates the secret link', async () => {
  me = (await loginAs(crew, 'crew')).body.user;
  await loginAs(admin, 'admin');
  const r = await crew('POST', '/api/me/cam-link', {});
  assert.equal(r.status, 200); token = r.body.token; assert.ok(token.length >= 30);
  assert.equal((await crew('POST', '/api/me/cam-link', {})).body.token, token); // stable until rotated
});
test('a wrong or malformed link is rejected', async () => {
  assert.equal((await phone('GET', '/api/cam/not-a-real-token-at-all-0000/info')).status, 404);
  assert.equal((await phone('POST', '/api/cam/x/frame', { image: dataUrl(JPEG) })).status, 404);
});
test('the phone (no account) sends frames; only a signed-in surgeon can read them', async () => {
  assert.equal((await phone('GET', `/api/cam/${token}/info`)).body.name.length > 0, true);
  assert.equal((await admin('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true)).status, 404); // nothing yet
  assert.equal((await phone('POST', `/api/cam/${token}/frame`, { image: dataUrl(JPEG) })).status, 200);
  const f = await admin('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true);
  assert.equal(f.status, 200); assert.equal(f.headers.get('content-type'), 'image/jpeg'); assert.deepEqual(Buffer.from(await f.arrayBuffer()), JPEG);
  assert.equal((await crew('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true)).status, 403); // the astronaut is not a surgeon
  assert.equal((await phone('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true)).status, 401); // the phone link cannot read it back
});
test('status: live, and the astronaut is told a surgeon is watching', async () => {
  assert.equal((await admin('GET', `/api/admin/crew/${me.id}/cam`)).body.live, true);
  const s = (await crew('GET', '/api/me/cam-status')).body; assert.equal(s.live, true); assert.equal(s.viewing, true);
});
test('bad frames are rejected', async () => {
  assert.equal((await phone('POST', `/api/cam/${token}/frame`, { image: 'data:text/plain;base64,aGk=' })).status, 400);
  assert.equal((await phone('POST', `/api/cam/${token}/frame`, { image: dataUrl(Buffer.from('not a jpeg')) })).status, 400);
  assert.equal((await phone('POST', `/api/cam/${token}/frame`, { image: dataUrl(Buffer.concat([JPEG.subarray(0, 4), Buffer.alloc(210 * 1024)])) })).status, 413);
});
test('camera meal detection: reported by the phone, shown to the astronaut and the surgeon', async () => {
  const now = Date.now();
  const rep = (o) => phone('POST', `/api/cam/${token}/meal`, { kind: 'meal', bites: 4, start: now - 20000, end: now - 5000, localMinutes: 7 * 60 + 40, ...o });
  assert.equal((await rep({})).body.slot, 'breakfast');
  assert.equal((await rep({ bites: 9, kind: 'end', end: now })).status, 200); // same sitting: bites grow, still one meal
  assert.equal((await rep({ localMinutes: 13 * 60, bites: 6 })).body.slot, 'lunch');
  const mine = (await crew('GET', '/api/me/meal-events')).body.events;
  assert.deepEqual(mine.map(e => e.slot).sort(), ['breakfast', 'lunch']);
  assert.equal(mine.find(e => e.slot === 'breakfast').bites, 9);
  const d = (await admin('GET', `/api/admin/crew/${me.id}`)).body;
  assert.equal(d.mealEvents.length, 2);
  assert.ok((await admin('GET', '/api/admin/crew')).body.crew.find(c => c.id === me.id).cameraMeals.includes('lunch'));
  for (const bad of [{ bites: 0 }, { bites: 999 }, { kind: 'x' }, { end: now - 10 * 3600e3 }]) assert.equal((await rep(bad)).status, 400);
  assert.equal((await phone('POST', '/api/cam/not-a-real-token-at-all-0000/meal', { kind: 'meal', bites: 5, start: now, end: now })).status, 404);
  assert.equal((await crew('GET', '/api/admin/crew')).status, 403);
});
test('stop ends the stream; rotating the link kills the old one', async () => {
  assert.equal((await phone('POST', `/api/cam/${token}/stop`, {})).status, 200);
  assert.equal((await admin('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true)).status, 404);
  const t2 = (await admin('POST', `/api/admin/crew/${me.id}/cam-link`, { rotate: true })).body.token;
  assert.notEqual(t2, token);
  assert.equal((await phone('GET', `/api/cam/${token}/info`)).status, 404);
  assert.equal((await phone('GET', `/api/cam/${t2}/info`)).status, 200);
  assert.equal((await crew('POST', `/api/admin/crew/${me.id}/cam-link`, {})).status, 403);
});
test('camera station: pick an astronaut (no sign-in), film him, the surgeon sees it; it can be switched off', async () => {
  const list = (await phone('GET', '/api/station/crew')).body.crew;
  assert.ok(list.length >= 4); assert.ok(list.every(c => c.id && c.name) && !JSON.stringify(list).includes('@')); // names only, no emails
  assert.ok(!list.some(c => c.name.startsWith('Dr.')), 'the surgeon is not listed');
  assert.equal((await phone('GET', `/api/station/${me.id}/info`)).body.ok, true);
  assert.equal((await phone('POST', `/api/station/${me.id}/frame`, { image: dataUrl(JPEG) })).status, 200);
  const f = await admin('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true);
  assert.equal(f.status, 200); assert.deepEqual(Buffer.from(await f.arrayBuffer()), JPEG);
  assert.equal((await phone('GET', `/api/admin/crew/${me.id}/cam/frame.jpg`, null, true)).status, 401); // the station cannot read frames back
  assert.equal((await phone('POST', `/api/station/${me.id}/frame`, { image: dataUrl(Buffer.from('nope')) })).status, 400);
  const now = Date.now();
  assert.equal((await phone('POST', `/api/station/${me.id}/meal`, { kind: 'meal', bites: 5, start: now - 9000, end: now, localMinutes: 19 * 60 })).body.slot, 'dinner');
  const surgeon = (await admin('GET', '/api/auth/me')).body.user;
  assert.equal((await phone('GET', `/api/station/${surgeon.id}/info`)).status, 404); // cannot film the surgeon account
  assert.equal((await phone('GET', '/api/station/99999/info')).status, 404);
  assert.equal((await phone('POST', `/api/station/${me.id}/stop`, {})).status, 200);
  process.env.CAMERA_STATION = 'off';
  assert.equal((await phone('GET', '/api/station/crew')).status, 401);
  assert.equal((await phone('POST', `/api/station/${me.id}/frame`, { image: dataUrl(JPEG) })).status, 404);
  process.env.CAMERA_STATION = 'on';
});
test('camera station when signed in (production style): a doctor films anyone, a crew member only themselves and crew mates', async () => {
  process.env.CAMERA_STATION = 'off'; // demo shortcut off: only signed-in accounts work
  const a = await admin('GET', '/api/station/crew'); assert.equal(a.status, 200); assert.ok(a.body.crew.length >= 4);
  const c = await crew('GET', '/api/station/crew'); assert.equal(c.status, 200);
  assert.deepEqual(c.body.crew.map(x => x.id), [me.id]); // no crew yet: only themselves
  assert.equal((await crew('GET', `/api/station/${me.id}/info`)).status, 200);
  const other = a.body.crew.find(x => x.id !== me.id);
  assert.equal((await crew('GET', `/api/station/${other.id}/info`)).status, 404);
  assert.equal((await phone('GET', `/api/station/${me.id}/info`)).status, 404);
  process.env.CAMERA_STATION = 'on';
});
test.after(() => srv.close());
