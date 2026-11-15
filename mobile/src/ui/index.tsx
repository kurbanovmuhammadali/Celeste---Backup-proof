import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps,
  TextProps, TextStyle, useWindowDimensions, View, ViewStyle, StyleProp, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, G, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { Check, ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { C, F, R, shadow, statusColor, statusWord } from '../theme';
import { Backdrop } from '../kit/page';

// ----------------------------------------------------------------------------- text
type TP = TextProps & { size?: number; weight?: keyof typeof F; color?: string; center?: boolean; style?: StyleProp<TextStyle> };
export function T({ size = 15, weight = 'r', color = C.ink, center, style, ...p }: TP) {
  const tight = size >= 28 ? -size * 0.045 : size >= 20 ? -0.4 : -0.1;
  return <Text {...p} style={[{ fontFamily: F[weight], fontSize: size, color, letterSpacing: tight, lineHeight: size >= 40 ? size * 1.0 : size * 1.32 }, center && { textAlign: 'center' }, style]} />;
}

// ----------------------------------------------------------------------------- layout
export const useWide = () => useWindowDimensions().width >= 900;

export function Screen({ children, scroll = true, bg = 'light', pad = true, bottomSpace = 120 }: { children: React.ReactNode; scroll?: boolean; bg?: 'light' | 'bronze'; pad?: boolean; bottomSpace?: number }) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={[{ width: '100%', maxWidth: 1040, alignSelf: 'center', paddingTop: insets.top + 12 }, pad && { paddingHorizontal: 20 }]}>
      {children}
      <View style={{ height: bottomSpace + insets.bottom }} />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {bg === 'bronze'
        ? <LinearGradient colors={C.bronze} locations={[0, 0.35, 0.72, 1]} style={StyleSheet.absoluteFill} />
        : <Backdrop />}
      {scroll ? <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{inner}</ScrollView> : inner}
    </View>
  );
}

export function Card({ children, style, onPress, tint }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tint?: string }) {
  const body = <View style={[s.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>;
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }] }]}>{body}</Pressable>;
}

export function Row({ children, gap = 12, style, wrap }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', gap, alignItems: 'center' }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

/** Responsive grid: 2 columns on phones, `wide` columns on desktop web. */
export function Grid({ children, wide = 4, gap = 12 }: { children: React.ReactNode; wide?: number; gap?: number }) {
  const w = useWide();
  const cols = w ? wide : 2;
  const items = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {items.map((c, i) => <View key={i} style={{ width: `${100 / cols}%`, padding: gap / 2 }}>{c}</View>)}
    </View>
  );
}

export function Header({ title, back, right, sub }: { title: string; back?: boolean; right?: React.ReactNode; sub?: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Row style={{ justifyContent: 'space-between', minHeight: 48 }}>
        {back ? <IconBtn onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}><ChevronLeft size={20} color={C.ink} /></IconBtn> : <View style={{ width: 48 }} />}
        <T size={17} weight="m" center style={{ flex: 1 }}>{title}</T>
        {right ?? <View style={{ width: 48 }} />}
      </Row>
      {sub ? <T size={13} color={C.ink3} center style={{ marginTop: 2 }}>{sub}</T> : null}
    </View>
  );
}

export function IconBtn({ children, onPress, dark, label }: { children: React.ReactNode; onPress?: () => void; dark?: boolean; label?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.iconBtn, dark && { backgroundColor: C.ink }, { opacity: pressed ? 0.7 : 1 }]}>
      {children}
    </Pressable>
  );
}

// ----------------------------------------------------------------------------- controls
export function Button({ title, onPress, kind = 'dark', loading, disabled, icon, style }: { title: string; onPress?: () => void; kind?: 'dark' | 'coral' | 'light' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const bg = { dark: C.ink, coral: C.coral, light: '#FFFFFF', ghost: 'transparent', danger: C.redTint }[kind];
  const fg = { dark: '#fff', coral: '#fff', light: C.ink, ghost: C.ink, danger: C.red }[kind];
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.985 : 1 }] }, kind === 'light' && shadow, kind === 'ghost' && { borderWidth: 1, borderColor: C.line }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Row gap={8}>{icon}<T size={16} weight="m" color={fg}>{title}</T></Row>}
    </Pressable>
  );
}

