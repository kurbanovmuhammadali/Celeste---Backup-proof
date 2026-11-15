/**
 * The Celeste orbit — a copper-and-champagne orb with precessing orbit lines.
 * ready: slow orbit and breath · listening: tight fast pulse · speaking: wider pulse, rings swell.
 * Also the copper microphone badge with listening ripples.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { Mic } from 'lucide-react-native';
import { ELEV, K, native } from './tokens';
import { Pressy, useLoop } from './core';

export type OrbState = 'ready' | 'listening' | 'thinking' | 'speaking';

const RINGS = [
  { tilt: 0.34, rot: 18, dur: 26000, dir: 1, op: 0.6 },
  { tilt: 0.52, rot: -42, dur: 34000, dir: -1, op: 0.45 },
  { tilt: 0.22, rot: 70, dur: 21000, dir: 1, op: 0.5 },
  { tilt: 0.78, rot: -8, dur: 40000, dir: -1, op: 0.3 },
  { tilt: 0.42, rot: 115, dur: 30000, dir: 1, op: 0.38 },
];

export function AstraOrb({ size = 220, state = 'ready' }: { size?: number; state?: OrbState }) {
  const R = size / 2;
  const breath = useRef(new Animated.Value(0)).current;
  const speed = state === 'listening' ? 2.6 : state === 'speaking' ? 1.8 : state === 'thinking' ? 4 : 1;
  const spin = RINGS.map(r => useLoop(r.dur / speed));
  const glow = useLoop(state === 'ready' ? 4200 : 1600);
  useEffect(() => {
    const amp = state === 'listening' ? 1 : state === 'speaking' ? 1 : state === 'thinking' ? 0.6 : 0.5;
    const d = state === 'listening' ? 520 : state === 'speaking' ? 360 : state === 'thinking' ? 700 : 2600;
    breath.stopAnimation();
    const seq = state === 'speaking'
      ? Animated.sequence([
          Animated.timing(breath, { toValue: amp, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.timing(breath, { toValue: 0.25, duration: d * 0.8, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(breath, { toValue: 0.8, duration: d * 0.7, easing: Easing.out(Easing.quad), useNativeDriver: native }),
          Animated.timing(breath, { toValue: 0, duration: d * 1.2, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        ])
      : Animated.sequence([
          Animated.timing(breath, { toValue: amp, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(breath, { toValue: 0, duration: d, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ]);
    const l = Animated.loop(seq);
    l.start();
    return () => l.stop();
  }, [state]);
  const ampScale = state === 'speaking' ? 0.075 : state === 'listening' ? 0.045 : 0.018;
  const id = useMemo(() => Math.random().toString(36).slice(2, 7), []);

  return (
    <View style={{ width: size * 1.3, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel={`Celeste is ${state}`}>
      {/* halo */}
      <Animated.View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, opacity: glow.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }),
        transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + ampScale * 2.2] }) }] }}>
        <Svg width={size * 1.3} height={size * 1.3}>
          <Defs>
            <RadialGradient id={`h${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor="#E9B595" stopOpacity={0.55} />
              <Stop offset="1" stopColor="#F6E4D9" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size * 0.65} cy={size * 0.65} r={size * 0.65} fill={`url(#h${id})`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[{ width: size, height: size, borderRadius: R }, ELEV.float, { transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + ampScale] }) }] }]}>
        {/* sphere */}
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <RadialGradient id={`s${id}`} cx="36%" cy="30%" r="78%" fx="34%" fy="26%">
              <Stop offset="0" stopColor="#FFF3EA" />
              <Stop offset="0.28" stopColor="#F2CDB4" />
              <Stop offset="0.66" stopColor="#D08E68" />
              <Stop offset="1" stopColor="#8E4A2A" />
            </RadialGradient>
            <RadialGradient id={`r${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.82" stopColor="#8E4A2A" stopOpacity={0} />
              <Stop offset="1" stopColor="#6E3719" stopOpacity={0.35} />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill={`url(#s${id})`} />
          <Circle cx={R} cy={R} r={R} fill={`url(#r${id})`} />
        </Svg>
        {/* orbit lines: each a tilted ellipse spinning in the sphere's plane */}
        {RINGS.map((r, i) => (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', width: size, height: size, transform: [{ rotate: spin[i].interpolate({ inputRange: [0, 1], outputRange: [`${r.rot}deg`, `${r.rot + 360 * r.dir}deg`] }) }] }}>
            <Svg width={size} height={size}>
              <Ellipse cx={R} cy={R} rx={R * 0.9} ry={R * 0.9 * r.tilt} stroke="#FFF1E6" strokeOpacity={r.op} strokeWidth={1.1} fill="none" />
              {i === 0 ? <Circle cx={R + R * 0.9} cy={R} r={2.6} fill="#fff" /> : null}
              {i === 2 ? <Circle cx={R - R * 0.9} cy={R} r={1.8} fill="#FFE6D6" /> : null}
            </Svg>
          </Animated.View>
        ))}
        {/* core star */}
        <View pointerEvents="none" style={{ position: 'absolute', left: R - 7, top: R - 7, width: 14, height: 14, opacity: 0.55 }}>
          <Svg width={14} height={14} viewBox="0 0 24 24"><Ellipse cx={12} cy={12} rx={1.2} ry={9} fill="#fff" /><Ellipse cx={12} cy={12} rx={9} ry={1.2} fill="#fff" /></Svg>
        </View>
      </Animated.View>
    </View>
  );
}

/** Copper microphone badge; ripples while listening. */
export function MicBadge({ listening, onPress, size = 72 }: { listening?: boolean; onPress?: () => void; size?: number }) {
  const a = useLoop(1600, !!listening);
  const b = a.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0.5, 1, 0, 0.5] }); // second ripple, half a cycle behind
  const ripple = (v: Animated.Value | Animated.AnimatedInterpolation<number>) => (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: K.copper,
      opacity: listening ? v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }) : 0, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] }} />
  );
  return (
    <Pressy onPress={onPress} label={listening ? 'Stop listening' : 'Talk to Celeste'} to={0.9}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        {ripple(a)}{ripple(b)}
        <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: listening ? K.copperDeep : K.copper, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.7)' }, ELEV.copper]}>
          <Mic size={size * 0.36} color="#fff" strokeWidth={2} />
        </View>
      </View>
    </Pressy>
  );
}
