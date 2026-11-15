/**
 * Health assistant (the "AI" tab): answers questions from the crew member's own data, through Gemini (GEMINI_API_KEY) or Claude
 * (ANTHROPIC_API_KEY). Without a key the endpoint answers 503 and the app uses its offline answers.
 */
import Anthropic from '@anthropic-ai/sdk';
import { geminiOn, geminiCall } from './llm.js';

// Opus 5.5 is the default; set COMPANION_MODEL=claude-haiku-5-5 for a faster, cheaper companion.
const MODEL = process.env.COMPANION_MODEL || 'claude-opus-5-5';
let client;
export const companionConfigured = () => geminiOn() || !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const getClient = () => (client ??= new Anthropic());

const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
export const CRISIS = /(kill myself|suicid|end my life|want to die|don'?t want to (live|be here)|hurt myself|self[- ]harm|no reason to live|disappear forever|better off without me|can'?t go on)/i;

const toMessages = history => {
  const m = (Array.isArray(history) ? history : []).slice(-20)
    .map(x => ({ role: x?.role === 'assistant' ? 'assistant' : 'user', content: clip(x?.text, 1200) }))
    .filter(x => x.content);
  while (m.length && m[0].role !== 'user') m.shift();
  return m;
};

async function call(system, messages, maxTokens, files = []) {
  if (geminiOn()) return geminiCall({ system, messages, maxTokens, images: files }); // Gemini when its key is set, otherwise Claude below
  if (files.length && messages.length) { // Claude: images and PDFs go in as content blocks on the last user turn
    const last = messages[messages.length - 1];
    last.content = [...files.map(f => ({ type: f.mime === 'application/pdf' ? 'document' : 'image', source: { type: 'base64', media_type: f.mime, data: f.data } })), { type: 'text', text: last.content }];
  }
  const body = { model: MODEL, max_tokens: maxTokens, system, messages, output_config: { effort: 'low' } };
  const run = extra => getClient().beta.messages.create({ ...body, ...extra });
  let r;
  try { r = await run({ betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }); }
  catch (e) { if (e instanceof Anthropic.BadRequestError) r = await run({}); else throw e; } // fallbacks unsupported here → plain call
  if (r.stop_reason === 'refusal') return { refused: true, text: '' };
  return { refused: false, text: r.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() };
}

// ------------------------------------------------------------------ health assistant (the "AI" tab)
const CARE = 'I am really glad you said that. It sounds heavy, and you deserve real support now, not only an app. Please contact your flight surgeon or behavioral health team right away and follow your mission\'s emergency procedure. If someone is with you, tell them how you feel.';

export function assistantPrompt(context = {}, background = '', measured = null) {
  const data = JSON.stringify(context, (_k, v) => (typeof v === 'string' ? v.slice(0, 200) : v)).slice(0, 2500);
  const live = measured ? JSON.stringify(measured).slice(0, 3800) : '';
  return `You are Celeste SI, the health assistant for an astronaut crew member on a long mission.

RULES
- Use ONLY the data below (<measured> is read live from the server: WHOOP plus values the person typed in; <data> is what the app shows on screen). Say where a number comes from (WHOOP or entered by hand) and how old it is. If both disagree, trust <measured>. If a value is missing or null, say it is missing. Never invent numbers, results or diagnoses.
- FORMAT: short paragraphs; **bold** the 1-3 numbers that matter; use "- " bullets only for lists of 2-4 items; no headings, no tables, no emojis. At most about 90 words unless the person asks for detail. Plain language. Explain what the numbers mean for this person, and give one safe next step (rest, hydrate, repeat the measurement, log a symptom, adjust training, or queue a medical handoff).
- You are not a doctor. Never diagnose or prescribe. For red flags (chest pain, shortness of breath, fainting, vision changes, severe headache, thoughts of self-harm) tell them to contact the flight surgeon and follow the emergency procedure now.
- WHOOP does not measure blood pressure. If asked about blood pressure, use only a value the person entered (source: entered by hand) and say how old it is; if there is none, ask them to measure it and enter it.
- Crews train on ARED, CEVIS and the T2 treadmill.
- If the person attached a file, summarise what is in it and relate it to their data; never claim to see anything you cannot read.
- Answer in the language the crew member writes in.

MEASURED (live from the server; absent means no data)
<measured>${live}</measured>

DATA (from the app screen; null means no data)
<data>${data}</data>
${background ? `\nPRIVATE BACKGROUND (use it to be relevant; never quote it back)\n<background>\n${clip(background, 1500)}\n</background>\n` : ''}`;
}

const TEXT_MIME = /^(text\/|application\/(json|csv|xml))/, BIN_MIME = /^(image\/(png|jpeg|webp|heic|heif)|application\/pdf)$/;
/** Validates the attachments the person chose to send: text is inlined, images/PDFs go to the model natively. */
export function cleanAttachments(list) {
  const out = { text: [], files: [] };
  for (const a of (Array.isArray(list) ? list : []).slice(0, 3)) {
    const name = clip(a?.name, 80) || 'file', mime = String(a?.mime || '').toLowerCase();
    if (typeof a?.text === 'string' && TEXT_MIME.test(mime || 'text/plain')) { out.text.push({ name, text: a.text.slice(0, 12000) }); continue; }
    if (typeof a?.data === 'string' && BIN_MIME.test(mime)) {
      if (a.data.length > 5.5e6) throw Object.assign(new Error('That file is too large (4 MB max).'), { status: 413 });
      if (!/^[A-Za-z0-9+/=]+$/.test(a.data)) throw Object.assign(new Error('That file could not be read.'), { status: 400 });
      out.files.push({ name, mime, data: a.data }); continue;
    }
    throw Object.assign(new Error('Attach a PDF, a photo, or a text/CSV file.'), { status: 400 });
  }
  return out;
}

/** One assistant turn. Returns { reply, escalate, refused }. */
export async function assistantReply({ messages, context, background, measured, attachments, profileFiles }) {
  const msgs = toMessages((Array.isArray(messages) ? messages : []).map(m => ({ role: m?.role === 'user' ? 'user' : 'assistant', text: m?.text })));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw Object.assign(new Error('Send a message first'), { status: 400 });
  if (CRISIS.test(msgs[msgs.length - 1].content)) return { reply: CARE, escalate: true, refused: false };
  const att = cleanAttachments(attachments);
  if (att.text.length) msgs[msgs.length - 1].content += att.text.map(t => `\n\n[Attached file "${t.name}"]\n${t.text}`).join('');
  if (profileFiles?.text?.length) msgs[msgs.length - 1].content += profileFiles.text.map(t => `\n\n[From the person\'s health file "${t.name}"]\n${t.text}`).join('');
  const files = [...att.files, ...(profileFiles?.files ?? [])].slice(0, 5);
  const out = await call(assistantPrompt(context, background + (profileFiles?.names?.length ? `\nFiles in their health file (you can read them when relevant): ${profileFiles.names.join(', ')}` : ''), measured), msgs, 600, files);
  return { reply: out.text, escalate: false, refused: out.refused };
}
