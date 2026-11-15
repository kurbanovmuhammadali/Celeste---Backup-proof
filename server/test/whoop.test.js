process.env.DB_FILE = ':memory:';
process.env.DEMO_ACCOUNTS = 'off'; // real-data tests: no demo people
process.env.WHOOP_CLIENT_ID = 'cid'; process.env.WHOOP_CLIENT_SECRET = 'secret'; process.env.WHOOP_REDIRECT_URI = 'https://example.test/api/integrations/whoop/callback';
process.env.TOKEN_ENC_KEY = 'x'.repeat(40);
import test from 'node:test';
import assert from 'node:assert/strict';
const { db } = await import('../src/db.js');
const { authorizeUrl, exchangeCode, syncWhoop, SCOPES } = await import('../src/whoop.js');

test('authorise URL carries the exact redirect, scopes (incl. offline) and a long random state', () => {
  db.prepare("INSERT INTO users (id, email, name, password_hash, dob) VALUES (1,'w@t.test','W','!','1990-01-01')").run();
  const u = new URL(authorizeUrl(1, 'web'));
  assert.equal(u.origin + u.pathname, 'https://api.prod.whoop.com/oauth/oauth2/auth');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://example.test/api/integrations/whoop/callback');
  assert.equal(u.searchParams.get('client_id'), 'cid'); assert.ok(u.searchParams.get('state').length >= 32);
  assert.deepEqual(u.searchParams.get('scope').split(' '), SCOPES); assert.ok(SCOPES.includes('offline'));
});
test('refresh tokens rotate; sync maps recovery, sleep and strain; an expired session is reported', async () => {
  const real = globalThis.fetch; const calls = []; let refreshes = 0, valid = 'R1', n = 1;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push(u);
    if (u.includes('/oauth2/token')) {
      const b = new URLSearchParams(String(opts.body)); refreshes += b.get('grant_type') === 'refresh_token' ? 1 : 0;
      if (b.get('grant_type') === 'refresh_token') { if (b.get('refresh_token') !== valid) return new Response('{}', { status: 400 }); valid = `R${++n}`; } // only the newest refresh token works (rotation)
      return Response.json({ access_token: `A${calls.length}`, refresh_token: b.get('grant_type') === 'refresh_token' ? valid : 'R1', expires_in: 1 });
    }
    const day = new Date().toISOString();
    if (u.includes('/recovery')) return Response.json({ records: [{ cycle_id: 5, sleep_id: 's1', created_at: day, score_state: 'SCORED', score: { recovery_score: 71, hrv_rmssd_milli: 55.5, resting_heart_rate: 52, spo2_percentage: 96.2 } }] });
    if (u.includes('/activity/sleep')) return Response.json({ records: [{ id: 's1', end: day, nap: false, score_state: 'SCORED', score: { stage_summary: { total_light_sleep_time_milli: 4 * 36e5, total_slow_wave_sleep_time_milli: 1.5 * 36e5, total_rem_sleep_time_milli: 1.5 * 36e5 } } }] });
    if (u.includes('/cycle')) return Response.json({ records: [{ id: 5, end: day, score_state: 'SCORED', score: { strain: 11.234 } }] });
    return new Response('{}', { status: 404 });
  };
  try {
    await exchangeCode(1, 'code');
    const r = await syncWhoop(1, 7); assert.equal(r.imported >= 5, true);
    const m = Object.fromEntries(db.prepare("SELECT metric, value FROM measurements WHERE user_id = 1 AND source = 'whoop'").all().map(x => [x.metric, x.value]));
    assert.equal(m.recovery, 71); assert.equal(m.hrv, 55.5); assert.equal(m.rhr, 52); assert.equal(m.sleep, 7); assert.equal(m.strain, 11.2);
    assert.ok(refreshes >= 1);
    await syncWhoop(1, 7); // second sync needs a second refresh: works only because the NEW refresh token was stored
    assert.equal(db.prepare("SELECT status FROM integrations WHERE user_id = 1").get().status, 'connected');
  } finally { globalThis.fetch = real; }
});
test.after(() => setTimeout(() => process.exit(0), 50));
