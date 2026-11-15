/**
 * Email sending for the 4-digit verification code.
 *
 * Pick ONE provider with environment variables (read at call time, see .env.example):
 *   - Resend API  : RESEND_API_KEY (+ MAIL_FROM)
 *   - SMTP        : SMTP_HOST, SMTP_USER, SMTP_PASS (+ SMTP_PORT, MAIL_FROM), e.g. Gmail with an App Password
 *   - MAIL_TRANSPORT=json : prints the message to the server console instead of sending (tests, offline demos)
 * Nothing is sent anywhere unless one of these is configured.
 */
import nodemailer from 'nodemailer';

const env = k => process.env[k]?.trim();

export const mailMode = () =>
  env('RESEND_API_KEY') ? 'resend'
  : env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') ? 'smtp'
  : env('MAIL_TRANSPORT') === 'json' ? 'json'
  : null;
export const mailConfigured = () => mailMode() !== null;

const from = () => env('MAIL_FROM') || env('SMTP_USER') || 'Celeste <onboarding@resend.dev>';

export function codeEmail(code, purpose) {
  const what = purpose === 'login' ? 'log in to' : 'finish creating your account in';
  const subject = `${code} is your Celeste code`;
  const text = `Your Celeste verification code is ${code}.\n\nEnter it in the app to ${what} Celeste. It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email.`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#2B1E18">
<div style="font-weight:700;letter-spacing:2px;color:#B8693F">&#10022; Celeste</div>
<p style="margin:18px 0 6px">Your verification code</p>
<div style="font-size:38px;font-weight:700;letter-spacing:10px;background:#F6E4D9;border-radius:14px;padding:14px 18px;text-align:center">${code}</div>
<p style="color:#6E5A50;font-size:14px;margin-top:16px">Enter it in the app to ${what} Celeste. It expires in 10 minutes. If you did not ask for this, ignore this email.</p>
<p style="color:#A8958B;font-size:12px">Celeste crew health · not a medical device</p></div>`;
  return { subject, text, html };
}

export async function sendMail({ to, subject, text, html }) {
  const mode = mailMode();
  if (!mode) throw Object.assign(new Error('Email is not configured'), { code: 'MAIL_NOT_CONFIGURED' });
  if (mode === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: from(), to: [to], subject, text, html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return;
  }
  if (mode === 'json') { console.log(`[mail:json] to=${to} subject="${subject}"\n${text}`); return; }
  const port = Number(env('SMTP_PORT') || 465);
  const transport = nodemailer.createTransport({ host: env('SMTP_HOST'), port, secure: port === 465, auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') } });
  await transport.sendMail({ from: from(), to, subject, text, html });
}
