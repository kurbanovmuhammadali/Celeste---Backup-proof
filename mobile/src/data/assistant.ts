/**
 * Celeste assistant brain. Today: on-device demo replies grounded in the crew's own numbers.
 * Later: set ASSISTANT_PROVIDER to a server route (e.g. Gemini) — screens call `ask()` and stay unchanged.
 */
import { api } from '../api';
import { fmtSleep } from './crew';
import type { ChatMsg } from './store';
import { CARE_MESSAGE, CRISIS } from './safety';

export type AssistantContext = { name: string; recovery: number | null; sleep: number | null; hrv: number | null; rhr: number | null; dose: number | null; doseTotal: number | null; missionDay: number; duration: number };

/** 'demo' | 'server'. Switch to 'server' once POST /api/assistant exists (Gemini). */
export const ASSISTANT_PROVIDER: 'demo' | 'server' = 'server';

export const SUGGESTIONS = ['Explain my dose', 'Review my sleep', 'Am I ready to train?', 'What does HRV mean?'];

function demoReply(q: string, c: AssistantContext, files?: string[]): string {
  const s = q.toLowerCase();
  const first = c.name.split(' ')[0] || 'there';
  if (files?.length) return `I’ve attached “${files[0]}” to this conversation. In the demo I can’t read file contents yet — once the assistant is connected, I’ll summarise it and compare it with your dosimeter and lab history.`;
  if (/dose|radiat|msv|dosimet|sievert/.test(s))
    return `Your personal dosimeter logged ${c.dose?.toFixed(2) ?? 'no'} mSv for the latest day. ${c.doseTotal == null ? `Cumulative dose is unavailable because some of the ${c.missionDay} mission days have no reading.` : `Mission total is about ${c.doseTotal.toFixed(1)} mSv after ${c.missionDay} days.`} That’s a personal reading — cabin monitors are tracked separately. Your flight surgeon reviews cumulative dose against mission limits.`;
  if (/sleep|tired|rest|bed/.test(s))
    return `You slept ${fmtSleep(c.sleep)} last night${c.sleep != null && c.sleep < 6.5 ? ', below your usual range' : ''}. Recovery is ${c.recovery ?? '—'}%. An earlier lights-out and dimmer module lighting an hour before sleep usually helps within two nights.`;
  if (/train|workout|exercise|ready|cycle|ared|cevis/.test(s))
    return c.recovery != null && c.recovery < 50
      ? `Recovery is ${c.recovery}% — a little low. Today’s Station cycle is fine, but keep the steady ride in zone 2 and skip extra intervals. I’ll remind you to log how it felt.`
      : `Recovery is ${c.recovery ?? '—'}%, so you’re good to go. Today’s plan is the 32‑minute Station cycle on CEVIS.`;
  if (/hrv|variab/.test(s))
    return `HRV (heart-rate variability) is the variation between heartbeats, measured overnight. Higher than your own baseline usually means you’re recovered; lower can mean stress, poor sleep or illness. Yours is ${c.hrv ?? '—'} ms today.`;
  if (/heart|pulse|bpm|hr\b/.test(s))
    return `Resting heart rate is ${c.rhr ?? '—'} bpm, within your personal baseline. I compare it with your own history rather than population averages.`;
  if (/vision|eye|headache|sans/.test(s))
    return `Vision changes in flight can relate to SANS (fluid shift toward the head). You flagged a new symptom — I’ve marked it for your flight surgeon. If it gets worse or comes with a headache, report it right away.`;
  if (/mission|day|how long/.test(s))
    return `Today is mission day ${c.missionDay} of ${c.duration}. You’re ${Math.round((c.missionDay / c.duration) * 100)}% of the way through.`;
  if (/^(hi|hello|hey|привет)/.test(s)) return `Hi ${first}. Ask me about your sleep, recovery, radiation dose or today’s training.`;
  return `I can help with your sleep, recovery, heart signals, radiation dose and training plan. In this demo my answers come from your Celeste data; full conversation arrives when the assistant is connected.`;
}

export type Attachment = { name: string; mime: string; text?: string; data?: string };

export async function ask(history: ChatMsg[], ctx: AssistantContext, attachments: Attachment[] = []): Promise<string> {
  const last = history[history.length - 1];
  if (last && CRISIS.test(last.text)) return CARE_MESSAGE; // never leave a distress message to a template
  let note = '';
  if (ASSISTANT_PROVIDER === 'server') {
    try {
      const r = await api<{ reply: string; refused?: boolean }>('/api/assistant', { body: { messages: history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text })), context: ctx, ...(attachments.length ? { attachments } : {}) } });
      if (r.reply && !r.refused) return r.reply;
      note = 'the SI declined this message';
    } catch (e: any) {
      note = e?.status === 503 ? 'SI is not set up on this server: add ANTHROPIC_API_KEY' : e?.status === 429 ? 'the SI is busy' : 'the SI could not be reached';
    }
  }
  await new Promise(r => setTimeout(r, 450 + Math.random() * 350));
  return demoReply(last?.text ?? '', ctx, last?.files) + (note ? `\n\n(Demo reply: ${note}.)` : '');
}

export const titleFor = (q: string) => {
  const s = q.trim().replace(/\s+/g, ' ');
  return s.length > 34 ? s.slice(0, 32) + '…' : s.charAt(0).toUpperCase() + s.slice(1);
};