export function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string | null }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <T size={13} weight="m" color={C.ink2} style={{ marginBottom: 6, marginLeft: 4 }}>{label}</T>
      <TextInput placeholderTextColor={C.ink3} {...p} onFocus={e => { setFocus(true); p.onFocus?.(e); }} onBlur={e => { setFocus(false); p.onBlur?.(e); }}
        style={[s.input, focus && { borderColor: C.ink }, error ? { borderColor: C.red } : null, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any), p.style]} />
      {error ? <T size={12} color={C.red} style={{ marginTop: 4, marginLeft: 4 }}>{error}</T> : null}
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 }}>
      <View style={[s.check, checked && { backgroundColor: C.ink, borderColor: C.ink }]}>{checked ? <Check size={14} color="#fff" strokeWidth={3} /> : null}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

export function Segmented<K extends string>({ value, options, onChange, dark }: { value: K; options: { key: K; label: string }[]; onChange: (k: K) => void; dark?: boolean }) {
  return (
    <Row gap={4} style={{ alignSelf: 'center', padding: 4, borderRadius: R.pill }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: R.pill }, on && { backgroundColor: dark ? C.ink : '#fff' }, on && !dark && shadow]}>
            <T size={14} weight={on ? 'm' : 'r'} color={on ? (dark ? '#fff' : C.ink) : C.ink2}>{o.label}</T>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Chip({ label, on, onPress, color }: { label: string; on?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: color ?? C.ink, borderColor: color ?? C.ink }]}>
      <T size={13} weight="m" color={on ? '#fff' : C.ink2}>{label}</T>
    </Pressable>
  );
}

export function StatusDot({ status, label = true, size = 12 }: { status?: string; label?: boolean; size?: number }) {
  return (
    <Row gap={5}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor(status) }} />
      {label ? <T size={size} color={C.ink2}>{statusWord(status)}</T> : null}
    </Row>
  );
}

export function Big({ value, unit, size = 64, color = C.ink }: { value: string | number | null | undefined; unit?: string; size?: number; color?: string }) {
  return (
    <Row gap={4} style={{ alignItems: 'flex-end' }}>
      <T size={size} weight="m" color={color}>{value ?? '—'}</T>
      {unit ? <T size={Math.max(13, size * 0.28)} color={C.ink3} style={{ marginBottom: size * 0.08 }}>{unit}</T> : null}
    </Row>
  );
}

export function Notice({ kind = 'amber', title, body, action }: { kind?: 'amber' | 'red' | 'green' | 'info'; title: string; body?: string; action?: React.ReactNode }) {
  const tint = kind === 'red' ? C.redTint : kind === 'green' ? C.greenTint : kind === 'info' ? C.soft : C.amberTint;
  const dot = kind === 'red' ? C.red : kind === 'green' ? C.green : kind === 'info' ? C.ink3 : C.amber;
  return (
    <View style={{ backgroundColor: tint, borderRadius: 20, padding: 16, marginBottom: 10 }}>
      <Row gap={8}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /><T size={15} weight="sb" style={{ flex: 1 }}>{title}</T></Row>
      {body ? <T size={13} color={C.ink2} style={{ marginTop: 6 }}>{body}</T> : null}
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return <View style={{ padding: 60, alignItems: 'center' }}><ActivityIndicator color={C.coral} /></View>;
}

export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(); }, []);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{children}</Animated.View>;
}

