/**
 * LLM providers behind one small interface.
 *   - Gemini (Google AI): used when GEMINI_API_KEY is set. Model: GEMINI_MODEL (default "gemini-flash-latest").
 *   - Claude (Anthropic): used by companion.js when only ANTHROPIC_API_KEY is set.
 * Keys are read from the environment only and are never logged or returned to the app.
 */
const env = k => process.env[k]?.trim();
export const geminiOn = () => !!env('GEMINI_API_KEY');

const API = 'https://generativelanguage.googleapis.com/v1beta';

/** Builds the Gemini generateContent request body (pure, unit-tested). */
export function geminiBody({ system, messages, maxTokens = 700, json = false, images = [], thinkingOff = true }) {
  const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  if (images.length && contents.length) contents[contents.length - 1].parts.push(...images.map(i => ({ inlineData: { mimeType: i.mime, data: i.data } })));
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: Math.max(maxTokens * 3, 1500), // headroom: some models spend tokens thinking before they answer
      ...(json ? { responseMimeType: 'application/json' } : {}),
      ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
}

/** One Gemini call. Returns { text, refused }. Throws an error with .status mapped for the API layer. */
export async function geminiCall(opts) {
  const model = env('GEMINI_MODEL') || 'gemini-flash-latest';
  const post = async body => fetch(`${API}/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') }, body: JSON.stringify(body) });
  let r = await post(geminiBody(opts));
  if (r.status === 400) { const t = await r.clone().text(); if (/thinking/i.test(t)) r = await post(geminiBody({ ...opts, thinkingOff: false })); } // model without a thinking budget
  if (!r.ok) {
    const s = r.status === 401 || r.status === 403 ? 401 : r.status === 429 ? 429 : 502; // never pass Google's error text to the app
    console.error('[gemini] HTTP', r.status);
    throw Object.assign(new Error('Gemini request failed'), { status: s, headers: {} });
  }
  const j = await r.json();
  if (j.promptFeedback?.blockReason) return { text: '', refused: true };
  const c = j.candidates?.[0];
  const text = (c?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  return { text, refused: !text && ['SAFETY', 'PROHIBITED_CONTENT', 'RECITATION'].includes(c?.finishReason) };
}

