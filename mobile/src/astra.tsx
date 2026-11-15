/**
 * Celeste "Copper Horizon" building blocks used by the intro, onboarding and home screens.
 * Visual language: warm sand surfaces, copper gradient, white round buttons, copper pills.
 * Everything here is animated: springs on press, glow on focus, pops on success.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleProp, TextInput, TextInputProps, View, ViewStyle, PanResponder } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { A, F } from './theme';
import { T } from './ui';
import { EASE_OUT, MotionScreen, Reveal, native, useEntrance } from './motion';

export const IMG = {
  mars: require('../assets/astra/mars.jpg'),
  gradient: require('../assets/astra/gradient.jpg'),
  ship: require('../assets/astra/ship.png'),
  body: require('../assets/astra/body.png'),
  envelope: require('../assets/astra/envelope.png'),
  wave: require('../assets/astra/wave.png'),
};
/** The user's space art (2026-11-14) for in-app screens; registration keeps the original ship and Mars. */
export const SPACE = {
  earth: require('../assets/space/earth.png'),
  mars: require('../assets/space/mars.png'),
  jupiter: require('../assets/space/jupiter.png'),
  ship: require('../assets/space/ship.png'),
  deep: require('../assets/space/deep-space.jpg'), // the user's deep-space nebula (2000×678)
  deepRatio: 2000 / 678,
  shipRatio: 360 / 311,
  shipNose: -36, // degrees: the ship's nose points up-right in the artwork
};
export const GLASS_BODY = { src: require('../assets/body/glass.png'), ratio: 478 / 1291 };
/** Natural aspect ratios (width / height) of the images above. */
export const RATIO = { ship: 900 / 543, body: 900 / 857, envelope: 791 / 685, wave: 900 / 458, mars: 852 / 1846 };

export const tick = () => { if (native) Haptics.selectionAsync().catch(() => {}); };
export const thud = () => { if (native) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };

// ----------------------------------------------------------------------------- brand
export function Star({ size = 20, color = A.copper }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M12 1.5C12.9 8 16 11.1 22.5 12 16 12.9 12.9 16 12 22.5 11.1 16 8 12.9 1.5 12 8 11.1 11.1 8 12 1.5Z" />
    </Svg>
  );
}
export function AstraLogo({ color = A.ink, star = A.copper, size = 18 }: { color?: string; star?: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }} accessibilityRole="header" accessibilityLabel="Celeste">
      <Star size={size} color={star} />
      <T size={size} weight="sb" color={color} style={{ letterSpacing: 1.2 }}>CELESTE</T>
    </View>
  );
}

// ----------------------------------------------------------------------------- press feedback
/** Pressable that springs down on touch and back on release. */
export function Press({ children, onPress, disabled, style, label, role = 'button', state }: {
  children: React.ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; label?: string;
  role?: 'button' | 'checkbox' | 'tab'; state?: object;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: native, speed: 40, bounciness: v === 1 ? 10 : 0 }).start();
  return (
    <Pressable accessibilityRole={role} accessibilityLabel={label} accessibilityState={{ disabled: !!disabled, ...state }} disabled={disabled}
      onPress={onPress} onPressIn={() => to(0.94)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ----------------------------------------------------------------------------- buttons
export function RoundBtn({ dir, onPress, kind = 'white', disabled, label, loading }: { dir: 'back' | 'next'; onPress?: () => void; kind?: 'white' | 'copper'; disabled?: boolean; label?: string; loading?: boolean }) {
  const Icon = dir === 'back' ? ChevronLeft : ChevronRight;
  const copper = kind === 'copper';
  const on = useRef(new Animated.Value(disabled ? 0 : 1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const was = useRef(disabled);
  useEffect(() => {
    Animated.timing(on, { toValue: disabled ? 0 : 1, duration: 260, useNativeDriver: false }).start();
    if (was.current && !disabled) { // just became available → little pop so the user notices
      thud();
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.16, useNativeDriver: native, speed: 30, bounciness: 0 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 12, bounciness: 14 }),
      ]).start();
    }
    was.current = disabled;
  }, [disabled]);
  const bg = on.interpolate({ inputRange: [0, 1], outputRange: copper ? ['#E9D6CB', A.copper] : ['rgba(255,255,255,0.55)', '#FFFFFF'] });
  return (
    <Press onPress={onPress} disabled={disabled || loading} label={label ?? (dir === 'back' ? 'Back' : 'Next')}>
      <Animated.View style={[{ transform: [{ scale: pop }] }, !disabled ? (copper ? shadowCopper : shadowSoft) : null, { borderRadius: 28 }]}>
        <Animated.View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
          {loading ? <ActivityIndicator color="#fff" /> : <Icon size={22} color={copper ? '#fff' : A.ink} strokeWidth={2} />}
        </Animated.View>
      </Animated.View>
    </Press>
  );
}

