import React from 'react';
import { View } from 'react-native';
import { A } from '@/theme';
import { T } from '@/ui';
import { Press } from '@/astra';

/** Selectable option pill used in the extra sign-up steps (sex, goal, EVA, data source). */
export function Opt({ label, sub, on, onPress, wide }: { label: string; sub?: string; on: boolean; onPress: () => void; wide?: boolean }) {
  return (
    <Press onPress={onPress} label={label} role="checkbox" state={{ checked: on }}
      style={{ paddingHorizontal: 16, paddingVertical: wide ? 16 : 12, borderRadius: wide ? 20 : 999, borderWidth: 1.5, borderColor: on ? A.copper : 'rgba(227,183,158,0.7)', backgroundColor: on ? '#FFF4EC' : 'rgba(255,255,255,0.75)' }}>
      <T size={15} weight={on ? 'sb' : 'm'} color={on ? A.copperDeep : A.ink}>{label}</T>
      {sub ? <T size={12.5} color={A.ink2} style={{ marginTop: 3, lineHeight: 17 }}>{sub}</T> : null}
    </Press>
  );
}

export const Row = ({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 10 }}>{children}</View>;
export const Label = ({ children }: { children: string }) => <T size={13} weight="m" color={A.ink2} style={{ marginTop: 20, letterSpacing: 0.3 }}>{children.toUpperCase()}</T>;
