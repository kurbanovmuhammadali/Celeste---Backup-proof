/**
 * Repeat a questionable measurement. A breathing guide + countdown ring runs a 30-second reading on the same
 * device; the result is compared ONLY with that device's own baseline and says plainly whether the alert cleared.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { X } from 'lucide-react-native';
import { K, native } from '@/kit/tokens';
import { Pressy, Txt, haptic } from '@/kit/core';
import { Button } from '@/kit/ui';
import { SOURCE, useMission } from '@/data/mission';
import { setStore } from '@/data/store';

const SECONDS = 30;

export default function Remeasure() {
  const { metric = 'hrv' } = useLocalSearchParams<{ metric?: string }>();
  const insets = useSafeAreaInsets();
  const m = useMission();
  const r = m.readings[metric] ?? m.readings.hrv;
  const before = useRef(r.text).current;
  const [left, setLeft] = useState(SECONDS);
  const [result, setResult] = useState<{ value: number; ok: boolean } | null>(null);
  const breathe = useRef(new Animated.Value(0)).current;
  const sheet = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(breathe, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    l.start();
    const t0 = Date.now();
    const id = setInterval(() => {
      const s = Math.max(0, SECONDS - (Date.now() - t0) / 1000);
      setLeft(s);
      if (s <= 0) { clearInterval(id); l.stop(); finish(); }
    }, 100);
    return () => { clearInterval(id); l.stop(); };
  }, []);

  const finish = () => {
    const b = r.baseline;
    const mid = b ? (b.lo + b.hi) / 2 : (r.value ?? 50);
    const value = Math.round(mid + (b ? (b.hi - b.lo) * 0.1 : 0));
    const ok = !b || (value >= b.lo && value <= b.hi + (b.hi - b.lo));
    setStore(s => ({ ...s, remeasure: { ...s.remeasure, [r.key]: { value, at: Date.now(), source: r.source } } }));
    haptic.success();
    setResult({ value, ok });
    Animated.spring(sheet, { toValue: 1, useNativeDriver: native, speed: 12, bounciness: 5 }).start();
  };

  const size = 230, sw = 12, rad = (size - sw) / 2, C = 2 * Math.PI * rad;
  const p = 1 - left / SECONDS;
  const mm = Math.floor(Math.ceil(left) / 60), ss = Math.ceil(left) % 60;
  const unit = r.unit === '%' ? '%' : ` ${r.unit}`;

  return (
    <View style={{ flex: 1, backgroundColor: K.canvas, paddingTop: insets.top + 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
        <Txt v="mono" color={K.ink3} upper style={{ fontSize: 10 }}>Re-measure · {r.label}</Txt>
        <Pressy label="Close" onPress={() => router.back()}><View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><X size={16} color={K.ink} /></View></Pressy>
      </View>
      <Txt v="display" center style={{ marginTop: 18, paddingHorizontal: 24 }}>{result ? 'Done' : 'Sit still and breathe slowly'}</Txt>
      <Txt v="sub" color={K.ink2} center style={{ marginTop: 6, paddingHorizontal: 30 }}>Reading from your {SOURCE[r.source]} — the same device as before, so the comparison is fair.</Txt>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 28, height: size }}>
        <Animated.View style={{ position: 'absolute', width: size * 0.62, height: size * 0.62, borderRadius: size, backgroundColor: 'rgba(241,205,182,0.55)',
          transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }] }} />
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={rad} stroke={K.copperTint} strokeWidth={sw} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={rad} stroke={K.copper} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - p)} />
        </Svg>
        <Txt v="hero" tabular style={{ fontSize: 44, lineHeight: 48 }}>{mm}:{String(ss).padStart(2, '0')}</Txt>
        <Animated.Text style={{ fontFamily: 'Geist_400Regular', fontSize: 13, color: K.ink2, opacity: breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 1] }) }}>{result ? 'reading saved' : 'breathe in… and out…'}</Animated.Text>
      </View>
      {result ? (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFAF7', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20,
          transform: [{ translateY: sheet.interpolate({ inputRange: [0, 1], outputRange: [380, 0] }) }] }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Txt v="headline">Result</Txt>
            <View style={{ paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: result.ok ? K.okTint : K.watchTint }}>
              <Txt v="caption" color={result.ok ? '#3E7550' : '#93621F'} style={{ fontFamily: 'Geist_600SemiBold' }}>{result.ok ? 'Alert cleared' : 'Alert remains'}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: K.cardSunk }}><Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>Before</Txt><Txt v="title" tabular style={{ marginTop: 2 }}>{before}</Txt></View>
            <View style={{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: K.cardSunk }}><Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>Now</Txt><Txt v="title" tabular color={result.ok ? K.ok : K.watch} style={{ marginTop: 2 }}>{result.value}{unit}</Txt></View>
          </View>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 10 }}>{r.baseline ? `Compared with your ${r.baseline.label.split(' · ')[0]} baseline (${r.baseline.lo}–${r.baseline.hi}). Readings from other devices are never mixed in.` : 'No baseline yet for this value.'}</Txt>
          <Button title="Back to Home" onPress={() => router.back()} style={{ marginTop: 14 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
