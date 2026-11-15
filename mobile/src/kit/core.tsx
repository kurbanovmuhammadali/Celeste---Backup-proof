/**
 * Core primitives: text, motion (focus-replayed staggered entrances, press springs, value tweens) and layout breakpoints.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, Text, TextProps, TextStyle, useWindowDimensions, View, ViewStyle, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { K, MOTION, TYPE, TypeKey, native, web } from './tokens';

// ----------------------------------------------------------------------------- haptics
export const haptic = {
  tap: () => { if (native) Haptics.selectionAsync().catch(() => {}); },
  soft: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {}); },
  firm: () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  success: () => { if (native) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
};

// ----------------------------------------------------------------------------- text
type TxtProps = TextProps & { v?: TypeKey; color?: string; center?: boolean; tabular?: boolean; upper?: boolean; style?: StyleProp<TextStyle> };
export function Txt({ v = 'body', color = K.ink, center, tabular, upper, style, ...p }: TxtProps) {
  return (
    <Text {...p} allowFontScaling={p.allowFontScaling ?? true} maxFontSizeMultiplier={1.4}
      style={[TYPE[v], { color }, center && { textAlign: 'center' }, tabular && { fontVariant: ['tabular-nums'] }, upper && { textTransform: 'uppercase' }, style]} />
  );
}
export function Kicker({ children, color = K.copperInk, style }: { children: React.ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Txt v="kicker" color={color} upper style={style}>{children}</Txt>;
}

// ----------------------------------------------------------------------------- layout
export function useLayout() {
  const { width: w, height: h } = useWindowDimensions();
  const sidebar = web && w >= 1024;
  return { w, h, wide: w >= 1024, tablet: w >= 700, sidebar, gutter: w >= 1024 ? 36 : w >= 700 ? 28 : 20 };
}

// ----------------------------------------------------------------------------- focus-replayed entrances
const Focus = createContext(0);
/**
 * Plays the <Rise> entrances once, the first time the screen is shown. Coming back to a screen that is already
 * mounted (tabs, going back) keeps it still — replaying every time made the interface jump.
 */
export function FocusReplay({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => { setTick(t => (t === 0 ? 1 : t)); }, []));
  return <Focus.Provider value={tick}>{children}</Focus.Provider>;
}
export const useFocusTick = () => useContext(Focus);

/** Fades and rises in; `i` staggers siblings. */
export function Rise({ i = 0, children, style, from = 16, scale, delay = 0 }: { i?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; from?: number; scale?: boolean; delay?: number }) {
  const tick = useFocusTick();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 640, delay: delay + 60 + Math.min(i, 12) * MOTION.stagger, easing: MOTION.out, useNativeDriver: native }).start();
  }, [tick]);
  const transform: any[] = [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }];
  if (scale) transform.push({ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) });
  return <Animated.View style={[style, { opacity: a, transform }]}>{children}</Animated.View>;
}

/** Like <Rise>, but waits until the block scrolls into view (sections below the fold slide up as you reach them). */
export function Appear({ i = 0, children, style, from = 26 }: { i?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; from?: number }) {
  const [ref, seen] = useInView(0.96);
  const born = useRef(Date.now()).current;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!seen) return;
    const late = Date.now() - born > 500; // revealed by scrolling → no page-load stagger
    Animated.timing(a, { toValue: 1, duration: 700, delay: late ? 0 : 80 + Math.min(i, 10) * MOTION.stagger, easing: MOTION.out, useNativeDriver: native }).start();
  }, [seen]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }}>{children}</Animated.View>
    </View>
  );
}

/** Re-plays a soft swap whenever `k` changes (date switches, layer changes, metric changes). */
export function Swap({ k, children, style, dir = 0 }: { k: string | number; children: React.ReactNode; style?: StyleProp<ViewStyle>; dir?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 420, easing: MOTION.out, useNativeDriver: native }).start();
  }, [k]);
  return (
    <Animated.View style={[style, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }), transform: [
      { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [dir * 14, 0] }) },
      { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [dir ? 0 : 6, 0] }) },
    ] }]}>{children}</Animated.View>
  );
}

// ----------------------------------------------------------------------------- press
type PressyProps = { children: React.ReactNode; onPress?: () => void; onLongPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; label?: string; role?: 'button' | 'tab' | 'link' | 'checkbox' | 'radio'; selected?: boolean; checked?: boolean; to?: number; hapticOn?: boolean; hitSlop?: number };
/** Springs down under the finger and back with a little overshoot; light haptic on press. */
export function Pressy({ children, onPress, onLongPress, disabled, style, label, role = 'button', selected, checked, to = 0.965, hapticOn = true, hitSlop }: PressyProps) {
  const s = useRef(new Animated.Value(1)).current;
  const spring = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: native, speed: v === 1 ? 18 : 50, bounciness: v === 1 ? 9 : 0 }).start();
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, selected, checked }} disabled={disabled} hitSlop={hitSlop}
      onPress={() => { if (hapticOn) haptic.tap(); onPress?.(); }} onLongPress={onLongPress} onPressIn={() => spring(to)} onPressOut={() => spring(1)}
      style={web ? ({ cursor: disabled ? 'default' : 'pointer' } as any) : undefined}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ----------------------------------------------------------------------------- tweens
