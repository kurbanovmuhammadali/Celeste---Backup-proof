/** Natural speech for the SI: Gemini text-to-speech (needs GEMINI_API_KEY). Returns a WAV buffer. Nothing is stored. */
import { geminiOn } from './llm.js';

const env = k => process.env[k]?.trim();
export const ttsOn = () => geminiOn();
/** Markdown and symbols out, so the voice reads sentences, not asterisks. */
export const speakable = t => String(t || '').replace(/\*\*?|__|`+/g, '').replace(/^\s*[-•*]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '').replace(/\s*\n+\s*/g, '. ').replace(/\.\s*\./g, '.').trim().slice(0, 700);

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function speakWav(text) {
  const model = env('GEMINI_TTS_MODEL') || 'gemini-2.5-flash-preview-tts';
  const voice = env('GEMINI_TTS_VOICE') || 'Kore';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env('GEMINI_API_KEY') },
    body: JSON.stringify({ contents: [{ parts: [{ text: `Say warmly and calmly, at a natural pace: ${speakable(text)}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) { console.error('[tts] HTTP', r.status); throw Object.assign(new Error('Speech request failed'), { status: r.status === 429 ? 429 : 502 }); }
  const j = await r.json();
  const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part) throw Object.assign(new Error('No audio returned'), { status: 502 });
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return wav(Buffer.from(part.inlineData.data, 'base64'), rate);
}
