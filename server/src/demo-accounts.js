/**
 * Demo accounts for judges: an astronaut with a full story (data, health file, lab report, crew, reports), two flight
 * surgeons who answer reports, and a team leader who oversees everything. They are ordinary accounts marked by the
 * @demo.celeste address and are created at start-up unless DEMO_ACCOUNTS=off. One click signs in (no password).
 *
 *  POST /api/demo/login            { as: 'astronaut' | 'doctor' | 'leader' }
 *  GET  /api/leader/overview       team-leader view: every doctor's activity, every astronaut, every report and reply
 */
import { db } from './db.js';
import { LEGAL_VERSION, requireAuth } from './auth.js';
import { seedDemo } from './demo-data.js';

export const demoOn = () => process.env.DEMO_ACCOUNTS !== 'off';
export const isDemoEmail = e => /@demo\.celeste$/i.test(String(e));
const bad = (res, m, c = 400) => res.status(c).json({ error: m });

const ASTRONAUTS = [
  { email: 'astronaut@demo.celeste', name: 'Alex Morgan', dob: '1988-01-01', years: 2.5, env: 'mars', mission: '2.5-year Mars mission', seed: 7 },
  { email: 'mira@demo.celeste', name: 'Mira Okafor', dob: '1991-06-14', years: 1, env: 'station', mission: 'ISS Expedition 74', seed: 11 },
  { email: 'daniel@demo.celeste', name: 'Daniel Reyes', dob: '1985-11-02', years: 2, env: 'lunar', mission: 'Lunar gateway rotation', seed: 23 },
  { email: 'yuki@demo.celeste', name: 'Yuki Tanaka', dob: '1993-03-27', years: 1, env: 'station', mission: 'ISS Expedition 74', seed: 31 },
];
const DOCTORS = [
  { email: 'doctor@demo.celeste', name: 'Dr. Elena Voss', dob: '1979-09-09' },
  { email: 'doctor2@demo.celeste', name: 'Dr. Marcus Hale', dob: '1982-02-18' },
];
const LEADER = { email: 'leader@demo.celeste', name: 'Cmdr. Irina Volkova', dob: '1976-04-04' };

const LAB = `Laboratory report · 2026-10-28 · Alex Morgan (demo data)
Vitamin D (25-OH): 28 ng/mL (reference 30-100) - slightly low
Ferritin: 41 ng/mL (reference 30-300)
Hemoglobin: 14.6 g/dL (13.5-17.5)
Total cholesterol: 182 mg/dL
LDL: 104 mg/dL
HbA1c: 5.2 %
CRP: 0.8 mg/L
Note: allergic to penicillin (rash 2012). Occasional tension headaches, worse after short sleep. Mild exercise-induced asthma.`;

const ago = ms => new Date(Date.now() - ms).toISOString().slice(0, 19).replace('T', ' ');
const MIN = 60e3, H = 3600e3;

