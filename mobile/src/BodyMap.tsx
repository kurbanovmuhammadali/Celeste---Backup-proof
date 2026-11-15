/**
 * Mission-ready body map: the faceless glass body (Higgsfield render, 2026-11-14) with a marker on each
 * place that has a finding. Markers breathe in their status colour; tapping one glides the camera in
 * (zoom + pan toward the point) and shows its label; tapping again or "reset" glides back out.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, Pressable, View } from 'react-native';
import { GLASS_BODY } from './astra';
import { K, native, toneColor } from './kit/tokens';
import { Txt, haptic } from './kit/core';
import type { Finding } from './data/crew';

function Marker({ f, on, onPress, i }: { f: Finding; on: boolean; onPress: () => void; i: number }) {
  const c = toneColor(f.tone);
  const breathe = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, delay: 250 + i * 120, useNativeDriver: native, speed: 12, bounciness: 14 }).start();
    const l = Animated.loop(Animated.timing(breathe, { toValue: 1, duration: 2000, useNativeDriver: native }));
    l.start(); return () => l.stop();
  }, []);
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${f.title}: ${f.sub}`} hitSlop={10}
      style={{ position: 'absolute', width: 44, height: 44, marginLeft: -22, marginTop: -22, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c,
        opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }] }} />
      <Animated.View style={{ width: on ? 18 : 14, height: on ? 18 : 14, borderRadius: 9, backgroundColor: c, borderWidth: 2.5, borderColor: '#fff', transform: [{ scale: pop }] }} />
    </Pressable>
  );
}

export default function BodyMap({ findings, selected, onSelect, height }: { findings: Finding[]; selected: string | null; onSelect: (id: string | null) => void; height: number }) {
  const [w, setW] = useState(0);
  const imgH = height - 24, imgW = imgH * GLASS_BODY.ratio;
  const left = (w - imgW) / 2, top = 12;
  const sel = findings.find(f => f.id === selected);

  // camera: zoom toward the selected point
  const cam = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const zoom = useRef(new Animated.Value(1)).current;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(enter, { toValue: 1, duration: 900, useNativeDriver: native }).start(); }, []);
  useEffect(() => {
    const Z = sel ? 1.7 : 1;
    const px = sel ? left + sel.at[0] * imgW : w / 2, py = sel ? top + sel.at[1] * imgH : height / 2;
    Animated.parallel([
      Animated.spring(zoom, { toValue: Z, useNativeDriver: native, stiffness: 120, damping: 20 }),
      Animated.spring(cam, { toValue: { x: (w / 2 - px) * Z, y: (height / 2 - py) * Z }, useNativeDriver: native, stiffness: 120, damping: 20 }),
    ]).start();
  }, [selected, w]);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height, overflow: 'hidden' }}>
      {w ? (
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: w, height, opacity: enter,
          transform: [{ translateX: cam.x }, { translateY: cam.y }, { scale: zoom }, { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
          <Pressable onPress={() => onSelect(null)} style={{ position: 'absolute', left, top, width: imgW, height: imgH }} accessibilityLabel="Body map">
            <Image source={GLASS_BODY.src} style={{ width: imgW, height: imgH }} resizeMode="contain" accessibilityIgnoresInvertColors />
          </Pressable>
          {findings.map((f, i) => (
            <View key={f.id} style={{ position: 'absolute', left: left + f.at[0] * imgW, top: top + f.at[1] * imgH }}>
              <Marker f={f} i={i} on={f.id === selected} onPress={() => onSelect(f.id === selected ? null : f.id)} />
            </View>
          ))}
        </Animated.View>
      ) : null}
      {sel ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: height / 2 + 26, alignItems: 'center' }}>
          <View style={{ backgroundColor: 'rgba(255,253,251,0.95)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: K.hair2 }}>
            <Txt v="subM">{sel.title}</Txt>
            <Txt v="caption" color={K.ink2}>{sel.sub}</Txt>
          </View>
        </View>
      ) : null}
    </View>
  );
}
