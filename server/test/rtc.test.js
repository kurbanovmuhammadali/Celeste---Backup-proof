process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
process.env.CAMERA_STATION = 'on';
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
const { app } = await import('../src/index.js');
const { attachRtc } = await import('../src/rtc.js');
const { loginAs } = await import('./support/people.js');

const srv = app.listen(0); attachRtc(srv);
const port = srv.address().port, base = `http://localhost:${port}`;
const jar = () => { let cookie = ''; return { call: async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
}, cookie: () => cookie }; };
const crew = jar(), admin = jar();
const open = (q, cookie) => new Promise(res => {
  const ws = new WebSocket(`ws://localhost:${port}/rtc?${q}`, { headers: cookie ? { cookie } : {} });
  ws.msgs = []; ws.on('message', m => ws.msgs.push(JSON.parse(String(m))));
  ws.on('open', () => res({ ok: true, ws })); ws.on('error', () => res({ ok: false })); ws.on('unexpected-response', () => res({ ok: false }));
});
const wait = async (ws, type) => { for (let i = 0; i < 60; i++) { const m = ws.msgs.find(x => x.type === type); if (m) return m; await new Promise(r => setTimeout(r, 25)); } throw new Error('no ' + type); };
let me;
test('setup', async () => {
  me = (await loginAs((...a) => crew.call(...a), 'crew')).body.user;
  await loginAs((...a) => admin.call(...a), 'admin');
});
test('unauthorised connections are refused', async () => {
  assert.equal((await open(`role=view&user=${me.id}`)).ok, false);                       // no session
  assert.equal((await open(`role=view&user=${me.id}`, crew.cookie())).ok, false);        // an astronaut is not a surgeon
  assert.equal((await open('role=pub&token=not-a-real-token-at-all-0000')).ok, false);
  assert.equal((await open('role=pub&station=99999')).ok, false);
});
test('station camera and surgeon exchange offer, answer and ICE', async () => {
  const v = await open(`role=view&user=${me.id}`, admin.cookie()); assert.ok(v.ok);
  await wait(v.ws, 'no-publisher');
  const p = await open(`role=pub&station=${me.id}`); assert.ok(p.ok);
  const joined = await wait(p.ws, 'viewer-joined'); await wait(v.ws, 'publisher-ready');
  p.ws.send(JSON.stringify({ type: 'offer', to: joined.id, sdp: 'OFFER' }));
  assert.equal((await wait(v.ws, 'offer')).sdp, 'OFFER');
  v.ws.send(JSON.stringify({ type: 'answer', sdp: 'ANSWER' }));
  const a = await wait(p.ws, 'answer'); assert.equal(a.sdp, 'ANSWER'); assert.equal(a.from, joined.id);
  v.ws.send(JSON.stringify({ type: 'ice', candidate: { c: 1 } }));
  assert.deepEqual((await wait(p.ws, 'ice')).candidate, { c: 1 });
  const st = await admin.call('GET', `/api/admin/crew/${me.id}/cam`);
  assert.equal(st.body.live, true); assert.equal(st.body.viewing, true); assert.equal(st.body.rtc, true);
  p.ws.close(); await wait(v.ws, 'publisher-left'); v.ws.close();
  await new Promise(r => setTimeout(r, 100));
  assert.equal((await admin.call('GET', `/api/admin/crew/${me.id}/cam`)).body.live, false);
});
test.after(() => { srv.close(); setTimeout(() => process.exit(0), 50); });