function person(u, role, extra = {}) {
  let row = db.prepare('SELECT * FROM users WHERE email = ?').get(u.email);
  if (row) return row;
  const { lastInsertRowid: id } = db.prepare('INSERT INTO users (email, name, password_hash, dob, role, mission, environment, mission_years) VALUES (?,?,?,?,?,?,?,?)')
    .run(u.email, u.name, '!', u.dob, role, extra.mission ?? (role === 'astronaut' ? 'Mission' : role === 'leader' ? 'Mission leader' : 'Flight surgeon'), extra.env ?? 'station', extra.years ?? null);
  ['terms', 'privacy', 'health_data'].forEach(k => db.prepare('INSERT INTO consents (user_id, kind, version) VALUES (?,?,?)').run(id, k, LEGAL_VERSION));
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function seedDemoAccounts() {
  if (!demoOn() || db.prepare('SELECT 1 FROM users WHERE email = ?').get(ASTRONAUTS[0].email)) return;
  (() => { // (seedDemo opens its own transaction per account)
    const crewRows = ASTRONAUTS.map(a => { const r = person(a, 'astronaut', { mission: a.mission, env: a.env, years: a.years }); seedDemo(Number(r.id), a.seed); return r; });
    const docs = DOCTORS.map(d => person(d, 'surgeon'));
    person(LEADER, 'leader');
    const alex = crewRows[0];

    // crew "Odyssey" with a fixed join code, so anyone can try joining it
    if (!db.prepare('SELECT 1 FROM crews WHERE code = ?').get('DEM-001')) {
      const { lastInsertRowid: cid } = db.prepare('INSERT INTO crews (name, code, created_by) VALUES (?,?,?)').run('Odyssey', 'DEM-001', alex.id);
      crewRows.forEach((r, i) => db.prepare('INSERT INTO crew_members (user_id, crew_id, role) VALUES (?,?,?)').run(r.id, cid, i === 0 ? 'commander' : 'member'));
      db.prepare('INSERT INTO crew_feed (crew_id, user_id, kind, text) VALUES (?,?,?,?)').run(cid, alex.id, 'announcement', 'Welcome to Odyssey. Daily check by 09:00, EVA briefing at 14:00.');
    }

    // health file the SI can read (allergies, conditions, medications, a lab report)
    db.prepare("INSERT INTO backgrounds (user_id, data) VALUES (?, ?)").run(alex.id, JSON.stringify({
      cvText: 'Aerospace engineer, 6 years of flight-hardware testing. Completed EVA suit training and 40 hours of centrifuge runs.',
      characteristics: 'Calm under pressure, dislikes interruptions during focus work, sleeps best with a fixed routine. Vegetarian.',
      allergies: 'Penicillin (rash), shellfish', medications: 'Vitamin D 2000 IU daily, melatonin 3 mg when needed',
      conditions: [{ name: 'Mild exercise-induced asthma', notes: 'Inhaler before hard sessions' }, { name: 'Recurrent tension headaches', notes: 'Worse after nights under 6 hours' }],
      sharedConsent: true,
    }));
    db.prepare('INSERT INTO crew_files (user_id, name, mime, size, data) VALUES (?,?,?,?,?)').run(alex.id, 'lab-results-2026-10.txt', 'text/plain', LAB.length, Buffer.from(LAB));

    // symptoms: headache + short sleep stretch
    db.prepare("INSERT INTO checkins (user_id, mood, energy, symptoms, note, recorded_at) VALUES (?,?,?,?,?,?)").run(alex.id, 45, 40, JSON.stringify(['headache']), 'Headache since morning, slept 5 h', ago(2 * H));

    // reports from astronauts and what the doctors answered
    const rep = (u, id, title, reason, lines, receivedAgo, ack) => db.prepare('INSERT INTO handoffs (user_id, id, title, reason, mission_day, lines, queued_at, received_at, ack_at, ack_by, ack_note) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(u.id, id, title, reason, 118, JSON.stringify(lines), Date.now() - receivedAgo, ago(receivedAgo), ack ? ago(receivedAgo - ack.after) : null, ack ? ack.by.id : null, ack ? ack.note : null);
    rep(alex, 'demo-r1', 'Headache with blurred vision', 'Possible SANS / sleep debt', [{ h: 'Symptoms', t: 'Headache since morning, mild blurred vision when reading small text.' }, { h: 'Data', t: 'Sleep 5.1 h, HRV down 14% vs baseline, CO2 2.6 mmHg.' }, { h: 'Allergies', t: 'Penicillin, shellfish.' }], 3 * H, null);
    rep(alex, 'demo-r2', 'Short sleep this week', 'Routine report', [{ h: 'Sleep', t: 'Averaging 5.8 h over 5 days.' }, { h: 'Plan', t: 'Moving hard sessions earlier in the day.' }], 30 * H, { by: docs[0], after: 25 * MIN, note: 'Thanks Alex. Keep lights low after 21:00 and try 7 h tonight. Report again if the headache lasts more than a day.' });
    rep(crewRows[1], 'demo-r3', 'Knee pain after treadmill', 'Pain 4/10 right knee', [{ h: 'Symptom', t: 'Right knee, worse on stairs, started after T2 run.' }], 20 * H, { by: docs[1], after: 2 * H, note: 'Swap the T2 run for CEVIS for 3 days and ice the knee. Tell me if it swells.' });
    rep(crewRows[2], 'demo-r4', 'Isolation fatigue', 'Low mood, flat energy', [{ h: 'Wellbeing', t: 'Mood 40/100 for four days, sleep fine.' }], 6 * H, null);
  })();
  console.log('[demo] demo accounts ready (astronaut, 2 doctors, team leader)');
}

export function mountDemo(app, authResponse) {
  if (demoOn()) seedDemoAccounts();
  app.post('/api/demo/login', (req, res) => {
    if (!demoOn()) return bad(res, 'Demo accounts are off.', 404);
    const as = req.body?.as;
    const email = as === 'doctor' ? DOCTORS[0].email : as === 'leader' ? LEADER.email : ASTRONAUTS[0].email;
    seedDemoAccounts(); // the database may have been wiped by a restart
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!u) return bad(res, 'Demo account missing.', 500);
    authResponse(req, res, u);
  });

  // team leader: everything at a glance, including whether the doctors do their job
  app.get('/api/leader/overview', requireAuth, (req, res) => {
    if (req.user.role !== 'leader') return bad(res, 'Team leader access only.', 403);
    const mins = (a, b) => Math.max(0, Math.round((Date.parse(String(a).replace(' ', 'T') + 'Z') - Date.parse(String(b).replace(' ', 'T') + 'Z')) / 6e4));
    const rows = db.prepare('SELECT h.*, u.name AS astronaut, d.name AS doctor FROM handoffs h JOIN users u ON u.id = h.user_id LEFT JOIN users d ON d.id = h.ack_by ORDER BY h.received_at DESC LIMIT 60').all();
    const reports = rows.map(r => ({ astronaut: r.astronaut, title: r.title, reason: r.reason, receivedAt: r.received_at, answered: !!r.ack_at, doctor: r.doctor ?? null, answerNote: r.ack_note ?? null, responseMinutes: r.ack_at ? mins(r.ack_at, r.received_at) : null }));
    const doctors = db.prepare("SELECT id, name FROM users WHERE role = 'surgeon' ORDER BY name").all().map(d => {
      const mine = rows.filter(r => r.ack_by === d.id);
      const times = mine.map(r => mins(r.ack_at, r.received_at));
      return { id: d.id, name: d.name, answered: mine.length, avgResponseMinutes: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null, lastAnswerAt: mine[0]?.ack_at ?? null };
    });
    const astronauts = db.prepare("SELECT id, name, mission FROM users WHERE role IN ('astronaut','analog') ORDER BY name").all().map(a => ({
      id: a.id, name: a.name, mission: a.mission,
      openReports: db.prepare('SELECT COUNT(*) n FROM handoffs WHERE user_id = ? AND ack_at IS NULL').get(a.id).n,
      lastSymptoms: (() => { const c = db.prepare('SELECT symptoms, recorded_at FROM checkins WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1').get(a.id); try { return c ? { list: JSON.parse(c.symptoms), at: c.recorded_at } : null; } catch { return null; } })(),
    }));
    const open = reports.filter(r => !r.answered);
    res.json({ summary: { astronauts: astronauts.length, doctors: doctors.length, reports: reports.length, open: open.length, oldestOpenMinutes: open.length ? Math.max(...open.map(r => mins(new Date().toISOString().slice(0, 19).replace('T', ' '), r.receivedAt))) : null }, doctors, astronauts, reports });
  });
}
