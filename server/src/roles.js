import { requireAuth } from './auth.js';

/** Admin = flight surgeon role, or an email listed in ADMIN_EMAILS (comma separated). */
const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
export const isAdmin = u => ['surgeon', 'leader'].includes(u.role) || adminEmails().includes(String(u.email).toLowerCase());
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => (isAdmin(req.user) ? next() : res.status(403).json({ error: 'Flight surgeon access only.' })));
}

/** A doctor may sign in with an emailed code when the email is on the ADMIN_EMAILS list or the account already is a surgeon. */
export const isDoctorEmail = (email, existingRole) => existingRole === 'surgeon' || adminEmails().includes(String(email).toLowerCase());