export function Pill({ title, onPress, kind = 'copper', disabled, loading, style, icon }: { title: string; onPress?: () => void; kind?: 'copper' | 'outline' | 'white' | 'glass'; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>; icon?: React.ReactNode }) {
  const bg = kind === 'copper' ? A.copper : kind === 'white' ? '#fff' : kind === 'glass' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)';
  const fg = kind === 'copper' || kind === 'glass' ? '#fff' : A.ink;
  return (
    <Press label={title} disabled={disabled || loading} onPress={onPress} style={[{
      height: 56, borderRadius: 28, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10,
      borderWidth: kind === 'outline' ? 1.2 : kind === 'glass' ? 1 : 0, borderColor: kind === 'glass' ? 'rgba(255,255,255,0.55)' : A.copperSoft,
      opacity: disabled ? 0.5 : 1,
    }, kind === 'copper' && !disabled ? shadowCopper : null, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <><T size={16} weight="m" color={fg}>{title}</T>{icon}</>}
    </Press>
  );
}

export const shadowSoft = Platform.select<ViewStyle>({
  web: { boxShadow: '0 10px 24px -10px rgba(110,55,25,0.45)' } as ViewStyle,
  default: { shadowColor: '#6E3719', shadowOpacity: 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
});
export const shadowCopper = Platform.select<ViewStyle>({
  web: { boxShadow: '0 14px 28px -12px rgba(184,105,63,0.75)' } as ViewStyle,
  default: { shadowColor: '#B8693F', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
});

// ----------------------------------------------------------------------------- form bits
/** Progress dashes; the current one fills in when the screen appears. */
export function Steps({ n, of = 7, light }: { n: number; of?: number; light?: boolean }) {
  const fill = useEntrance(700, 250);
  const offC = light ? 'rgba(255,255,255,0.35)' : 'rgba(43,30,24,0.14)';
  const onC = light ? '#fff' : A.copper;
  return (
    <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => {
        const done = i < n - 1, cur = i === n - 1;
        return (
          <View key={i} style={{ width: done || cur ? 22 : 14, height: 3, borderRadius: 2, backgroundColor: offC, overflow: 'hidden' }}>
            {done ? <View style={{ flex: 1, backgroundColor: onC }} /> : null}
            {cur ? <Animated.View style={{ width: 22, height: 3, backgroundColor: onC, transformOrigin: 'left', transform: [{ scaleX: fill }] } as any} /> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Focus a TextInput once the screen has finished sliding in (no keyboard jumping mid-animation, no page scroll on web). */
export function focusSoon(ref: React.RefObject<TextInput | null>, delay = 650) {
  const id = setTimeout(() => {
    const el: any = ref.current;
    if (!el) return;
    if (Platform.OS === 'web' && typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) el.focus({ preventScroll: true });
    else el.focus?.();
  }, delay);
  return () => clearTimeout(id);
}

/** Text field: label tints copper and a soft glow grows on focus; a check pops in once the value is valid; shakes on error. */
export function Input({ label, required, error, valid, style, onFocus, onBlur, focusOnEnter, ...p }: TextInputProps & { label: string; required?: boolean; error?: string | null; valid?: boolean; focusOnEnter?: boolean }) {
  const ref = useRef<TextInput>(null);
  useEffect(() => (focusOnEnter ? focusSoon(ref) : undefined), []);
  const f = useRef(new Animated.Value(0)).current;
  const ok = useRef(new Animated.Value(valid ? 1 : 0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(ok, { toValue: valid ? 1 : 0, useNativeDriver: native, speed: 14, bounciness: 12 }).start(); if (valid) tick(); }, [valid]);
  useEffect(() => {
    if (!error) return;
    Animated.sequence([10, -9, 6, -4, 0].map(v => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: native }))).start();
  }, [error]);
  const focusTo = (v: number) => Animated.timing(f, { toValue: v, duration: 260, easing: EASE_OUT, useNativeDriver: false }).start();
  const border = error ? '#D9583F' : f.interpolate({ inputRange: [0, 1], outputRange: ['rgba(227,183,158,0)', A.copperSoft] });
  return (
    <Animated.View style={{ marginTop: 18, transform: [{ translateX: shake }] }}>
      <Animated.Text style={{ fontFamily: F.m, fontSize: 13.5, marginBottom: 8, marginLeft: 2, color: f.interpolate({ inputRange: [0, 1], outputRange: [A.ink, A.copperDeep] }) }}>
        {label}{required ? <T size={13.5} color={A.copper}> *</T> : null}
      </Animated.Text>
      <View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: -4, borderRadius: 22, backgroundColor: A.copperSoft, opacity: f.interpolate({ inputRange: [0, 1], outputRange: [0, 0.28] }) } as any} />
        <Animated.View style={{ borderRadius: 18, borderWidth: 1.2, borderColor: border, backgroundColor: 'rgba(255,255,255,0.94)' }}>
          <TextInput ref={ref} accessibilityLabel={label} placeholderTextColor={A.ink3}
            onFocus={e => { focusTo(1); onFocus?.(e); }} onBlur={e => { focusTo(0); onBlur?.(e); }}
            style={[{ height: 52, paddingHorizontal: 18, paddingRight: 48, fontFamily: F.r, fontSize: 16, color: A.ink }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null, style]} {...p} />
          <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 14, top: 15, width: 22, height: 22, borderRadius: 11, backgroundColor: A.copper, alignItems: 'center', justifyContent: 'center', opacity: ok, transform: [{ scale: ok }] }}>
            <Check size={13} color="#fff" strokeWidth={3} />
          </Animated.View>
        </Animated.View>
      </View>
      {error ? <T size={12.5} color="#C0472F" style={{ marginTop: 6, marginLeft: 4 }}>{error}</T> : null}
    </Animated.View>
  );
}

export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  const c = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    Animated.timing(c, { toValue: checked ? 1 : 0, duration: 220, useNativeDriver: false }).start();
    if (first.current) { first.current = false; return; }
    tick();
    Animated.sequence([
      Animated.timing(pop, { toValue: 0.8, duration: 90, useNativeDriver: native }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 18 }),
    ]).start();
  }, [checked]);
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 22 }}>
      <Animated.View style={{ width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 0, borderWidth: 1.2,
        backgroundColor: c.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.95)', A.copper] }),
        borderColor: c.interpolate({ inputRange: [0, 1], outputRange: [A.copperSoft, A.copper] }), transform: [{ scale: pop }] }}>
        <Animated.View style={{ opacity: c, transform: [{ scale: c }, { rotate: c.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }}>
          <Check size={15} color="#fff" strokeWidth={3} />
        </Animated.View>
      </Animated.View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Lets a form child scroll the form (e.g. bring an opened option list into view). */
export const FormScroll = React.createContext<{ toEnd: () => void }>({ toEnd: () => {} });

/** Light sand screen with a soft copper wave, cascading content and back / next round buttons (sign-up forms). */
export function FormShell({ step, title, sub, children, onBack, onNext, nextDisabled, nextLoading, nextLabel, top }: {
  step?: number; title: string; sub?: string; children: React.ReactNode; onBack?: () => void; onNext?: () => void;
  nextDisabled?: boolean; nextLoading?: boolean; nextLabel?: string; top?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const wave = useEntrance(1400);
  const scroll = useRef<ScrollView>(null);
  const ctx = useRef({ toEnd: () => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 280) }).current;
  let i = 0;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: A.sand, overflow: 'hidden' }}>
      <LinearGradient colors={['#FBF2EE', A.sand, '#F3E3DA']} locations={[0, 0.55, 1]} style={{ position: 'absolute', inset: 0 } as any} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -40, right: -40, bottom: 0, transform: [{ translateY: wave.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }, { translateX: wave.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
        <Svg width="100%" height={180} viewBox="0 0 400 180" preserveAspectRatio="none">
          <Path d="M0 70 C 90 30, 170 120, 260 80 S 370 40, 400 60 L400 180 L0 180Z" fill="#EFD6C9" opacity={0.55} />
          <Path d="M0 110 C 110 70, 190 150, 290 112 S 380 90, 400 100 L400 180 L0 180Z" fill="#E8C6B4" opacity={0.45} />
        </Svg>
      </Animated.View>
      <MotionScreen>
        <FormScroll.Provider value={ctx}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 22, paddingHorizontal: 24, paddingBottom: 130 + insets.bottom, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
          {step ? <Reveal i={i++}><Steps n={step} /></Reveal> : null}
          {top ? <Reveal i={i++} scale>{top}</Reveal> : null}
          <Reveal i={i++}><T size={32} weight="sb" color={A.ink} style={{ marginTop: step ? 26 : 8, letterSpacing: -0.6, lineHeight: 37 }}>{title}</T></Reveal>
          {sub ? <Reveal i={i++}><T size={15} color={A.ink2} style={{ marginTop: 10, lineHeight: 21 }}>{sub}</T></Reveal> : null}
          {React.Children.toArray(children).map((c, k) => <Reveal key={k} i={i + k}>{c}</Reveal>)}
        </ScrollView>
        </FormScroll.Provider>
        <LinearGradient pointerEvents="none" colors={['rgba(243,227,218,0)', 'rgba(243,227,218,0.94)']} locations={[0, 0.5]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 + insets.bottom }} />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 26, alignItems: 'center' }}>
          <Reveal i={3} from={30} style={{ width: '100%', maxWidth: 520, paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <RoundBtn dir="back" onPress={onBack} />
            {onNext ? <RoundBtn dir="next" kind="copper" onPress={onNext} disabled={nextDisabled} loading={nextLoading} label={nextLabel} /> : <View style={{ width: 56 }} />}
          </Reveal>
        </View>
      </MotionScreen>
    </KeyboardAvoidingView>
  );
}

