// Makes an existing account a flight surgeon (admin):  node scripts/make-surgeon.js someone@example.com
// Run it on the server inside /opt/hmsc/server (use the same .env):  sudo -u hmsc node --env-file=.env scripts/make-surgeon.js someone@example.com
import { db } from '../src/db.js';
const email = String(process.argv[2] ?? '').trim().toLowerCase();
if (!email) { console.error('Usage: node scripts/make-surgeon.js email@example.com'); process.exit(1); }
const u = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email);
if (!u) { console.error('No account with that email. Sign up in the app first.'); process.exit(1); }
db.prepare("UPDATE users SET role = 'surgeon' WHERE id = ?").run(u.id);
console.log(`${u.name} (${email}) is now a flight surgeon.`);
