/**
 * Copper Horizon components: cards, chips, steppers, list groups, buttons, status, skeletons, toasts and sheets.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleProp, View, ViewStyle, LayoutChangeEvent, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ELEV, K, MOTION, RAD, native, toneColor, web } from './tokens';
import { Kicker, Pressy, Txt, haptic, useLoop } from './core';
import { goBack } from './transition';

// ----------------------------------------------------------------------------- card
export function Card({ children, style, onPress, pad = 16, label, sunk, solid }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; pad?: number; label?: string; sunk?: boolean; solid?: boolean }) {
  const body = (
    <View style={[{ backgroundColor: sunk ? K.cardSunk : solid ? K.cardSolid : web ? 'rgba(255,253,251,0.9)' : K.card, borderRadius: RAD.m, padding: pad, borderWidth: 1, borderColor: K.hair },
      !sunk && ELEV.card, style]}>{children}</View>
  );
  return onPress ? <Pressy onPress={onPress} label={label} to={0.975}>{body}</Pressy> : body;
}

export function IconBubble({ icon: Icon, size = 36, color = K.copper, bg = K.copperTint, stroke = 1.7 }: { icon: any; size?: number; color?: string; bg?: string; stroke?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.47} color={color} strokeWidth={stroke} />
    </View>
  );
}

export function Dot({ tone, size = 7, pulse }: { tone?: string; size?: number; pulse?: boolean }) {
  const a = useLoop(1800, !!pulse);
  const c = toneColor(tone);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {pulse ? <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: c, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) }] }} /> : null}
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: c }} />
    </View>
  );
}

// ----------------------------------------------------------------------------- chips & tags
export function Tag({ label, onPress, tone, icon: Icon, dark }: { label: string; onPress?: () => void; tone?: string; icon?: any; dark?: boolean }) {
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, height: 28, borderRadius: 14, backgroundColor: dark ? 'rgba(255,255,255,0.14)' : K.cardSolid, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.22)' : K.hair2 }}>
      {tone ? <Dot tone={tone} size={6} /> : null}
      {Icon ? <Icon size={13} color={dark ? '#fff' : K.copper} strokeWidth={2} /> : null}
      <Txt v="caption" color={dark ? '#fff' : K.ink} style={{ fontFamily: 'Geist_500Medium' }}>{label}</Txt>
    </View>
  );
  return onPress ? <Pressy onPress={onPress} label={label}>{inner}</Pressy> : inner;
}

export function Chip({ label, on, onPress, icon: Icon, tone }: { label: string; on?: boolean; onPress?: () => void; icon?: any; tone?: string }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(a, { toValue: on ? 1 : 0, duration: 260, easing: MOTION.out, useNativeDriver: false }).start(); }, [on]);
  return (
    <Pressy onPress={onPress} label={label} role="tab" selected={on}>
      <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1,
        backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.7)', K.copper] }),
        borderColor: a.interpolate({ inputRange: [0, 1], outputRange: [K.hair2, K.copper] }) }}>
        {tone ? <Dot tone={tone} size={6} /> : null}
        {Icon ? <Icon size={14} color={on ? '#fff' : K.copper} strokeWidth={1.9} /> : null}
        <Txt v="subM" color={on ? '#fff' : K.ink}>{label}</Txt>
      </Animated.View>
    </Pressy>
  );
}
export function ChipRow({ children, gutter = 20 }: { children: React.ReactNode; gutter?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
      {children}
    </ScrollView>
  );
}

/** Pill segmented control with a sliding thumb. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string; icon?: any }[]; onChange: (k: T) => void }) {
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex(o => o.key === value));
  const x = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.spring(x, { toValue: idx, useNativeDriver: native, speed: 16, bounciness: 6 }).start(); }, [idx]);
  const seg = w / options.length;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 8)} style={{ flexDirection: 'row', backgroundColor: K.cardSunk, borderRadius: 18, padding: 4, borderWidth: 1, borderColor: K.hair }}>
      {w > 0 ? <Animated.View style={[{ position: 'absolute', top: 4, left: 4, bottom: 4, width: seg, borderRadius: 14, backgroundColor: K.cardSolid, transform: [{ translateX: Animated.multiply(x, seg) }] }, ELEV.card]} /> : null}
      {options.map(o => (
        <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: o.key === value }} onPress={() => { haptic.tap(); onChange(o.key); }} style={{ flex: 1, height: 34, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          {o.icon ? <o.icon size={14} color={o.key === value ? K.copper : K.ink2} /> : null}
          <Txt v="subM" color={o.key === value ? K.ink : K.ink2}>{o.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

// ----------------------------------------------------------------------------- stepper
/** ‹ label › control (date switcher, layer switcher). The label slides in the direction of travel. */
export function Stepper({ label, onPrev, onNext, prevDisabled, nextDisabled, style }: { label: string; onPrev: () => void; onNext: () => void; prevDisabled?: boolean; nextDisabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(1)).current;
  const dir = useRef(0);
  const prev = useRef(label);
  useEffect(() => {
    if (prev.current === label) return;
    prev.current = label;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 380, easing: MOTION.out, useNativeDriver: native }).start();
  }, [label]);
  const btn = (left: boolean, disabled?: boolean, on?: () => void) => (
    <Pressy onPress={() => { dir.current = left ? -1 : 1; on?.(); }} disabled={disabled} label={left ? 'Previous' : 'Next'} hitSlop={6}>
      <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? 'transparent' : K.copperTint, opacity: disabled ? 0.3 : 1 }}>
        {left ? <ChevronLeft size={17} color={K.ink} /> : <ChevronRight size={17} color={K.ink} />}
      </View>
    </Pressy>
  );
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: K.card, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: K.hair }, style]}>
      {btn(true, prevDisabled, onPrev)}
      <Animated.View accessibilityLiveRegion="polite" style={{ flex: 1, alignItems: 'center', opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [dir.current * 18, 0] }) }] }}>
        <Txt v="subM" numberOfLines={1}>{label}</Txt>
      </Animated.View>
      {btn(false, nextDisabled, onNext)}
    </View>
  );
}

