/**
 * Charts: sparkline, scrubbable line chart with baseline band, recovery gauge, GitHub-style frequency grid.
 * Everything draws in on focus (a left-to-right wipe) and responds to touch.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGrad, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { K, MOTION, toneColor } from './tokens';
import { Txt, haptic, useFocusTick, useInView, useTween } from './core';

/** Smooth path through points (Catmull-Rom → cubic Bézier). */
export function smooth(pts: [number, number][], t = 0.18) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Wipes its children in from the left whenever the screen gains focus. */
/** Draws a chart left → right the first time it scrolls into view. */
function Wipe({ width, height, children, delay = 120 }: { width: number; height: number; children: React.ReactNode; delay?: number }) {
  const tick = useFocusTick();
  const [ref, seen] = useInView();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!seen) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 1100, delay, easing: MOTION.out, useNativeDriver: false }).start();
  }, [tick, width, seen]);
  return (
    <View ref={ref} collapsable={false} style={{ width, height }}>
      <Animated.View style={{ width: a.interpolate({ inputRange: [0, 1], outputRange: [0, width] }), height, overflow: 'hidden' }}>
        <View style={{ width, height }}>{children}</View>
      </Animated.View>
    </View>
  );
}

const clean = (v: (number | null | undefined)[]) => v.map(x => (x == null || !Number.isFinite(x) ? null : x));

export function Spark({ values, w = 96, h = 26, color = K.copper, fill = true, dot = true }: { values: (number | null | undefined)[]; w?: number; h?: number; color?: string; fill?: boolean; dot?: boolean }) {
  const vals = clean(values);
  const nums = vals.filter((x): x is number => x != null);
  const id = useMemo(() => 'sp' + Math.random().toString(36).slice(2, 8), []);
  if (nums.length < 2) return <View style={{ width: w, height: h, justifyContent: 'center' }}><View style={{ height: 1, backgroundColor: K.hair2 }} /></View>;
  const lo = Math.min(...nums), hi = Math.max(...nums), span = hi - lo || 1;
  const pts: [number, number][] = [];
  vals.forEach((v, i) => { if (v != null) pts.push([3 + (i / (vals.length - 1)) * (w - 6), 3 + (1 - (v - lo) / span) * (h - 6)]); });
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  return (
    <Wipe width={w} height={h}>
      <Svg width={w} height={h}>
        <Defs>
          <SvgGrad id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.22} /><Stop offset="1" stopColor={color} stopOpacity={0} /></SvgGrad>
        </Defs>
        {fill ? <Path d={`${d} L${last[0]} ${h} L${pts[0][0]} ${h} Z`} fill={`url(#${id})`} /> : null}
        <Path d={d} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {dot ? <Circle cx={last[0]} cy={last[1]} r={2.4} fill={color} /> : null}
      </Svg>
    </Wipe>
  );
}

/**
 * Line chart with personal-baseline band and finger/mouse scrubbing.
 * `fmt` formats values for the bubble; `labels` sit under the first and last points.
 */