// ----------------------------------------------------------------------------- measure field
/**
 * Height / weight field. Closed it is a button showing the value ("175 cm · 5′9″").
 * Tapping it slides a ruler open underneath: scroll it by hand, the copper needle stays centred,
 * a tick every unit, a number every 5. Each new value ticks (haptic) and the value above rolls.
 */
export function MeasureField({ label, min, max, value, onChange, unit, alt, open, onToggle }: {
  label: string; min: number; max: number; value: number; onChange: (v: number) => void; unit: string; alt?: string;
  open: boolean; onToggle: () => void;
}) {
  const reveal = useRef(new Animated.Value(open ? 1 : 0)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    Animated.spring(reveal, { toValue: open ? 1 : 0, useNativeDriver: false, speed: 14, bounciness: open ? 5 : 0 }).start(() => { if (!open) setMounted(false); });
  }, [open]);
  const roll = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const dir = value > prev.current ? 1 : -1; prev.current = value;
    roll.setValue(dir > 0 ? 0 : 2);
    Animated.spring(roll, { toValue: 1, useNativeDriver: native, speed: 30, bounciness: 4 }).start();
  }, [value]);
  const border = reveal.interpolate({ inputRange: [0, 1], outputRange: ['rgba(227,183,158,0)', A.copperSoft] });
  return (
    <View style={{ marginTop: 18 }}>
      <Animated.Text style={{ fontFamily: F.m, fontSize: 13.5, marginBottom: 8, marginLeft: 2, color: reveal.interpolate({ inputRange: [0, 1], outputRange: [A.ink, A.copperDeep] }) }}>{label}</Animated.Text>
      <Animated.View style={{ borderRadius: 18, borderWidth: 1.2, borderColor: border, backgroundColor: 'rgba(255,255,255,0.94)', overflow: 'hidden' }}>
        <Pressable onPress={() => { tick(); onToggle(); }} accessibilityRole="button" accessibilityLabel={`${label}, ${value} ${unit}`} accessibilityState={{ expanded: open }} accessibilityHint="Opens a scroll ruler"
          style={{ height: 52, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' }}>
          <Animated.View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, opacity: roll.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 0.4] }),
            transform: [{ translateY: roll.interpolate({ inputRange: [0, 1, 2], outputRange: [8, 0, -8] }) }] }}>
            <T size={17} weight="sb" color={A.ink}>{String(value)}</T>
            <T size={14} weight="m" color={A.ink2}>{unit}</T>
          </Animated.View>
          {alt ? <T size={13} color={A.ink3} style={{ marginLeft: 8 }}>· {alt}</T> : null}
          <View style={{ flex: 1 }} />
          <Animated.View style={{ transform: [{ rotate: reveal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <ChevronDown size={18} color={A.copper} strokeWidth={2} />
          </Animated.View>
        </Pressable>
        <Animated.View style={{ height: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, 86] }), opacity: reveal }}>
          {mounted ? <Ruler2 min={min} max={max} value={value} onChange={onChange} /> : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/**
 * Straight measuring ruler you grab and drag (finger or mouse), with momentum and a soft snap to whole units;
 * the mouse wheel / trackpad also moves it. Ticks every unit, numbers every 5, copper needle fixed in the centre.
 */
function Ruler2({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }) {
  const U = 12; // px per unit
  const [w, setW] = useState(0);
  const pos = useRef(new Animated.Value(value)).current;     // continuous value under the needle
  const cur = useRef(value);
  const last = useRef(value);
  const cb = useRef(onChange); cb.current = onChange;
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  useEffect(() => {
    const id = pos.addListener(({ value: v }) => {
      cur.current = v;
      const s = Math.round(clamp(v));
      if (s !== last.current) { last.current = s; tick(); cb.current(s); }
    });
    return () => pos.removeListener(id);
  }, []);
  const settle = () => Animated.spring(pos, { toValue: Math.round(clamp(cur.current)), useNativeDriver: false, speed: 14, bounciness: 4 }).start();
  const start = useRef(value);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { pos.stopAnimation(); start.current = cur.current; },
    onPanResponderMove: (_, g) => { const v = start.current - g.dx / U; pos.setValue(v < min ? min - (min - v) * 0.3 : v > max ? max + (v - max) * 0.3 : v); },
    onPanResponderRelease: (_, g) => {
      const vel = -g.vx / U; // units per ms
      if (Math.abs(g.vx) < 0.05 || cur.current < min || cur.current > max) { if (Math.abs(g.dx) < 3) { /* tap */ } return settle(); }
      Animated.decay(pos, { velocity: Math.max(-1.6, Math.min(1.6, vel)), deceleration: 0.993, useNativeDriver: false }).start(settle);
    },
    onPanResponderTerminate: settle,
  })).current;
  // mouse wheel / trackpad on the web
  const box = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !box.current) return;
    const el = box.current as HTMLElement;
    let t: any;
    const on = (e: WheelEvent) => { e.preventDefault(); pos.stopAnimation(); pos.setValue(clamp(cur.current + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / U)); clearTimeout(t); t = setTimeout(settle, 140); };
    el.addEventListener('wheel', on, { passive: false });
    return () => el.removeEventListener('wheel', on);
  }, [w]);
  const n = max - min + 1;
  const x = Animated.add(Animated.multiply(pos, -U), w / 2 + min * U); // left offset of the tick strip
  return (
    <View ref={box} onLayout={e => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}
      style={[{ height: 86, borderTopWidth: 1, borderTopColor: 'rgba(184,105,63,0.12)', overflow: 'hidden' }, Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'none' } as any) : null]}>
      {w ? (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, width: n * U, height: 86, flexDirection: 'row', transform: [{ translateX: Animated.add(x, -U / 2) }] }}>
          {Array.from({ length: n }, (_, i) => {
            const v = min + i, five = v % 5 === 0, ten = v % 10 === 0;
            const near = pos.interpolate({ inputRange: [v - 6, v, v + 6], outputRange: [0, 1, 0], extrapolate: 'clamp' });
            return (
              <View key={v} style={{ width: U, height: 86, alignItems: 'center' }}>
                <Animated.View style={{ marginTop: 14, width: ten ? 2 : 1.4, height: ten ? 26 : five ? 20 : 12, borderRadius: 1, backgroundColor: A.ink,
                  opacity: near.interpolate({ inputRange: [0, 1], outputRange: [ten ? 0.42 : five ? 0.3 : 0.16, 0.85] }),
                  transform: [{ scaleY: near.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }} />
                {five ? (
                  <Animated.View style={{ position: 'absolute', top: 50, width: 44, alignItems: 'center', opacity: near.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
                    transform: [{ scale: near.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }] }}>
                    <T size={12.5} weight="m" color={A.ink2}>{String(v)}</T>
                  </Animated.View>
                ) : null}
              </View>
            );
          })}
        </Animated.View>
      ) : null}
      <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 1.5, top: 8, width: 3, height: 40, borderRadius: 2, backgroundColor: A.copper }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: w / 2 - 5, top: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: A.copper, borderWidth: 2, borderColor: '#fff' }} />
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,1)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 70 }} />
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', 'rgba(255,255,255,1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 70 }} />
      <T size={11} color={A.ink3} style={{ position: 'absolute', right: 12, bottom: 6 }}>drag ↔</T>
    </View>
  );
}

