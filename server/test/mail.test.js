process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
import test from 'node:test';
import assert from 'node:assert/strict';
const { app } = await import('../src/index.js');

const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}`;
const post = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
const reset = () => { for (const k of ['EMAIL_VERIFICATION', 'MAIL_TRANSPORT', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k]; };

test('no mail provider, verification auto → dev fallback shows the code (demo only)', async () => {
  reset();
  const r = await post('/api/auth/code', { email: 'a@crew.test', purpose: 'signup' });
  assert.equal(r.status, 200); assert.match(r.body.devCode, /^\d{4}$/);
});
test('verification ON without a mail provider → 503 and no code leaked', async () => {
  reset(); process.env.EMAIL_VERIFICATION = 'on';
  const r = await post('/api/auth/code', { email: 'b@crew.test', purpose: 'signup' });
  assert.equal(r.status, 503); assert.equal(r.body.devCode, undefined);
  const v = await post('/api/auth/code/verify', { email: 'b@crew.test', purpose: 'signup', code: '1234', profile: {} });
  assert.notEqual(v.status, 200); // no stored code to guess
});
test('mail provider configured → "sent", the code is never returned', async () => {
  reset(); process.env.EMAIL_VERIFICATION = 'on'; process.env.MAIL_TRANSPORT = 'json';
  const r = await post('/api/auth/code', { email: 'c@crew.test', purpose: 'signup' });
  assert.equal(r.status, 200); assert.equal(r.body.sent, true); assert.equal(r.body.devCode, undefined);
});
test('email template carries the code and a branded subject', async () => {
  const { codeEmail } = await import('../src/mail.js');
  const m = codeEmail('4821', 'signup');
  assert.match(m.subject, /4821/); assert.match(m.text, /4821/); assert.match(m.html, /Celeste/);
});
test.after(() => srv.close());
