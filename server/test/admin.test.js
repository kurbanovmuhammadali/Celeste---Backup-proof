process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
process.env.EMAIL_VERIFICATION = 'auto';
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
const crew = jar(), admin = jar();

test('demo sign-in works for crew and for the flight surgeon', async () => {
  assert.equal((await loginAs(crew, 'crew')).status, 200);
  const a = await loginAs(admin, 'admin');
  assert.equal(a.status, 200); assert.equal(a.body.user.role, 'surgeon');
});
test('crew cannot open the admin console', async () => {
  assert.equal((await crew('GET', '/api/admin/crew')).status, 403);
});
test('admin lists every astronaut with progress', async () => {
  const r = await admin('GET', '/api/admin/crew');
  assert.equal(r.status, 200); assert.ok(r.body.crew.length >= 4);
  assert.ok(r.body.crew.every(c => c.readiness > 0 && c.role !== 'surgeon'));
});
test('admin sends a plan; invalid plans are rejected; the astronaut receives it', async () => {
  const me = (await crew('GET', '/api/auth/me')).body.user;
  const ok = await admin('PUT', `/api/admin/crew/${me.id}/override`, { message: 'Ease off this week', resistancePerWeek: 3, zone2Minutes: 150, intensity: 'light', week: { mon: ['lower-strength'], tue: ['station-cycle'] }, tasks: [{ title: 'Extra sleep', detail: 'Lights out at 22:00' }] });
  assert.equal(ok.status, 200);
  assert.equal((await admin('PUT', `/api/admin/crew/${me.id}/override`, { resistancePerWeek: 20 })).status, 400);
  assert.equal((await admin('PUT', `/api/admin/crew/${me.id}/override`, { week: { mon: ['../etc'] } })).status, 400);
  const got = await crew('GET', '/api/me/override');
  assert.equal(got.body.override.message, 'Ease off this week'); assert.deepEqual(got.body.override.week.mon, ['lower-strength']);
  assert.equal((await crew('PUT', `/api/admin/crew/${me.id}/override`, { message: 'hack' })).status, 403);
});
test('background: astronaut writes it, surgeon reads it plus private notes; astronaut never sees the notes', async () => {
  const me = (await crew('GET', '/api/auth/me')).body.user;
  const bg = { cvText: 'Test pilot, 2 EVAs.', characteristics: 'Calm, dry humour', conditions: [{ name: 'Mild asthma', notes: 'inhaler' }], allergies: 'Penicillin', medications: '', sharedConsent: true };
  assert.equal((await crew('PUT', '/api/me/background', bg)).status, 200);
  assert.equal((await admin('PUT', `/api/admin/crew/${me.id}/notes`, { notes: 'Review lung function at day 90' })).status, 200);
  const d = await admin('GET', `/api/admin/crew/${me.id}`);
  assert.equal(d.body.background.conditions[0].name, 'Mild asthma'); assert.match(d.body.adminNotes, /lung function/);
  const mine = await crew('GET', '/api/me/background');
  assert.equal(JSON.stringify(mine.body).includes('lung function'), false);
  assert.equal((await crew('PUT', `/api/admin/crew/${me.id}/notes`, { notes: 'x' })).status, 403);
});
test('file upload: validated, listed, downloadable by the surgeon only', async () => {
  const me = (await crew('GET', '/api/auth/me')).body.user;
  const data = Buffer.from('CV: Alex Morgan, test pilot').toString('base64');
  assert.equal((await crew('POST', '/api/me/files', { name: 'cv.exe', mime: 'application/x-msdownload', data })).status, 400);
  const up = await crew('POST', '/api/me/files', { name: 'cv.txt', mime: 'text/plain', data });
  assert.equal(up.status, 200); const fid = up.body.files[0].id;
  assert.equal((await crew('POST', '/api/me/files', { name: 'big.txt', mime: 'text/plain', data: Buffer.alloc(800 * 1024, 65).toString('base64') })).status, 413);
  const dl = await admin('GET', `/api/admin/crew/${me.id}/files/${fid}`, null, true);
  assert.equal(dl.status, 200); assert.match(await dl.text(), /test pilot/);
  assert.equal((await crew('GET', `/api/admin/crew/${me.id}/files/${fid}`, null, true)).status, 403);
});
test.after(() => srv.close());

test('doctor sign-in: only allow-listed emails; first time creates the surgeon account', async () => {
  process.env.ADMIN_EMAILS = 'doc@t.test';
  const doc = jar();
  assert.equal((await doc('POST', '/api/auth/code', { email: 'rando@t.test', purpose: 'doctor' })).status, 403);
  let r = await doc('POST', '/api/auth/code', { email: 'doc@t.test', purpose: 'doctor' });
  assert.equal(r.status, 200);
  const bad = await doc('POST', '/api/auth/code/verify', { email: 'doc@t.test', purpose: 'doctor', code: r.body.devCode, profile: { acceptTerms: true } });
  assert.equal(bad.status, 400); // new doctor must give a name
  r = await doc('POST', '/api/auth/code/verify', { email: 'doc@t.test', purpose: 'doctor', code: r.body.devCode, profile: { name: 'Dr. Test', acceptTerms: true } });
  assert.equal(r.status, 200); assert.equal(r.body.user.role, 'surgeon'); assert.equal(r.body.user.admin, true);
  assert.equal((await doc('GET', '/api/admin/crew')).status, 200);
  delete process.env.ADMIN_EMAILS;
});