// ----------------------------------------------------------------------------- brand
export function Logo({ color = C.ink, size = 22 }: { color?: string; size?: number }) {
  return (
    <Row gap={8}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path fill="#B8693F" d="M12 1.5C12.9 8 16 11.1 22.5 12 16 12.9 12.9 16 12 22.5 11.1 16 8 12.9 1.5 12 8 11.1 11.1 8 12 1.5Z" />
      </Svg>
      <T size={size * 0.95} weight="sb" color={color} style={{ letterSpacing: 1.2 }}>CELESTE</T>
    </Row>
  );
}

// ----------------------------------------------------------------------------- charts
/** Dot-matrix column chart — the signature visual from the reference "Stats" screen. */
export function DotMatrix({ values, rows = 14, height = 260, highlight, labels }: { values: (number | null)[]; rows?: number; height?: number; highlight?: number; labels?: string[] }) {
  const [w, setW] = useState(0);
  const valid = values.filter((v): v is number => v != null);
  const max = Math.max(...valid, 1), min = Math.min(...valid, 0);
  const cols = values.length;
  const gap = 5;
  const cell = w ? Math.min((w - gap * (cols - 1)) / cols, (height - gap * (rows - 1)) / rows) : 0;
  const totalW = cols * cell + (cols - 1) * gap;
  const lo = min * 0.8;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: height + (labels ? 22 : 0) }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          <G x={(w - totalW) / 2}>
            {values.map((v, c) => {
              const lit = v == null ? 0 : Math.max(1, Math.round(((v - lo) / (max - lo || 1)) * rows));
              const isH = highlight === c;
              return Array.from({ length: rows }, (_, r) => {
                const on = rows - r <= lit;
                const fade = on ? 0.45 + 0.55 * ((rows - r) / lit) ** 0.6 : 0;
                return <Rect key={`${c}-${r}`} x={c * (cell + gap)} y={r * (cell + gap)} width={cell} height={cell} rx={cell * 0.28}
                  fill={on ? C.coral : C.coralTint} opacity={on ? (isH ? 1 : Math.min(1, fade)) : 0.55} />;
              });
            })}
          </G>
        </Svg>
      )}
      {labels && w > 0 && (
        <View style={{ flexDirection: 'row', width: totalW, alignSelf: 'center', marginTop: 6 }}>
          {labels.map((l, i) => <T key={i} size={10} color={i === highlight ? C.ink : C.ink3} center style={{ width: cell + (i < labels.length - 1 ? gap : 0) }}>{l}</T>)}
        </View>
      )}
    </View>
  );
}

/** ECG-like sparkline. */
export function Sparkline({ values, height = 52, color = C.coral, pulse }: { values: (number | null)[]; height?: number; color?: string; pulse?: boolean }) {
  const [w, setW] = useState(0);
  const v = values.filter((x): x is number => x != null);
  let d = '';
  if (w && v.length > 1) {
    const max = Math.max(...v), min = Math.min(...v), span = max - min || 1;
    const pts = v.map((y, i) => [(i / (v.length - 1)) * w, height - 6 - ((y - min) / span) * (height - 12)]);
    if (pulse) {
      d = pts.map(([x, y], i) => {
        if (i === 0) return `M${x},${y}`;
        const [px] = pts[i - 1]; const mid = (px + x) / 2;
        return `L${mid - 4},${y} L${mid - 1},${Math.max(2, y - 18)} L${mid + 2},${Math.min(height - 2, y + 12)} L${mid + 5},${y} L${x},${y}`;
      }).join(' ');
    } else d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  }
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && <Svg width={w} height={height}><Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" /></Svg>}
    </View>
  );
}