// ----------------------------------------------------------------------------- top bar
export function TopBar({ title, back = true, right, onBack }: { title: string; back?: boolean; right?: React.ReactNode; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
      <Pressy label={back ? `Back · ${title}` : title} disabled={!back} hapticOn={back} onPress={() => (onBack ? onBack() : goBack('/today'))}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 8 }}>
          {back ? <ChevronLeft size={21} color={K.ink} strokeWidth={2} style={{ marginLeft: -6 }} /> : null}
          <Txt v="headline">{title}</Txt>
        </View>
      </Pressy>
      {right}
    </View>
  );
}

export function PageHead({ kicker, title, sub, style }: { kicker?: string; title: string; sub?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 18 }, style]}>
      {kicker ? <Kicker>{kicker}</Kicker> : null}
      <Txt v="display" style={{ marginTop: kicker ? 6 : 0 }}>{title}</Txt>
      {sub ? <Txt v="sub" color={K.ink2} style={{ marginTop: 6 }}>{sub}</Txt> : null}
    </View>
  );
}

export function SectionHead({ title, action, onAction, kicker }: { title: string; action?: string; onAction?: () => void; kicker?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 }}>
      <View>
        {kicker ? <Kicker style={{ marginBottom: 4 }}>{kicker}</Kicker> : null}
        <Txt v="title" style={{ fontSize: 19, lineHeight: 23 }}>{title}</Txt>
      </View>
      {action ? (
        <Pressy onPress={onAction} label={action}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Txt v="subM" color={K.copperInk}>{action}</Txt><ChevronRight size={15} color={K.copperInk} /></View>
        </Pressy>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------------------- lists
export function ListGroup({ kicker, children, style }: { kicker?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card pad={0} style={[{ overflow: 'hidden' }, style]}>
      {kicker ? <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}><Kicker color={K.ink2}>{kicker}</Kicker></View> : null}
      {items.map((c, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: 1, backgroundColor: K.hair, marginLeft: 64 }} /> : null}
          {c}
        </View>
      ))}
    </Card>
  );
}
export function ListRow({ icon, title, sub, right, onPress, danger, tone, current, chevron = true }: { icon?: any; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean; tone?: string; current?: boolean; chevron?: boolean }) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: current ? K.copperTint : 'transparent' }}>
      {icon ? <IconBubble icon={icon} size={38} color={danger ? K.flag : K.copper} bg={danger ? K.flagTint : current ? '#fff' : K.copperTint} /> : null}
      <View style={{ flex: 1 }}>
        <Txt v="bodyM" color={danger ? K.flag : K.ink} numberOfLines={1}>{title}</Txt>
        {sub ? <Txt v="caption" color={K.ink2} numberOfLines={2} style={{ marginTop: 1 }}>{sub}</Txt> : null}
      </View>
      {tone ? <Dot tone={tone} size={8} /> : null}
      {right}
      {onPress && chevron && !right ? <ChevronRight size={17} color={K.ink3} /> : null}
    </View>
  );
  return onPress ? <Pressy onPress={onPress} label={title} to={0.985}>{body}</Pressy> : body;
}

