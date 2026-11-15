/**
 * The SI's voice. First choice: the server's natural neural voice (Gemini text-to-speech, web). If that is unavailable
 * (offline, not configured, native) it falls back to the best voice the device has, reading clean sentences instead of markdown.
 */
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { API_URL } from '@/api';

const web = Platform.OS === 'web' && typeof window !== 'undefined';
let audio: HTMLAudioElement | null = null, token = 0;

/** Plain sentences for speech: no markdown marks, bullets become pauses. */
export const spoken = (t: string) => t.replace(/\*\*?|__|`+/g, '').replace(/^\s*[-•*]\s+/gm, '').replace(/^\s*\d+[.)]\s+/gm, '').replace(/\s*\n+\s*/g, '. ').replace(/\.\s*\./g, '.').trim();
export const langOf = (t: string) => (/[Ѐ-ӿ]/.test(t) ? 'ru-RU' : (typeof navigator !== 'undefined' && navigator.language) || 'en-US');

/** Best installed browser voice for a language: neural/natural/online voices first. */
function bestVoice(lang: string): SpeechSynthesisVoice | undefined {
  if (!web || !window.speechSynthesis) return undefined;
  const base = lang.slice(0, 2).toLowerCase();
  const vs = window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(base));
  const score = (v: SpeechSynthesisVoice) => (/natural|neural|online/i.test(v.name) ? 6 : 0) + (/google|samantha|ava|allison|serena|daniel|karen|moira/i.test(v.name) ? 3 : 0) + (v.lang.toLowerCase() === lang.toLowerCase() ? 2 : 0) + (v.localService ? 0 : 1);
  return vs.sort((a, b) => score(b) - score(a))[0];
}

export function stopSpeaking() {
  token++;
  try { audio?.pause(); } catch {}
  if (audio) { URL.revokeObjectURL(audio.src); audio = null; }
  Speech.stop();
}

/** Speaks `text`; resolves when it finished (or was stopped). `onStart` fires when sound begins. */
export async function speak(text: string, onStart?: () => void): Promise<void> {
  stopSpeaking();
  const me = token;
  const clean = spoken(text).slice(0, 700);
  if (!clean) return;
  if (web) {
    try {
      const res = await fetch(`${API_URL}/api/assistant/speak`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'perigee' }, body: JSON.stringify({ text: clean }) });
      if (res.ok && me === token) {
        const url = URL.createObjectURL(await res.blob());
        const a = new Audio(url); audio = a;
        await new Promise<void>((done, fail) => { a.onplay = () => onStart?.(); a.onended = () => done(); a.onerror = () => fail(new Error('audio')); a.play().catch(fail); });
        URL.revokeObjectURL(url); if (audio === a) audio = null;
        return;
      }
    } catch { /* fall back to the device voice */ }
    if (me !== token) return;
  }
  const lang = langOf(clean);
  await new Promise<void>(done => {
    const v = bestVoice(lang);
    Speech.speak(clean, { language: lang, voice: v?.voiceURI, rate: 0.98, pitch: 1.0, onStart, onDone: () => done(), onStopped: () => done(), onError: () => done() });
  });
}
