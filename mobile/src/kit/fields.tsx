import React from 'react';
import { TextInput, View } from 'react-native';
import { K, RAD } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { F } from '../theme';

/** Labelled text/number input in the Copper Horizon style. `multiline` gives a taller box for descriptions. */
export function Field({ label, value, onChange, unit, keyboard = 'decimal-pad', placeholder, hint, multiline }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; keyboard?: 'decimal-pad' | 'numeric' | 'default'; placeholder?: string; hint?: string; multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Kicker color={K.ink2}>{label}</Kicker>
      <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', marginTop: 6, backgroundColor: K.cardSolid, borderRadius: RAD.s, borderWidth: 1, borderColor: K.hair2, paddingHorizontal: 14, ...(multiline ? { minHeight: 96, paddingVertical: 12 } : { height: 48 }) }}>
        <TextInput value={value} onChangeText={onChange} keyboardType={keyboard} placeholder={placeholder} placeholderTextColor={K.ink4} accessibilityLabel={label} multiline={multiline}
          style={{ flex: 1, fontFamily: F.m, fontSize: 16, color: K.ink, outlineStyle: 'none' as any, ...(multiline ? { minHeight: 70, textAlignVertical: 'top' as const } : {}) }} />
        {unit ? <Txt v="mono" color={K.ink3}>{unit}</Txt> : null}
      </View>
      {hint ? <Txt v="caption" color={K.ink3} style={{ marginTop: 5 }}>{hint}</Txt> : null}
    </View>
  );
}