// ----------------------------------------------------------------------------- motion
/** Gentle endless drift for floating 3D objects (ship, envelope, body). */
export function Floaty({ children, amp = 8, dur = 3200, rotate = 2, style }: { children: React.ReactNode; amp?: number; dur?: number; rotate?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(a, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={[style, { transform: [
      { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-amp, amp] }) },
      { rotate: a.interpolate({ inputRange: [0, 1], outputRange: [`${-rotate}deg`, `${rotate}deg`] }) },
    ] }]}>{children}</Animated.View>
  );
}

// ----------------------------------------------------------------------------- curved ruler
/**
 * Curved scale like the ring-app reference. It follows the finger continuously (no tick-to-tick jumps),
 * keeps gliding with momentum after release, stretches softly past the ends, then settles on the nearest step.
 * `onChange` fires with the snapped value; `onLive` with the continuous position (for linked animations).
 */
export function Ruler({ min, max, step, value, onChange, onLive, majorEvery, format, width = 340, dark }: {
  min: number; max: number; step: number; value: number; onChange: (v: number) => void; onLive?: (pos: number) => void;
  majorEvery: number; format?: (v: number) => string; width?: number; dark?: boolean;
}) {
  const H = 96, cx = width / 2, R = width * 1.15, y0 = 26, S = 22;
  const maxA = Math.asin((width / 2 - 6) / R);
  const pxPerUnit = (R * maxA) / S / step;
  const fmt = format ?? ((v: number) => String(v));
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const snap = (v: number) => +clamp(Math.round((v - min) / step) * step + min).toFixed(4);
  const rubber = (v: number) => (v < min ? min - (min - v) * 0.3 : v > max ? max + (v - max) * 0.3 : v);

  const [pos, setPos] = useState(value);
  const posRef = useRef(value);
  const lastSnap = useRef(value);
  const dragging = useRef(false);
  const gliding = useRef(false);
  const anim = useRef(new Animated.Value(value)).current;
  const cb = useRef({ onChange, onLive }); cb.current = { onChange, onLive };

  const apply = (v: number) => {
    posRef.current = v; setPos(v); cb.current.onLive?.(v);
    const s = snap(v);
    if (s !== lastSnap.current) { lastSnap.current = s; tick(); cb.current.onChange(s); }
    if (gliding.current && (v < min - step * 0.6 || v > max + step * 0.6)) anim.stopAnimation(); // hit the end while gliding
  };
  const settle = () => {
    gliding.current = false;
    Animated.spring(anim, { toValue: snap(posRef.current), useNativeDriver: false, speed: 10, bounciness: 5 }).start();
  };
  useEffect(() => { const id = anim.addListener(({ value: v }) => { if (!dragging.current) apply(v); }); return () => anim.removeListener(id); }, []);
  useEffect(() => { // value changed from outside (e.g. VoiceOver increment) → glide there
    if (dragging.current || gliding.current || value === lastSnap.current) return;
    lastSnap.current = value; anim.setValue(posRef.current);
    Animated.spring(anim, { toValue: value, useNativeDriver: false, speed: 10, bounciness: 4 }).start();
  }, [value]);

  const start = useRef(value);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { anim.stopAnimation(); gliding.current = false; dragging.current = true; start.current = posRef.current; },
    onPanResponderMove: (_, g) => apply(rubber(start.current - g.dx / pxPerUnit)),
    onPanResponderRelease: (_, g) => {
      dragging.current = false;
      anim.setValue(posRef.current);
      const v = -Math.max(-1.8, Math.min(1.8, g.vx)) / pxPerUnit; // units per ms, capped so a hard flick stays controllable
      const outside = posRef.current < min || posRef.current > max;
      if (Math.abs(g.vx) < 0.08 || outside) return settle();
      gliding.current = true;
      Animated.decay(anim, { velocity: v, deceleration: 0.994, useNativeDriver: false }).start(() => settle());
    },
    onPanResponderTerminate: () => { dragging.current = false; anim.setValue(posRef.current); settle(); },
  })).current;

  const pt = (off: number, r: number) => { const t = (off / S) * maxA; return [cx + r * Math.sin(t), y0 + R - r * Math.cos(t)]; };
  const ticks = [];
  const base = Math.floor((pos - min) / step);
  for (let j = -S - 1; j <= S + 1; j++) {
    const v = min + (base + j) * step;
    if (v < min - 1e-6 || v > max + 1e-6) continue;
    const off = (v - pos) / step;
    if (Math.abs(off) > S) continue;
    const major = Math.abs((v - min) / majorEvery - Math.round((v - min) / majorEvery)) < 1e-6;
    const near = Math.max(0, 1 - Math.abs(off) / 1.2); // ticks swell slightly as they pass the knob
    const [x1, y1] = pt(off, R + 6), [x2, y2] = pt(off, R + (major ? 22 : 14) + near * 6);
    const op = Math.max(0.06, 1 - Math.abs(off) / S);
    ticks.push(<Line key={v.toFixed(3)} x1={x1} y1={y1} x2={x2} y2={y2} stroke={near > 0.2 ? A.copper : dark ? '#fff' : A.ink} strokeOpacity={near > 0.2 ? 0.5 + near * 0.5 : op * (major ? 0.75 : 0.4)} strokeWidth={major ? 1.7 : 1.15} strokeLinecap="round" />);
  }
  const [ax, ay] = pt(-S, R), [bx, by] = pt(S, R);
  const ink = dark ? '#fff' : A.ink2;
  return (
    <View {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel="Value" accessibilityValue={{ text: fmt(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={e => onChange(snap(value + (e.nativeEvent.actionName === 'increment' ? step : -step)))}
      style={[{ width, height: H, alignSelf: 'center' }, Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none', touchAction: 'none' } as any) : null]}>
      <Svg width={width} height={H}>
        {ticks}
        <Path d={`M${ax} ${ay} A${R} ${R} 0 0 1 ${bx} ${by}`} stroke={dark ? '#fff' : A.ink} strokeOpacity={0.22} strokeWidth={1.4} fill="none" />
        <Circle cx={cx} cy={y0} r={15} fill={A.copper} opacity={0.12} />
        <Circle cx={cx} cy={y0} r={11} fill="#fff" stroke={A.copperSoft} strokeWidth={1} />
        <Circle cx={cx} cy={y0} r={4} fill={A.copper} />
        <SvgText x={ax + 4} y={ay + 22} fill={ink} fontSize={12.5} fontFamily={F.m}>{fmt(min)}</SvgText>
        <SvgText x={bx - 4} y={by + 22} fill={ink} fontSize={12.5} fontFamily={F.m} textAnchor="end">{fmt(max)}</SvgText>
      </Svg>
    </View>
  );
}

/** Big number that rolls softly when it changes (used under the ruler). */
export function RollingValue({ value, unit }: { value: string; unit: string }) {
  const a = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    a.setValue(0.82);
    Animated.timing(a, { toValue: 1, duration: 260, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [value]);
  return (
    <View style={{ alignItems: 'center' }} accessibilityLiveRegion="polite">
      <Animated.View style={{ opacity: a.interpolate({ inputRange: [0.82, 1], outputRange: [0.55, 1] }), transform: [{ translateY: a.interpolate({ inputRange: [0.82, 1], outputRange: [6, 0] }) }] }}>
        <T size={60} weight="m" color={A.ink} style={{ letterSpacing: -2.4, lineHeight: 64 }}>{value}</T>
      </Animated.View>
      <T size={13} color={A.ink2}>{unit}</T>
    </View>
  );
}
