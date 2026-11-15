/**
 * Page-to-page motion on web (iOS/Android already have native stack and tab transitions).
 *
 * - Switching tabs is a two-beat move: the current tab drifts out toward where you came from (≈0.2 s), then the
 *   new tab glides in from the side you are heading to (Home → Mission: out left, in from the right).
 * - Back: the current page slides out to the right, then the page underneath glides back in from the left.
 * - Opening a page: it slides in from the right.
 *
 * The dock / sidebar / back buttons announce what is happening here; pages play it via usePageMotion().
 */
import { router, type Href } from 'expo-router';
import { Platform } from 'react-native';

export type Arrive = { kind: 'tab'; dir: number } | { kind: 'back' } | null;
/** Plays the current page's exit; `dir` = 1 slides it out to the left (moving forward), -1 to the right. */
export type Leaver = (dir: number) => Promise<void>;

export const webMotion = Platform.OS === 'web';
let pending: Arrive = null;
let leaver: Leaver | null = null;

/** Tab order used to work out the slide direction. */
export const TAB_ORDER = ['today', 'hazards', 'assistant', 'body', 'profile'];
export const tabDir = (from: string | undefined, to: string) => {
  const a = TAB_ORDER.indexOf(from ?? ''), b = TAB_ORDER.indexOf(to);
  return a < 0 || b < 0 ? 1 : b > a ? 1 : -1;
};

export function announceTab(from: string | undefined, to: string) { pending = { kind: 'tab', dir: tabDir(from, to) }; }
export const takeArrival = (): Arrive => { const p = pending; pending = null; return p; };
export function setLeaver(fn: Leaver | null) { leaver = fn; }
export const clearLeaver = (fn: Leaver) => { if (leaver === fn) leaver = null; };

/** Tab switch: play the current tab's exit, then the caller navigates and the new tab plays its entrance. */
export async function leaveTab(from: string | undefined, to: string) {
  const dir = tabDir(from, to);
  if (webMotion && leaver) { const l = leaver; leaver = null; await l(dir); }
  pending = { kind: 'tab', dir };
}

/** Back with an exit animation on web; falls back to `fallback` when there is no history. */
export async function goBack(fallback: Href = '/today') {
  if (webMotion && leaver) { const l = leaver; leaver = null; await l(-1); }
  pending = { kind: 'back' };
  if (router.canGoBack()) router.back(); else router.replace(fallback);
}
