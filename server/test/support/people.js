// TEST-ONLY fixtures. The product has no demo sign-in and no sample data: these helpers create ordinary accounts
// (real password hash) plus synthetic measurements directly in the in-memory test database, then log in the normal way.
import { db } from '../../src/db.js';
import { hashPassword, LEGAL_VERSION } from '../../src/auth.js';
import { seedDemo } from './seedData.js';

const PW = 'Test-pass-2026!';
const CREW = [
  { email: 'crew@test.local', name: 'Alex Morgan', dob: '1988-01-01', years: 2.5, env: 'mars', mission: '2.5-year Mars mission', seed: 7 },
  { email: 'mira@test.local', name: 'Mira Okafor', dob: '1991-06-14', years: 1, env: 'station', mission: 'ISS Expedition 74', seed: 11 },
  { email: 'daniel@test.local', name: 'Daniel Reyes', dob: '1985-11-02', years: 2, env: 'lunar', mission: 'Lunar gateway rotation', seed: 23 },
  { email: 'yuki@test.local', name: 'Yuki Tanaka', dob: '1993-03-27', years: 1, env: 'station', mission: 'ISS Expedition 74', seed: 31 },
];
const SURGEON = { email: 'surgeon@test.local', name: 'Dr. Elena Voss', dob: '1979-09-09' };

function ensure(u, role, extra = {}) {
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(u.email)) return;
  const { lastInsertRowid: id } = db.prepare('INSERT INTO users (email, name, password_hash, dob, role, mission, environment, mission_years) VALUES (?,?,?,?,?,?,?,?)')
    .run(u.email, u.name, hashPassword(PW), u.dob, role, extra.mission ?? 'Flight surgeon', extra.env ?? 'station', extra.years ?? null);
  ['terms', 'privacy', 'health_data'].forEach(k => db.prepare('INSERT INTO consents (user_id, kind, version) VALUES (?,?,?)').run(id, k, LEGAL_VERSION));
  if (role === 'astronaut') seedDemo(Number(id), extra.seed);
}
export function seedPeople() {
  CREW.forEach(c => ensure(c, 'astronaut', c));
  ensure(SURGEON, 'surgeon');
}
/** Logs `call` (a cookie-jar helper: call(method, path, body)) in as the test crew member or surgeon. */
export function loginAs(call, as) {
  seedPeople();
  return call('POST', '/api/auth/login', { email: (as === 'admin' ? SURGEON : CREW[0]).email, password: PW });
}
export const TEST_EMAILS = { crew: CREW[0].email };