/** Smoothly tweens a number toward `target` (count-ups, gauges). Re-runs on focus when `replay` is set.
 *  `run` = false holds it at 0 (e.g. until the value scrolls into view). */
export function useTween(target: number, duration = 900, replay = true, run = true) {
  const tick = useFocusTick();
  const [v, setV] = useState(replay ? 0 : target);
  const from = useRef(replay ? 0 : target);
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = Date.now();
    const a = replay && lastTick.current !== tick ? 0 : from.current;
    lastTick.current = tick;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const e = 1 - Math.pow(1 - t, 4);
      const x = a + (target - a) * e;
      from.current = x;
      setV(x);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, tick, run]);
  return v;
}

/** Endless 0→1 loop (orbits, pulses, shimmers). */
export function useLoop(duration: number, run = true) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!run) return;
    a.setValue(0);
    const l = Animated.loop(Animated.timing(a, { toValue: 1, duration, easing: (t: number) => t, useNativeDriver: native }));
    l.start();
    return () => l.stop();
  }, [duration, run]);
  return a;
}

export const isWeb = Platform.OS === 'web';

// ----------------------------------------------------------------------------- scroll-in-view
type Bus = { sub: (fn: () => void) => () => void; emit: () => void };
/** Every <Page> owns a scroll bus; things that animate "when seen" listen to it. */
export function makeScrollBus(): Bus {
  const subs = new Set<() => void>();
  let last = 0, timer: any = null;
  const fire = () => { last = Date.now(); timer = null; subs.forEach(f => f()); };
  return {
    sub: fn => { subs.add(fn); return () => { subs.delete(fn); }; },
    emit: () => { // throttled: ~12 checks a second is plenty for "has it appeared yet"
      if (timer) return;
      const wait = Math.max(0, 80 - (Date.now() - last));
      timer = setTimeout(fire, wait);
    },
  };
}
export const ScrollBus = createContext<Bus | null>(null);

/**
 * `[ref, seen]` — `seen` turns true (once) the first time the element is on screen, either right after layout
 * or as the page scrolls it into view. Attach `ref` to a <View collapsable={false}>.
 */
export function useInView(margin = 0.92) {
  const ref = useRef<any>(null);
  const bus = useContext(ScrollBus);
  const tick = useFocusTick();
  const { height } = useWindowDimensions();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    let alive = true;
    const check = () => {
      const n = ref.current;
      if (!n?.measureInWindow) { setSeen(true); return; }
      n.measureInWindow((_x: number, y: number, w: number, h: number) => {
        if (!alive || (!w && !h)) return;
        if (y < height * margin && y + h > 0) setSeen(true);
      });
    };
    // a few checks after mount too: a freshly opened tab may still be sliding in or have no size yet
    const ts = [160, 450, 900].map(ms => setTimeout(check, ms));
    const off = bus?.sub(check);
    return () => { alive = false; ts.forEach(clearTimeout); off?.(); };
  }, [seen, height, tick]);
  return [ref, seen] as const;
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * A number that counts up from 0 the first time it scrolls into view, then glides to new values.
 * `live` (units per second) keeps it ticking afterwards, like a running dosimeter.
 */
export function Count({ value, format = (x: number) => String(Math.round(x)), duration = 1300, delay = 0, live, v = 'headline', color = K.ink, style, children, numberOfLines, adjust, center }:
  { value: number | null | undefined; format?: (x: number) => string; duration?: number; delay?: number; live?: number; v?: TypeKey; color?: string; style?: StyleProp<TextStyle>; children?: React.ReactNode; numberOfLines?: number; adjust?: boolean; center?: boolean }) {
  const [ref, seen] = useInView();
  const [x, setX] = useState(0);
  const cur = useRef(0);
  const pop = useRef(new Animated.Value(1)).current;
  const target = value ?? 0;
  useEffect(() => {
    if (!seen || value == null) return;
    let raf = 0, t0 = 0;
    const from = cur.current;
    const begin = Date.now() + delay;
    let landed = false;
    const step = () => {
      const now = Date.now();
      if (now < begin) { raf = requestAnimationFrame(step); return; }
      const t = Math.min(1, (now - begin) / duration);
      let val = from + (target - from) * easeOutExpo(t);
      if (t >= 1) {
        if (!landed) {
          landed = true; t0 = now;
          pop.setValue(1.06);
          Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 14 }).start();
        }
        if (!live) { cur.current = target; setX(target); return; }
        val = target + (live * (now - t0)) / 1000;
      }
      cur.current = val; setX(val);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, target, live]);
  return (
    <View ref={ref} collapsable={false}>
      <Animated.View style={{ transform: [{ scale: pop }], alignSelf: center ? 'center' : 'flex-start', maxWidth: '100%' }}>
        <Txt v={v} tabular color={value == null ? K.ink3 : color} style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit={adjust}>
          {value == null ? '—' : format(x)}{children}
        </Txt>
      </Animated.View>
    </View>
  );
}
