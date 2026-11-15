/**
 * Copper Horizon design tokens for the crew app (Home, Body, Assistant, Training, Profile).
 * One place for colour, type, spacing, radii, elevation and motion so every screen feels like one instrument.
 */
import { Easing, Platform, ViewStyle } from 'react-native';
import { F } from '../theme';

export const K = {
  // canvas
  canvas: '#F7EEE8',
  canvasTop: '#FBF5F1',
  canvasBottom: '#F2E1D6',
  // surfaces
  card: 'rgba(255,255,255,0.78)',
  cardSolid: '#FFFDFB',
  cardSunk: 'rgba(246,231,222,0.65)',
  hair: 'rgba(142,74,42,0.10)',
  hair2: 'rgba(142,74,42,0.16)',
  // ink
  ink: '#2B1E18',
  ink2: '#6E5A50',
  ink3: '#A8958B',
  ink4: '#CDBDB3',
  // copper
  copper: '#B8693F',
  copperDeep: '#8E4A2A',
  copperInk: '#9C5531',
  copperSoft: '#E3B79E',
  copperTint: '#F6E4D9',
  champagne: '#F3D9C6',
  // status (calm, warm-shifted)
  ok: '#5C9A6E',
  okTint: '#E4F0E6',
  watch: '#D69A3F',
  watchTint: '#F8EBD3',
  flag: '#C9553B',
  flagTint: '#F8DFD8',
  // dark
  space: '#1C120D',
  cocoa: '#3A2A22',
};

export type Tone = 'ok' | 'watch' | 'flag' | 'none';
export const toneColor = (t?: string) => (t === 'ok' || t === 'green' ? K.ok : t === 'watch' || t === 'amber' ? K.watch : t === 'flag' || t === 'red' ? K.flag : K.ink4);
export const toneTint = (t?: string) => (t === 'ok' || t === 'green' ? K.okTint : t === 'watch' || t === 'amber' ? K.watchTint : t === 'flag' || t === 'red' ? K.flagTint : K.cardSunk);
export const toneWord = (t?: string) => (t === 'ok' || t === 'green' ? 'Within baseline' : t === 'watch' || t === 'amber' ? 'Needs review' : t === 'flag' || t === 'red' ? 'Priority flag' : 'No data');

/** Type ramp. Sizes in pt; tracking tuned for Geist. */
export const TYPE = {
  hero: { fontFamily: F.sb, fontSize: 36, lineHeight: 38, letterSpacing: -1.5 },
  display: { fontFamily: F.sb, fontSize: 30, lineHeight: 33, letterSpacing: -1.1 },
  title: { fontFamily: F.sb, fontSize: 22, lineHeight: 26, letterSpacing: -0.6 },
  headline: { fontFamily: F.sb, fontSize: 16.5, lineHeight: 21, letterSpacing: -0.25 },
  body: { fontFamily: F.r, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  bodyM: { fontFamily: F.m, fontSize: 15, lineHeight: 21, letterSpacing: -0.15 },
  sub: { fontFamily: F.r, fontSize: 13, lineHeight: 18, letterSpacing: -0.05 },
  subM: { fontFamily: F.m, fontSize: 13, lineHeight: 18, letterSpacing: -0.05 },
  caption: { fontFamily: F.r, fontSize: 11.5, lineHeight: 15, letterSpacing: 0 },
  kicker: { fontFamily: F.monoM, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.6 },
  mono: { fontFamily: F.mono, fontSize: 11, lineHeight: 14, letterSpacing: 0.4 },
  num: { fontFamily: F.sb, fontSize: 24, lineHeight: 28, letterSpacing: -0.8 },
} as const;
export type TypeKey = keyof typeof TYPE;

export const S = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 28, gutter: 20 };
export const RAD = { xs: 10, s: 14, m: 20, l: 26, xl: 32, pill: 999 };

export const MOTION = {
  out: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.55, 0, 0.75, 0.2),
  fast: 220,
  base: 420,
  slow: 720,
  stagger: 55,
};

export const native = Platform.OS !== 'web';
export const web = Platform.OS === 'web';

const sh = (web: string, color: string, op: number, r: number, y: number, el: number) =>
  Platform.select<ViewStyle>({ web: { boxShadow: web } as ViewStyle, default: { shadowColor: color, shadowOpacity: op, shadowRadius: r, shadowOffset: { width: 0, height: y }, elevation: el } });

export const ELEV = {
  card: sh('0 1px 1px rgba(110,55,25,0.03), 0 10px 30px -14px rgba(110,55,25,0.22)', '#6E3719', 0.1, 16, 8, 2),
  float: sh('0 2px 4px rgba(110,55,25,0.04), 0 22px 44px -18px rgba(110,55,25,0.38)', '#6E3719', 0.18, 24, 14, 6),
  copper: sh('0 14px 30px -12px rgba(184,105,63,0.7)', '#B8693F', 0.38, 16, 10, 6),
};
