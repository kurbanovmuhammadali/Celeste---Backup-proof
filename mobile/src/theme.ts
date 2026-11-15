import { Platform } from 'react-native';

/** Palette sampled from the copper-ring reference: warm stone greys, bronze gradient, coral accent. */
export const C = {
  // re-tinted to Copper Horizon so every older screen (metric detail, sources, log, report, legal) matches the crew app
  bg: '#F7EEE8',
  bg2: '#F2E2D9',
  card: '#FFFDFB',
  soft: '#F6E4D9',
  ink: '#2B1E18',
  ink2: '#6E5A50',
  ink3: '#A8958B',
  line: '#EEDDD3',
  coral: '#B8693F',
  coral2: '#E3B79E',
  coralSoft: '#E3B79E',
  coralTint: '#F6E4D9',
  green: '#5C9A6E',
  greenTint: '#E4F0E6',
  amber: '#D69A3F',
  amberTint: '#F8EBD3',
  red: '#C9553B',
  redTint: '#F8DFD8',
  bronze: ['#F6E4D9', '#E3B79E', '#B8693F', '#5A3424'] as const,
  copper: '#B8693F',
};

/** Celeste "Copper Horizon" palette — sampled from the gradient / Mars references. */
export const A = {
  sand: '#F8EEE8',
  sand2: '#F2E2D9',
  blush: '#EDD3C5',
  copper: '#B8693F',
  copperDeep: '#8E4A2A',
  copperSoft: '#E3B79E',
  ink: '#2B1E18',
  ink2: '#6E5A50',
  ink3: '#A8958B',
  line: '#EAD8CE',
  space: '#1C120D',
  card: '#FFFFFF',
};

/** Geist for UI and display, Geist Mono for kickers, units and instrument read-outs. */
export const F = {
  r: 'Geist_400Regular',
  m: 'Geist_500Medium',
  sb: 'Geist_600SemiBold',
  b: 'Geist_700Bold',
  mono: 'GeistMono_400Regular',
  monoM: 'GeistMono_500Medium',
};

export type Status = 'green' | 'amber' | 'red' | 'none';
export const statusColor = (s?: string) => (s === 'green' ? C.green : s === 'amber' ? C.amber : s === 'red' ? C.red : C.ink3);
export const statusTint = (s?: string) => (s === 'green' ? C.greenTint : s === 'amber' ? C.amberTint : s === 'red' ? C.redTint : C.soft);
export const statusWord = (s?: string) => (s === 'green' ? 'Normal' : s === 'amber' ? 'Watch' : s === 'red' ? 'Act now' : 'No data');

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(60,40,30,0.04), 0 12px 32px rgba(60,40,30,0.06)' } as object,
  default: { shadowColor: '#3C281E', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
});

export const R = { card: 26, pill: 999, sm: 16 };