export function LineChart({ values, labels, band, height = 132, color = K.copper, fmt = v => String(Math.round(v)), onScrub }: {
  values: (number | null | undefined)[]; labels?: string[]; band?: [number, number]; height?: number; color?: string; fmt?: (v: number) => string; onScrub?: (i: number | null) => void;
}) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const vals = clean(values);
  const nums = vals.filter((x): x is number => x != null);
  const H = height, padY = 16, padX = 8;
  const lo = Math.min(...nums, band?.[0] ?? Infinity), hi = Math.max(...nums, band?.[1] ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => padX + (i / Math.max(1, vals.length - 1)) * (w - padX * 2);
  const y = (v: number) => padY + (1 - (v - (lo - span * 0.12)) / (span * 1.24)) * (H - padY * 2);
  const pts: [number, number][] = [];
  vals.forEach((v, i) => { if (v != null && w) pts.push([x(i), y(v)]); });
  const d = smooth(pts);
  const id = useMemo(() => 'lc' + Math.random().toString(36).slice(2, 8), []);
  const pick = (px: number) => {
    if (!w) return;
    const i = Math.max(0, Math.min(vals.length - 1, Math.round(((px - padX) / (w - padX * 2)) * (vals.length - 1))));
    if (i !== selRef.current) { selRef.current = i; haptic.tap(); setSel(i); onScrub?.(i); }
  };
  const selRef = useRef<number | null>(null);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: e => pickRef.current(e.nativeEvent.locationX),
    onPanResponderMove: e => pickRef.current(e.nativeEvent.locationX),
    onPanResponderRelease: () => { selRef.current = null; setTimeout(() => { setSel(null); onScrub?.(null); }, 900); },
    onPanResponderTerminate: () => { selRef.current = null; setSel(null); onScrub?.(null); },
  })).current;
  const pickRef = useRef(pick); pickRef.current = pick;
  const show = sel ?? (vals.length ? vals.length - 1 : null);
  const sv = show != null ? vals[show] : null;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height: H + 20 }}>
      {w > 0 && pts.length > 1 ? (
        <View {...pan.panHandlers} style={{ height: H }} {...({ onMouseMove: (e: any) => pickRef.current(e.nativeEvent.offsetX ?? e.nativeEvent.locationX), onMouseLeave: () => { selRef.current = null; setSel(null); onScrub?.(null); } } as any)}>
          <Svg width={w} height={H} style={{ position: 'absolute' }}>
            {band ? <Rect x={0} y={y(band[1])} width={w} height={Math.max(2, y(band[0]) - y(band[1]))} fill={K.copperTint} opacity={0.7} rx={6} /> : null}
            {[0.25, 0.5, 0.75].map(f => <Line key={f} x1={0} x2={w} y1={H * f} y2={H * f} stroke={K.hair} strokeDasharray="2 5" />)}
          </Svg>
          <Wipe width={w} height={H}>
            <Svg width={w} height={H}>
              <Defs><SvgGrad id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity={0.2} /><Stop offset="1" stopColor={color} stopOpacity={0} /></SvgGrad></Defs>
              <Path d={`${d} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z`} fill={`url(#${id})`} />
              <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Wipe>
          {show != null && sv != null ? (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: H }}>
              <Svg width={w} height={H} style={{ position: 'absolute' }}>
                {sel != null ? <Line x1={x(show)} x2={x(show)} y1={6} y2={H} stroke={K.copper} strokeOpacity={0.35} strokeDasharray="3 3" /> : null}
                <Circle cx={x(show)} cy={y(sv)} r={7} fill={color} opacity={0.18} />
                <Circle cx={x(show)} cy={y(sv)} r={3.6} fill="#fff" stroke={color} strokeWidth={2} />
              </Svg>
              {sel != null ? (
                <View style={{ position: 'absolute', top: Math.max(0, y(sv) - 38), left: Math.min(w - 92, Math.max(0, x(show) - 46)), width: 92, alignItems: 'center' }}>
                  <View style={{ backgroundColor: K.cocoa, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Txt v="caption" color="#fff" tabular style={{ fontFamily: 'Geist_600SemiBold' }}>{fmt(sv)}{labels?.[show] ? ` · ${labels[show]}` : ''}</Txt>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : <View style={{ height: H }} />}
      {labels?.length ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          {labels.map((l, i) => {
            const every = Math.ceil(labels.length / 7);
            const show = i % every === 0 || i === labels.length - 1;
            return <Txt key={i} v="mono" color={K.ink3} center style={{ fontSize: 9.5, width: 34, marginHorizontal: -8, opacity: show ? 1 : 0 }}>{l.replace(/^[A-Za-z]{3} /, '')}</Txt>;
          })}
        </View>
      ) : null}
    </View>
  );
}

/** Recovery gauge: a 240° arc that sweeps to the value with tick marks; colour follows the score. */
export function Gauge({ value, size = 210, label = 'Recovery', sub }: { value: number | null; size?: number; label?: string; sub?: string }) {
  const v = useTween(value ?? 0, 1300);
  const r = size / 2 - 14, cx = size / 2, cy = size / 2 + 6;
  const a0 = (-210 * Math.PI) / 180, a1 = (30 * Math.PI) / 180;
  const at = (f: number, rr = r) => { const a = a0 + (a1 - a0) * f; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
  const arc = (f: number) => { const [sx, sy] = at(0), [ex, ey] = at(Math.max(0.0001, f)); return `M${sx} ${sy} A${r} ${r} 0 ${f * 240 > 180 ? 1 : 0} 1 ${ex} ${ey}`; };
  const tone = (value ?? 0) >= 67 ? K.ok : (value ?? 0) >= 34 ? K.copper : K.flag;
  const f = v / 100;
  const [kx, ky] = at(f);
  return (
    <View style={{ width: size, height: size * 0.78, alignItems: 'center' }}>
      <Svg width={size} height={size * 0.78}>
        <Defs><SvgGrad id="gg" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={K.copperSoft} /><Stop offset="1" stopColor={tone} /></SvgGrad></Defs>
        {Array.from({ length: 41 }, (_, i) => { const [x1, y1] = at(i / 40, r + 9), [x2, y2] = at(i / 40, r + (i % 5 ? 12 : 15)); return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i / 40 <= f ? K.copper : K.ink4} strokeOpacity={i / 40 <= f ? 0.6 : 0.5} strokeWidth={1} />; })}
        <Path d={arc(1)} stroke={K.copperTint} strokeWidth={12} fill="none" strokeLinecap="round" />
        <Path d={arc(f)} stroke="url(#gg)" strokeWidth={12} fill="none" strokeLinecap="round" />
        <Circle cx={kx} cy={ky} r={8.5} fill="#fff" stroke={tone} strokeWidth={2.5} />
      </Svg>
      <View style={{ position: 'absolute', top: size * 0.27, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Txt v="hero" tabular style={{ fontSize: 46, lineHeight: 50 }}>{value == null ? '—' : Math.round(v)}</Txt>
          {value != null ? <Txt v="headline" color={K.ink2} style={{ marginTop: 6 }}>%</Txt> : null}
        </View>
        <Txt v="caption" color={K.ink2}>{label}</Txt>
        {sub ? <Txt v="mono" color={K.ink3} style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
    </View>
  );
}

/** Workout frequency grid: weeks as rows, days as columns, intensity by count. Cells pop in with a wave. */
export function HeatGrid({ weeks, onPick, compact }: { weeks: number[][]; onPick?: (w: number, d: number) => void; compact?: boolean }) {
  const tick = useFocusTick();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { a.setValue(0); Animated.timing(a, { toValue: 1, duration: 1100, delay: 150, easing: MOTION.out, useNativeDriver: true }).start(); }, [tick]);
  const shade = (n: number) => (n <= 0 ? 'rgba(227,183,158,0.25)' : n === 1 ? '#E9B795' : n === 2 ? '#C98257' : '#8E4A2A');
  const total = weeks.length * 7;
  return (
    <View style={{ gap: compact ? 3 : 4 }}>
      {weeks.map((row, wi) => (
        <View key={wi} style={{ flexDirection: 'row', gap: compact ? 3 : 4 }}>
          {row.map((n, di) => {
            const k = (wi * 7 + di) / total;
            return (
              <Animated.View key={di} style={{ flex: 1, ...(compact ? { height: 8, borderRadius: 2.5 } : { aspectRatio: 2.3, borderRadius: 4 }), backgroundColor: shade(n),
                opacity: a.interpolate({ inputRange: [Math.max(0, k - 0.15), Math.min(1, k + 0.25)], outputRange: [0, 1], extrapolate: 'clamp' }),
                transform: [{ scale: a.interpolate({ inputRange: [Math.max(0, k - 0.15), Math.min(1, k + 0.25)], outputRange: [0.4, 1], extrapolate: 'clamp' }) }] }}
                onTouchEnd={() => onPick?.(wi, di)} />
            );
          })}
        </View>
      ))}
      {compact ? null : <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Txt v="mono" color={K.ink3}>0 sessions</Txt>
        <View style={{ flexDirection: 'row', gap: 4 }}>{[0, 1, 2, 3].map(n => <View key={n} style={{ width: 12, height: 8, borderRadius: 3, backgroundColor: shade(n) }} />)}</View>
        <Txt v="mono" color={K.ink3}>3+</Txt>
      </View>}
    </View>
  );
}

/** Thin progress bar that eases to its value. */
export function Progress({ value, color = K.copper, height = 4, track = 'rgba(184,105,63,0.14)' }: { value: number; color?: string; height?: number; track?: string }) {
  const a = useRef(new Animated.Value(value)).current;
  useEffect(() => { Animated.timing(a, { toValue: value, duration: 500, easing: MOTION.out, useNativeDriver: false }).start(); }, [value]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }} />
    </View>
  );
}

export { G, toneColor };

/** Tappable bar chart (SVG). One bar per item; the selected bar is highlighted. */
export function BarChart({ items, height = 120, max = 100, onPick, selected }: { items: { key: string; label: string; value: number; color?: string }[]; height?: number; max?: number; onPick?: (key: string) => void; selected?: string | null }) {
  const n = Math.max(1, items.length), W = 320, gap = 10, bw = Math.min(46, (W - gap * (n + 1)) / n);
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="xMidYMid meet">
        {[0.25, 0.5, 0.75].map(g => <Line key={g} x1={0} x2={W} y1={height - 18 - (height - 30) * g} y2={height - 18 - (height - 30) * g} stroke={K.hair} strokeWidth={1} />)}
        {items.map((it, i) => {
          const x = gap + i * (bw + gap) + (W - gap * (n + 1) - bw * n) / 2, h = Math.max(3, ((height - 30) * Math.min(max, it.value)) / max), on = selected === it.key;
          return (
            <G key={it.key} onPress={() => onPick?.(it.key)}>
              <Rect x={x} y={height - 18 - h} width={bw} height={h} rx={8} fill={it.color ?? K.copper} opacity={selected && !on ? 0.35 : 1} />
              <SvgText x={x + bw / 2} y={height - 18 - h - 4} fontSize={10} fill={K.ink2} textAnchor="middle">{Math.round(it.value)}</SvgText>
              <SvgText x={x + bw / 2} y={height - 4} fontSize={10} fill={on ? K.ink : K.ink3} textAnchor="middle">{it.label.slice(0, 7)}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
