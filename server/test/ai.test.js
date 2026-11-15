process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
delete process.env.GEMINI_API_KEY; delete process.env.ANTHROPIC_API_KEY;
import test from 'node:test';
import assert from 'node:assert/strict';
const { app } = await import('../src/index.js');
const { geminiBody } = await import('../src/llm.js');
const { loginAs } = await import('./support/people.js');

const srv = app.listen(0);
const base = `http://localhost:${srv.address().port}`;
let cookie = '';
const call = async (path, body) => { const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee', cookie }, body: JSON.stringify(body) }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, body: await r.json() }; };

test('Gemini request body: roles, system prompt, image on the last user turn, JSON mode', () => {
  const b = geminiBody({ system: 'SYS', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }, { role: 'user', content: 'eat' }], json: true, images: [{ mime: 'image/png', data: 'AAA' }] });
  assert.equal(b.systemInstruction.parts[0].text, 'SYS');
  assert.deepEqual(b.contents.map(c => c.role), ['user', 'model', 'user']);
  assert.equal(b.contents[2].parts[1].inlineData.mimeType, 'image/png');
  assert.equal(b.generationConfig.responseMimeType, 'application/json');
  assert.ok(b.generationConfig.maxOutputTokens >= 1500);
});
test('assistant says "not configured" instead of failing when no key is set', async () => {
  await loginAs((m, p, b) => call(p, b), 'crew');
  assert.equal((await call('/api/assistant', { messages: [{ role: 'user', text: 'hi' }] })).status, 503);
});
test.after(() => srv.close());

test('SI snapshot: live WHOOP + hand-entered values with source and age; blood pressure only when typed in', async () => {
  const { aiSnapshot } = await import('../src/aidata.js');
  const { db } = await import('../src/db.js');
  const { seedDemo } = await import('./support/seedData.js');
  const id = db.prepare("SELECT id FROM users WHERE email = 'crew@test.local'").get()?.id ?? (await (async () => { const { seedPeople } = await import('./support/people.js'); seedPeople(); return db.prepare("SELECT id FROM users WHERE email = 'crew@test.local'").get().id; })());
  db.prepare("DELETE FROM measurements WHERE user_id = ?").run(id);
  let s = aiSnapshot(id);
  assert.equal(s.vitals.bp, undefined); assert.deepEqual(s.vitals, {});
  db.prepare("INSERT INTO measurements (user_id, metric, value, value2, unit, source, recorded_at) VALUES (?, 'hrv', 61, NULL, 'ms', 'whoop', datetime('now','-2 hours'))").run(id);
  db.prepare("INSERT INTO measurements (user_id, metric, value, value2, unit, source, recorded_at) VALUES (?, 'bp', 126, 82, 'mmHg', 'manual', datetime('now','-1 day'))").run(id);
  s = aiSnapshot(id);
  assert.equal(s.vitals.hrv.source, 'WHOOP'); assert.equal(s.vitals.hrv.latest, 61); assert.ok(s.vitals.hrv.hoursAgo <= 3);
  assert.equal(s.vitals.bp.latest, '126/82'); assert.equal(s.vitals.bp.source, 'entered by hand');
  assert.match(s.note, /does NOT measure blood pressure/);
});
test('assistant prompt carries the measured block and attachments are validated', async () => {
  const { assistantPrompt, cleanAttachments } = await import('../src/companion.js');
  assert.match(assistantPrompt({}, '', { vitals: { hrv: { latest: 61 } } }), /<measured>.*61/);
  assert.equal(cleanAttachments([{ name: 'a.csv', mime: 'text/csv', text: 'x,y' }, { name: 'p.png', mime: 'image/png', data: 'QUJD' }]).files.length, 1);
  assert.throws(() => cleanAttachments([{ name: 'a.exe', mime: 'application/x-msdownload', data: 'QUJD' }]), /Attach a PDF/);
  assert.throws(() => cleanAttachments([{ name: 'big.pdf', mime: 'application/pdf', data: 'A'.repeat(6e6) }]), /too large/);
  const { speakable } = await import('../src/tts.js');
  assert.equal(speakable('**HRV** is 61.\n- rest\n- hydrate'), 'HRV is 61. rest. hydrate');
});
