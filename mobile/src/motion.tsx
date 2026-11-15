/**
 * Screen-to-screen motion for the onboarding flow (works the same on iOS, Android and web).
 * Every onboarding screen is wrapped in <MotionScreen>. Navigating with `nav.push/replace/back`
 * first plays the current screen's exit (slide + fade), then the next screen plays its entrance,
 * and its <Reveal> children cascade in one after another.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, ViewStyle } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';

export const native = Platform.OS !== 'web';
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);   // soft "expo out"
export const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.2);

type Dir = 'forward' | 'back';
type Leaver = (dir: Dir) => Promise<void>;
let current: Leaver | null = null;
let lastDir: Dir = 'forward';
let seamless = false;

export const nav = {
  push: async (href: Href) => { await current?.('forward'); lastDir = 'forward'; router.push(href); },
  replace: async (href: Href) => { await current?.('forward'); lastDir = 'forward'; router.replace(href); },
  /** Next screen appears already in place (no slide/fade) — the intro video dissolves into it. */
  seamless: () => { seamless = true; },
  back: async (fallback: Href = '/welcome') => {
    await current?.('back'); lastDir = 'back';
    if (router.canGoBack()) router.back(); else router.replace(fallback);
  },
};

const FocusTick = createContext(0);

/** `still`: fade only, no sideways slide (screens whose own entrance already moves, like Welcome). */
export function MotionScreen({ children, style, still }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; still?: boolean }) {
  const p = useRef(new Animated.Value(1)).current; // -1 off to the left · 0 on screen · 1 off to the right
  const [tick, setTick] = useState(0);
  const busy = useRef(false);
  useFocusEffect(useCallback(() => {
    if (seamless) { seamless = false; p.setValue(0); }
    else {
      p.setValue(lastDir === 'forward' ? 1 : -1);
      Animated.timing(p, { toValue: 0, duration: 520, easing: EASE_OUT, useNativeDriver: native }).start();
    }
    setTick(t => t + 1);
    const leave: Leaver = dir => new Promise(res => {
      if (busy.current) return res();
      busy.current = true;
      Animated.timing(p, { toValue: dir === 'forward' ? -1 : 1, duration: 240, easing: EASE_IN, useNativeDriver: native })
        .start(() => { busy.current = false; res(); });
    });
    current = leave;
    return () => { if (current === leave) current = null; };
  }, []));
  return (
    <FocusTick.Provider value={tick}>
      <Animated.View style={[{ flex: 1, opacity: p.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: still ? 0 : p.interpolate({ inputRange: [-1, 0, 1], outputRange: [-48, 0, 48] }) }] }, style]}>
        {children}
      </Animated.View>
    </FocusTick.Provider>
  );
}

/** Fades + rises in after the screen enters; `i` staggers siblings. Replays whenever the screen regains focus. */
export function Reveal({ i = 0, children, style, from = 18, scale }: { i?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; from?: number; scale?: boolean }) {
  const tick = useContext(FocusTick);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 620, delay: 140 + i * 80, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [tick]);
  const transform: any[] = [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }];
  if (scale) transform.push({ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) });
  return <Animated.View style={[style, { opacity: a, transform }]}>{children}</Animated.View>;
}

/** Replays a value 0→1 on every focus — for custom entrance choreography (hero zoom, ship fly-in…). */
export function useEntrance(duration = 900, delay = 0) {
  const tick = useContext(FocusTick);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration, delay, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [tick]);
  return a;
}
