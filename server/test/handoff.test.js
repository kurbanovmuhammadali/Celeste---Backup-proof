process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
import test from 'node:test';
import assert from 'node:assert/strict';
const { app } = await import('../src/index.js');
const { loginAs } = await import('./support/people.js');
const srv = app.listen(0); const base = `http://localhost:${srv.address().port}`;
const jar = () => { let cookie = ''; return async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
}; };
const crew = jar(), admin = jar();
const report = { title: 'New symptom', reason: 'New symptom', missionDay: 12, queuedAt: Date.now(), lines: [{ h: 'Symptoms', t: 'Headache' }] };
let me;
test('a queued report reaches the surgeon, who acknowledges it; the astronaut sees the reply', async () => {
  me = (await loginAs(crew, 'crew')).body.user; await loginAs(admin, 'admin');
  assert.equal((await crew('PUT', '/api/me/handoffs/abc12345', report)).status, 200);
  assert.equal((await crew('PUT', '/api/me/handoffs/abc12345', report)).status, 200); // idempotent re-send
  assert.equal((await crew('PUT', '/api/me/handoffs/abc12346', { ...report, synthetic: true })).status, 422);
  const all = await admin('GET', '/api/admin/handoffs');
  assert.equal(all.body.open, 1); assert.equal(all.body.handoffs[0].lines[0].t, 'Headache');
  assert.equal((await crew('GET', '/api/admin/handoffs')).status, 403);
  assert.equal((await admin('GET', '/api/admin/crew')).body.crew.find(c => c.id === me.id).openHandoffs, 1);
  assert.equal((await admin('GET', `/api/admin/crew/${me.id}`)).body.handoffs.length, 1);
  assert.equal((await admin('POST', `/api/admin/handoffs/${me.id}/abc12345/ack`, { note: 'Rest today' })).status, 200);
  await crew('PUT', '/api/me/handoffs/abc12345', report); // re-send must not reopen it
  const mine = (await crew('GET', '/api/me/handoffs')).body.handoffs[0];
  assert.equal(mine.ackNote, 'Rest today'); assert.ok(mine.ackAt);
  assert.equal((await admin('GET', '/api/admin/handoffs')).body.open, 0);
  assert.equal((await admin('POST', `/api/admin/handoffs/${me.id}/nope1234/ack`, {})).status, 404);
});
test.after(() => { srv.close(); setTimeout(() => process.exit(0), 50); });
