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
const jar = () => { let cookie = ''; const f = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => ({})) };
}; f.cookie = () => cookie; return f; };
const reg = (name, email) => ({ name, email, password: 'orbit2026', dob: '1990-04-12', acceptTerms: true, acceptPrivacy: true, consentHealth: true });
const [ada, ben, cy, doc, stranger] = [jar(), jar(), jar(), jar(), jar()];
const sock = (q, cookie) => new Promise(res => { const ws = new WebSocket(`ws://localhost:${port}/rtc?${q}`, { headers: cookie ? { cookie } : {} }); ws.msgs = []; ws.on('message', m => ws.msgs.push(JSON.parse(String(m)))); ws.on('open', () => res(ws)); ws.on('error', () => res(null)); ws.on('unexpected-response', () => res(null)); });
const wait = async (ws, pred, ms = 2000) => { for (let i = 0; i < ms / 25; i++) { const m = ws.msgs.find(pred); if (m) return m; await new Promise(r => setTimeout(r, 25)); } throw new Error('timeout'); };
let adaId, benId, cyId, code;

test('setup: three astronauts and a surgeon', async () => {
  adaId = (await ada('POST', '/api/auth/register', reg('Ada Orbit', 'ada@t.test'))).body.user.id;
  benId = (await ben('POST', '/api/auth/register', reg('Ben Lunar', 'ben@t.test'))).body.user.id;
  cyId = (await cy('POST', '/api/auth/register', reg('Cy Mars', 'cy@t.test'))).body.user.id;
  await loginAs(doc, 'admin'); await stranger('POST', '/api/auth/register', reg('Zed Stranger', 'zed@t.test'));
});
test('create / join a crew; wrong code; one crew per person', async () => {
  const c = await ada('POST', '/api/crew', { name: 'Odyssey' }); assert.equal(c.status, 200); code = c.body.crew.code; assert.match(code, /^[A-Z0-9]{3}-[A-Z0-9]{3}$/); assert.equal(c.body.crew.role, 'commander');
  assert.equal((await ben('POST', '/api/crew/join', { code: 'ZZZ-ZZZ' })).status, 404);
  assert.equal((await ben('POST', '/api/crew/join', { code: code.replace('-', '').toLowerCase() })).status, 200); // forgiving input
  await cy('POST', '/api/crew/join', { code });
  assert.equal((await ben('POST', '/api/crew/join', { code })).status, 409);
  const v = (await ben('GET', '/api/crew')).body.crew; assert.equal(v.members.length, 3);
});
test('only the commander shares the mission and posts announcements', async () => {
  assert.equal((await ben('PUT', '/api/crew/briefing', { briefing: { destination: 'mars' } })).status, 403);
  assert.equal((await ada('PUT', '/api/crew/briefing', { briefing: { destination: 'mars', durationDays: 900 } })).status, 200);
  assert.equal((await cy('GET', '/api/crew')).body.crew.briefing.destination, 'mars');
  assert.equal((await ben('POST', '/api/crew/feed', { kind: 'announce', text: 'Hello all' })).status, 403);
  assert.equal((await ben('POST', '/api/crew/feed', { kind: 'kudos', text: 'Thanks Cy for the help' })).body.crew.feed[0].kind, 'kudos');
  assert.equal((await ada('POST', '/api/crew/feed', { kind: 'announce', text: 'EVA prep at 09:00' })).body.crew.feed[0].kind, 'announce');
});
test('crew pulse is hidden until 3 people have added theirs', async () => {
  await ada('POST', '/api/crew/pulse', { mood: 4, stress: 2 }); const two = (await ben('POST', '/api/crew/pulse', { mood: 2, stress: 4 })).body.crew.pulse;
  assert.equal(two.enough, false); assert.equal(two.mood, null);
  const three = (await cy('POST', '/api/crew/pulse', { mood: 3, stress: 3 })).body.crew.pulse; assert.equal(three.enough, true); assert.equal(three.mood, 3); assert.equal(three.stress, 3);
});
test('peer reports are anonymous: surgeons read them, crew mates and the person never do', async () => {
  assert.equal((await ada('POST', '/api/crew/report', { aboutId: adaId, category: 'mood', message: 'about myself' })).status, 400);
  assert.equal((await ada('POST', '/api/crew/report', { aboutId: 99999, category: 'mood', message: 'not in crew' })).status, 404);
  assert.equal((await ben('POST', '/api/crew/report', { aboutId: cyId, category: 'fatigue', message: 'Cy has barely slept this week' })).status, 200);
  await ada('POST', '/api/crew/report', { aboutId: cyId, category: 'mood', message: 'Cy seems withdrawn lately' });
  const r = (await doc('GET', '/api/admin/reports')).body; assert.equal(r.open, 2); assert.equal(r.reports[0].about, 'Cy Mars'); assert.equal(r.reports[0].voices, 2);
  assert.ok(!JSON.stringify(r).includes('Ben') && !JSON.stringify(r).includes('Ada'));              // no reporter identity anywhere
  assert.equal((await cy('GET', '/api/admin/reports')).status, 403); assert.equal((await ben('GET', '/api/admin/reports')).status, 403);
});
test('an emergency alert reaches every surgeon and crew mate live, not strangers; unanswered ones escalate', async () => {
  const docWs = await sock('role=inbox', doc.cookie()), benWs = await sock('role=inbox', ben.cookie()), zedWs = await sock('role=inbox', stranger.cookie()), cyWs = await sock('role=inbox', cy.cookie());
  assert.ok(docWs && benWs && zedWs && cyWs); assert.equal(await sock('role=inbox'), null); // no session -> refused
  const station = await fetch(`${base}/api/station/${cyId}/incident`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'seizure', confidence: 0.8, evidence: 'Rhythmic shaking 4 Hz for 12 s' }) });
  assert.equal(station.status, 200);
  const d = await wait(docWs, m => m.type === 'incident'); assert.equal(d.incident.name, 'Cy Mars'); assert.equal(d.incident.severity, 'critical');
  await wait(benWs, m => m.type === 'incident'); await wait(cyWs, m => m.type === 'incident-self');
  await new Promise(r => setTimeout(r, 150)); assert.equal(zedWs.msgs.some(m => m.type === 'incident'), false);
  const dup = await fetch(`${base}/api/station/${cyId}/incident`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'seizure' }) }); assert.equal((await dup.json()).incident.id, d.incident.id); // no double alert
  assert.equal((await ben('POST', `/api/alerts/${d.incident.id}/ack`, { kind: 'responding' })).body.responding[0], 'Ben');
  assert.equal((await stranger('POST', `/api/alerts/${d.incident.id}/ack`, {})).status, 403);
  assert.equal((await ben('POST', `/api/admin/alerts/${d.incident.id}/resolve`, {})).status, 403); // only a surgeon closes it
  assert.equal((await doc('POST', `/api/admin/alerts/${d.incident.id}/resolve`, { status: 'false_alarm', note: 'drill' })).status, 200);
  await wait(benWs, m => m.type === 'incident-closed'); assert.equal((await ben('GET', '/api/alerts')).body.incidents.length, 0);
  const late = await sock('role=inbox', doc.cookie()); assert.equal(late.msgs.some(m => m.type === 'incident'), false);
  for (const w of [docWs, benWs, zedWs, cyWs, late]) w.close();
});
test('calls: astronaut rings the doctors, a doctor answers; family guest rings the astronaut', async () => {
  const docWs = await sock('role=inbox', doc.cookie()), adaWs = await sock('role=inbox', ada.cookie());
  adaWs.send(JSON.stringify({ type: 'call', to: 'doctors', kind: 'doctor' }));
  const inc = await wait(docWs, m => m.type === 'incoming'); assert.equal(inc.fromName, 'Ada Orbit');
  docWs.send(JSON.stringify({ type: 'accept', callId: inc.callId })); await wait(adaWs, m => m.type === 'accepted');
  adaWs.send(JSON.stringify({ type: 'signal', callId: inc.callId, data: { sdp: 'OFFER' } })); assert.equal((await wait(docWs, m => m.type === 'signal')).data.sdp, 'OFFER');
  docWs.send(JSON.stringify({ type: 'end', callId: inc.callId })); await wait(adaWs, m => m.type === 'ended');
  adaWs.send(JSON.stringify({ type: 'call', to: `u:${benId}`, kind: 'crew' })); assert.equal((await wait(adaWs, m => m.type === 'unavailable')).reason, 'offline'); // Ben is not connected
  const f = (await ada('POST', '/api/me/family', { name: 'Mama', relation: 'Mother' })).body.contact; assert.ok(f.token.length >= 20);
  const guest = await sock(`role=family&token=${f.token}`); assert.ok(guest); assert.equal(await sock('role=family&token=not-a-real-token-0000000'), null);
  guest.send(JSON.stringify({ type: 'call', to: `u:${benId}`, kind: 'family' })); assert.equal((await wait(guest, m => m.type === 'unavailable')).reason, 'not-allowed'); // a guest may only ring their own astronaut
  guest.send(JSON.stringify({ type: 'call', to: 'owner', kind: 'family' })); const ring = await wait(adaWs, m => m.type === 'incoming' && m.kind === 'family'); assert.equal(ring.fromName, 'Mama');
  adaWs.send(JSON.stringify({ type: 'decline', callId: ring.callId })); assert.equal((await wait(guest, m => m.type === 'ended')).reason, 'declined');
  assert.equal((await fetch(`${base}/api/family/${f.token}/info`).then(r => r.json())).astronaut, 'Ada');
  await fetch(`${base}/api/family/${f.token}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'We love you' }) });
  assert.equal((await ada('GET', '/api/me/family')).body.family[0].unread, 1);
  assert.equal((await ada('GET', `/api/me/family/${f.id}/messages`)).body.messages[0].text, 'We love you');
  assert.equal((await ada('GET', '/api/me/family')).body.family[0].unread, 0);
  for (const w of [docWs, adaWs, guest]) w.close();
});
test('face: consent, enrolment, 1:1 sign-in, look-alikes and wrong people rejected, station identifies', async () => {
  const vec = (seed, jitter = 0) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * 7.1 + i * 0.37) * 0.3 + (jitter ? Math.cos(i * 1.7 + seed) * jitter : 0));
  assert.equal((await ada('PUT', '/api/me/face', { descriptors: [vec(1), vec(1, 0.01), vec(1, 0.02)] })).status, 400);                     // no consent
  assert.equal((await ada('PUT', '/api/me/face', { consent: true, descriptors: [vec(1)] })).status, 400);                                  // too few samples
  assert.equal((await ada('PUT', '/api/me/face', { consent: true, descriptors: [vec(1), vec(1, 0.01), vec(1, 0.02)] })).status, 200);
  await ben('PUT', '/api/me/face', { consent: true, descriptors: [vec(2), vec(2, 0.01), vec(2, 0.02)] });
  const anon = jar(); const L = (email, d, live = true) => anon('POST', '/api/auth/face/login', { email, descriptor: d, live });
  assert.equal((await anon('GET', '/api/auth/face/available?email=ada@t.test')).body.available, true); assert.equal((await anon('GET', '/api/auth/face/available?email=cy@t.test')).body.available, false);
  assert.equal((await L('ada@t.test', vec(1, 0.015))).status, 200);                  // her own face
  assert.equal((await L('ada@t.test', vec(2, 0.01))).status, 401);                   // Ben's face on Ada's account
  assert.equal((await L('ada@t.test', vec(1, 0.015), false)).status, 400);           // no liveness step
  assert.equal((await L('nobody@t.test', vec(1))).status, 401);                      // same answer for unknown accounts
  const id = await fetch(`${base}/api/station/identify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor: vec(2, 0.012) }) }).then(r => r.json()); assert.equal(id.id, benId);
  const none = await fetch(`${base}/api/station/identify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ descriptor: vec(9) }) }).then(r => r.json()); assert.equal(none.id, null); // a stranger is not named
  assert.equal((await ada('DELETE', '/api/me/face')).status, 200); assert.equal((await ada('GET', '/api/me/face')).body.enrolled, false);
});
test('ICE servers: STUN always, TURN with expiring credentials only when configured', async () => {
  let r = await (await fetch(`${base}/api/ice`)).json(); assert.equal(r.turn, false); assert.equal(r.iceServers.length, 1);
  process.env.TURN_HOST = 'turn.example.test'; process.env.TURN_SECRET = 'topsecret';
  r = await (await fetch(`${base}/api/ice`)).json(); assert.equal(r.turn, true);
  const t = r.iceServers[1]; assert.ok(t.urls[0].startsWith('turn:turn.example.test:3478')); assert.ok(Number(t.username.split(':')[0]) > Date.now() / 1000);
  const { createHmac } = await import('node:crypto'); assert.equal(t.credential, createHmac('sha1', 'topsecret').update(t.username).digest('base64'));
  delete process.env.TURN_HOST; delete process.env.TURN_SECRET;
});
test('surgeons made by ADMIN_EMAILS also receive emergency alerts', async () => {
  process.env.ADMIN_EMAILS = 'zed@t.test'; // Zed is a plain astronaut account who is now an admin by email
  const ws = await sock('role=inbox', stranger.cookie());
  await fetch(`${base}/api/station/${cyId}/incident`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'distress', evidence: 'test' }) });
  assert.ok(await wait(ws, m => m.type === 'incident')); ws.close(); delete process.env.ADMIN_EMAILS;
});
test.after(() => { srv.close(); setTimeout(() => process.exit(0), 50); });
