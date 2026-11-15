process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
import test from 'node:test';
import assert from 'node:assert/strict';
const { app } = await import('../src/index.js');

const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}`;
let cookie = '';
const call = async (method, path, body, headers = {}) => {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json() };
};
const reg = { name: 'Ada Orbit', email: 'ada@crew.test', password: 'orbit2026', dob: '1990-04-12', acceptTerms: true, acceptPrivacy: true, consentHealth: true };

test('age gate blocks minors', async () => {
  const r = await call('POST', '/api/auth/register', { ...reg, email: 'kid@crew.test', dob: '2012-01-01' });
  assert.equal(r.status, 403);
});
test('consent required', async () => {
  const r = await call('POST', '/api/auth/register', { ...reg, consentHealth: false });
  assert.equal(r.status, 400);
});
test('register → dashboard → plan → checkin → logout/login → delete', async () => {
  let r = await call('POST', '/api/auth/register', reg);
  assert.equal(r.status, 200, JSON.stringify(r.body)); assert.ok(cookie.startsWith('pg_session='));
  const { seedDemo } = await import('./support/seedData.js'); seedDemo(r.body.user.id); // new accounts start empty; this test needs synthetic readings
  r = await call('GET', '/api/dashboard'); assert.equal(r.status, 200);
  assert.ok(r.body.readiness > 0 && r.body.readiness <= 100);
  console.log('readiness', r.body.readiness, r.body.systems.map(s => `${s.key}:${s.status}`).join(' '));
  r = await call('GET', '/api/plan'); assert.equal(r.status, 200);
  console.log('adaptations', r.body.adaptations.map(a => a.title));
  assert.ok(r.body.adaptations.some(a => a.key === 'adapt-bone-run'));
  r = await call('POST', '/api/plan/tasks/treadmill/toggle'); assert.ok(r.body.items.find(i => i.key === 'treadmill').done);
  r = await call('POST', '/api/checkins', { mood: 80, symptoms: ['vision'] }); assert.equal(r.body.escalate, true);
  r = await call('POST', '/api/measurements', { metric: 'bp', value: 150, value2: 95 }); assert.equal(r.body.status, 'red');
  r = await call('POST', '/api/measurements', { metric: 'bp', value: 150 }); assert.equal(r.status, 400);
  r = await call('POST', '/api/ingest', { source: 'nasa-lab', records: [{ metric: 'vitd', value: 18 }, { metric: 'nope', value: 1 }] });
  assert.equal(r.body.imported, 1); assert.equal(r.body.errors.length, 1);
  r = await call('GET', '/api/metrics/hrv?days=7'); assert.ok(r.body.series.length >= 6);
  r = await call('GET', '/api/report'); assert.match(r.body.text, /Readiness/);
  r = await call('POST', '/api/auth/logout'); cookie = '';
  r = await call('GET', '/api/dashboard'); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { email: reg.email, password: 'wrong123' }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { email: reg.email, password: reg.password }); assert.equal(r.status, 200);
  r = await call('POST', '/api/plan/tasks/ared/toggle', null, { 'X-Requested-With': '' }); assert.equal(r.status, 403, 'csrf header required');
  r = await call('POST', '/api/auth/login', { email: reg.email, password: reg.password }, { 'X-Client': 'native' }); assert.ok(r.body.token);
  r = await call('DELETE', '/api/account', { password: reg.password }); assert.equal(r.status, 200);
  r = await call('POST', '/api/auth/login', { email: reg.email, password: reg.password }); assert.equal(r.status, 401);
});
test.after(() => srv.close());

test('email code: signup → login', async () => {
  cookie = '';
  const email = 'joseph@crew.test';
  const profile = { firstName: 'Joseph', lastName: 'Brown', age: 38, missionYears: 2.5, acceptTerms: true };
  let r = await call('POST', '/api/auth/code', { email, purpose: 'login' });
  assert.equal(r.status, 404);
  r = await call('POST', '/api/auth/code', { email, purpose: 'signup' });
  assert.equal(r.status, 200); assert.match(r.body.devCode, /^\d{4}$/);
  const code = r.body.devCode;
  r = await call('POST', '/api/auth/code/verify', { email, purpose: 'signup', code: code === '9999' ? '1000' : '9999', profile });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/code/verify', { email, purpose: 'signup', code, profile: { ...profile, missionYears: 2.3 } });
  assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/code/verify', { email, purpose: 'signup', code, profile });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.name, 'Joseph Brown'); assert.equal(r.body.user.missionYears, 2.5); assert.equal(r.body.user.environment, 'mars');
  r = await call('POST', '/api/auth/code/verify', { email, purpose: 'signup', code, profile });
  assert.equal(r.status, 400); // code is single-use
  r = await call('POST', '/api/auth/code', { email, purpose: 'signup' });
  assert.equal(r.status, 409);
  cookie = '';
  r = await call('POST', '/api/auth/code', { email, purpose: 'login' });
  r = await call('POST', '/api/auth/code/verify', { email, purpose: 'login', code: r.body.devCode });
  assert.equal(r.status, 200); assert.equal(r.body.user.email, email);
  r = await call('GET', '/api/auth/me'); assert.equal(r.status, 200);
});