/** Dotted vertical bars like the reference "Oxygen" tile. */
export function DotBars({ values, height = 52, color = C.coral }: { values: (number | null)[]; height?: number; color?: string }) {
  const [w, setW] = useState(0);
  const v = values.map(x => x ?? 0);
  const max = Math.max(...v, 1), min = Math.min(...v.filter(Boolean), max);
  const n = v.length || 1;
  const step = w / n;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height }}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {v.map((y, i) => {
            const frac = 0.25 + 0.75 * ((y - min) / (max - min || 1));
            const len = frac * (height - 8);
            const x = i * step + step / 2;
            return (
              <G key={i}>
                <Line x1={x} y1={height - 4} x2={x} y2={height - 4 - len} stroke={color} strokeWidth={5} strokeLinecap="round" />
                <Circle cx={x} cy={height - 4 - len - 9} r={2.6} fill={color} opacity={0.6} />
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Half-circle tick dial with draggable knob (mood check-in) — inspired by the reference onboarding. */
export function Dial({ value, onChange, size = 320, light, min = 0, max = 100 }: { value: number; onChange?: (v: number) => void; size?: number; light?: boolean; min?: number; max?: number }) {
  const h = size * 0.5;
  const cx = size / 2, cy = h + 6, r = size * 0.44;
  const frac = (value - min) / (max - min);
  const ang = Math.PI * (1 - frac);
  const kx = cx + r * Math.cos(ang), ky = cy - r * Math.sin(ang);
  const layout = useRef({ x: 0, y: 0 });
  const ref = useRef<View>(null);
  const fromTouch = (px: number, py: number) => {
    const dx = px - cx, dy = cy - py;
    let a = Math.atan2(dy, dx);
    if (a < 0) a = dx > 0 ? 0 : Math.PI;
    const v = Math.round(min + (1 - a / Math.PI) * (max - min));
    onChange?.(Math.max(min, Math.min(max, v)));
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => fromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
    onPanResponderMove: e => fromTouch(e.nativeEvent.locationX, e.nativeEvent.locationY),
  })).current;
  const tickColor = light ? 'rgba(255,255,255,0.85)' : C.ink2;
  const ticks = 61;
  return (
    <View ref={ref} onLayout={e => (layout.current = e.nativeEvent.layout)} style={{ width: size, height: h + 18, alignSelf: 'center' }} {...(onChange ? pan.panHandlers : {})}>
      <Svg width={size} height={h + 18} pointerEvents="none">
        <Defs>
          <SvgGrad id="arc" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={light ? '#fff' : C.ink} stopOpacity={0.15} />
            <Stop offset="0.5" stopColor={light ? '#fff' : C.ink} stopOpacity={0.9} />
            <Stop offset="1" stopColor={light ? '#fff' : C.ink} stopOpacity={0.15} />
          </SvgGrad>
        </Defs>
        {Array.from({ length: ticks }, (_, i) => {
          const a = Math.PI * (1 - i / (ticks - 1));
          const long = i % 5 === 0;
          const r1 = r + 14, r2 = r + (long ? 30 : 23);
          const near = Math.abs(i / (ticks - 1) - frac) < 0.09;
          return <Line key={i} x1={cx + r1 * Math.cos(a)} y1={cy - r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy - r2 * Math.sin(a)} stroke={tickColor} strokeWidth={near ? 1.8 : 1} opacity={near ? 1 : 0.45} />;
        })}
        <Path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="url(#arc)" strokeWidth={1.4} fill="none" />
        <Circle cx={kx} cy={ky} r={11} fill={light ? '#fff' : C.ink} opacity={0.25} />
        <Circle cx={kx} cy={ky} r={6.5} fill={light ? '#fff' : C.ink} />
      </Svg>
    </View>
  );
}

/** Thin progress ring. */
export function RingProgress({ value, size = 64, stroke = 6, color = C.coral, children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.coralTint} strokeWidth={stroke} fill="none" />
        {value > 0.005 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={`${c * Math.min(1, value)} ${c}`} strokeLinecap="round" /> : null}
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 18, ...(shadow as object) },
  iconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...(shadow as object) },
  btn: { height: 56, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  input: { height: 54, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 18, fontFamily: F.r, fontSize: 16, color: C.ink },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.ink3, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff' },
});