// ----------------------------------------------------------------------------- buttons
export function Button({ title, onPress, icon: Icon, kind = 'primary', loading, disabled, style, small }: { title: string; onPress?: () => void; icon?: any; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'light'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const h = small ? 42 : 52;
  const fg = kind === 'primary' || kind === 'danger' ? '#fff' : kind === 'light' ? '#fff' : K.ink;
  const content = loading ? <ActivityIndicator color={fg} /> : (
    <>
      {Icon ? <Icon size={small ? 15 : 17} color={fg} strokeWidth={2} /> : null}
      <Txt v="bodyM" color={fg} style={small ? { fontSize: 14 } : undefined}>{title}</Txt>
    </>
  );
  const base: ViewStyle = { height: h, borderRadius: h / 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20, overflow: 'hidden' };
  return (
    <View style={style}>
    <Pressy onPress={onPress} disabled={disabled || loading} label={title} style={{ opacity: disabled ? 0.45 : 1 }}>
      {kind === 'primary' ? (
        <View style={[{ borderRadius: h / 2 }, ELEV.copper]}>
          <LinearGradient colors={['#B4673F', '#8E4A2A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={base}>{content}</LinearGradient>
        </View>
      ) : (
        <View style={[base, kind === 'secondary' ? { backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair2 } : kind === 'danger' ? { backgroundColor: K.flag } : kind === 'light' ? { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' } : null]}>{content}</View>
      )}
    </Pressy>
    </View>
  );
}

export function RoundIcon({ icon: Icon, onPress, label, size = 44, kind = 'white' }: { icon: any; onPress?: () => void; label: string; size?: number; kind?: 'white' | 'copper' | 'ghost' }) {
  return (
    <Pressy onPress={onPress} label={label}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: kind === 'copper' ? K.copper : kind === 'ghost' ? 'transparent' : K.cardSolid, borderWidth: kind === 'white' ? 1 : 0, borderColor: K.hair2 }, kind !== 'ghost' && ELEV.card]}>
        <Icon size={size * 0.42} color={kind === 'copper' ? '#fff' : K.ink} strokeWidth={1.8} />
      </View>
    </Pressy>
  );
}

// ----------------------------------------------------------------------------- loading
/** Warm shimmer placeholder. */
export function Skeleton({ w = '100%', h = 16, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  const a = useLoop(1400);
  return (
    <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: 'rgba(227,183,158,0.28)', overflow: 'hidden' }, style]}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: '60%', transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-220, 420] }) }] }}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

// page-shaped loading skeletons live in ./skeletons
export { PageSkeleton, BootSkeleton, skeletonKind } from './skeletons';

// ----------------------------------------------------------------------------- toast
type ToastMsg = { id: number; text: string };
let pushToast: (t: string) => void = () => {};
export const toast = (text: string) => pushToast(text);
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    pushToast = text => {
      setMsg({ id: Date.now(), text });
      haptic.soft();
      a.setValue(0);
      Animated.sequence([
        Animated.spring(a, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 8 }),
        Animated.delay(2200),
        Animated.timing(a, { toValue: 0, duration: 260, useNativeDriver: native }),
      ]).start(({ finished }) => finished && setMsg(null));
    };
  }, []);
  if (!msg) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: insets.top + 10, left: 0, right: 0, alignItems: 'center', opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
      <View style={[{ backgroundColor: K.cocoa, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 11, maxWidth: 360 }, ELEV.float]}>
        <Txt v="subM" color="#fff" center>{msg.text}</Txt>
      </View>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------------- sheet
/** Bottom sheet with a dimmed backdrop and spring. Centred card on wide screens. */
export function Sheet({ open, onClose, title, kicker, children }: { open: boolean; onClose: () => void; title: string; kicker?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions(); // laptop template: never wider than the phone column
  const a = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); Animated.spring(a, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 4 }).start(); }
    else Animated.timing(a, { toValue: 0, duration: 220, easing: MOTION.in, useNativeDriver: native }).start(() => setMounted(false));
  }, [open]);
  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(43,30,24,0.35)', opacity: a }} />
      </Pressable>
      <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }}>
        <View style={[{ width: '100%', maxWidth: Math.min(520, winW), backgroundColor: '#FFFAF7', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: insets.bottom + 22 }, ELEV.float]}>
          <View style={{ alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: K.ink4, marginBottom: 14, marginTop: -8 }} />
          {kicker ? <Kicker>{kicker}</Kicker> : null}
          <Txt v="title" style={{ marginTop: 4, marginBottom: 12 }}>{title}</Txt>
          {children}
        </View>
      </Animated.View>
    </Modal>
  );
}

export function Notice({ tone = 'watch', title, body }: { tone?: string; title: string; body?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 16, backgroundColor: tone === 'flag' ? K.flagTint : tone === 'ok' ? K.okTint : K.watchTint }}>
      <View style={{ marginTop: 6 }}><Dot tone={tone} /></View>
      <View style={{ flex: 1 }}>
        <Txt v="subM">{title}</Txt>
        {body ? <Txt v="caption" color={K.ink2} style={{ marginTop: 2 }}>{body}</Txt> : null}
      </View>
    </View>
  );
}
