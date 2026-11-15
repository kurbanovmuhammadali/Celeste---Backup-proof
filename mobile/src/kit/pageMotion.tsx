/**
 * The page's half of the transitions in ./transition: plays the entrance when the screen gets focus and registers
 * the exit the dock / back button will play before leaving. Used by <Page> and by screens with their own shell (SI).
 * Returns the animated style for the page wrapper and an `arrivals` counter (bumps on every tab arrival) so a
 * screen can add its own flourish, like the SI sphere powering up.
 */
import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MOTION, native } from './tokens';
import { clearLeaver, setLeaver, takeArrival, webMotion, type Leaver } from './transition';

export function usePageMotion({ tabs, onBlur }: { tabs?: boolean; onBlur?: () => void } = {}) {
  const tx = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(1)).current;
  const sc = useRef(new Animated.Value(1)).current;
  const focusN = useRef(0);
  const [arrivals, setArrivals] = useState(0);
  const blur = useRef(onBlur); blur.current = onBlur;

  useFocusEffect(useCallback(() => {
    const n = ++focusN.current;
    const a = takeArrival();
    if (webMotion) {
      let x = 0, o = 1, k = 1, dur = 660;
      if (a?.kind === 'tab') { x = a.dir * 70; o = 0; k = 0.965; }
      else if (a?.kind === 'back' || n > 1) { x = -44; o = 0; k = 0.985; dur = 560; }
      else if (!tabs) { x = 60; o = 0; dur = 560; }
      if (x) {
        tx.setValue(x); op.setValue(o); sc.setValue(k);
        Animated.parallel([
          Animated.timing(tx, { toValue: 0, duration: dur, easing: MOTION.out, useNativeDriver: native }),
          Animated.timing(op, { toValue: 1, duration: dur * 0.65, easing: MOTION.out, useNativeDriver: native }),
          Animated.timing(sc, { toValue: 1, duration: dur, easing: MOTION.out, useNativeDriver: native }),
        ]).start();
      } else { tx.setValue(0); op.setValue(1); sc.setValue(1); }
    }
    if (a?.kind === 'tab' || n === 1) setArrivals(v => v + 1);
    const leave: Leaver = dir => new Promise<void>(res => Animated.parallel([
      Animated.timing(tx, { toValue: -dir * 46, duration: 210, easing: MOTION.inOut, useNativeDriver: native }),
      Animated.timing(op, { toValue: 0, duration: 200, easing: MOTION.inOut, useNativeDriver: native }),
      Animated.timing(sc, { toValue: 0.975, duration: 210, easing: MOTION.inOut, useNativeDriver: native }),
    ]).start(() => res()));
    setLeaver(leave);
    return () => { clearLeaver(leave); blur.current?.(); };
  }, []));

  const style = { flex: 1, opacity: op, transform: [{ translateX: tx }, { scale: sc }] };
  return { style, arrivals };
}
