/** Small settings controls shared by Profile and its sub-menus. */
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { K } from './tokens';
import { Pressy, Txt, haptic } from './core';

export const Status = ({ on, onText = 'Connected', offText = 'Connect' }: { on: boolean; onText?: string; offText?: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: on ? K.okTint : K.copperTint }}>
    {on ? <Check size={12} color={K.ok} strokeWidth={2.6} /> : null}
    <Txt v="caption" color={on ? K.ok : K.copperInk} style={{ fontFamily: 'Geist_500Medium' }}>{on ? onText : offText}</Txt>
  </View>
);

/** Animated on/off switch. */
export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(a, { toValue: on ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 8 }).start(); }, [on]);
  return (
    <Pressy label={label} role="checkbox" checked={on} onPress={() => { haptic.tap(); onChange(!on); }} hitSlop={6}>
      <Animated.View style={{ width: 46, height: 28, borderRadius: 14, padding: 3, backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['#E3D3C8', K.copper] }) }}>
        <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }] }} />
      </Animated.View>
    </Pressy>
  );
}
