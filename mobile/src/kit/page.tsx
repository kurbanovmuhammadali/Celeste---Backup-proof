/**
 * Page shell for every crew screen: warm living background, safe areas, focus-replayed staggered entrance,
 * a compact blurred title bar that fades in on scroll, and responsive widths (phone → desktop web).
 */
import React, { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { Animated, RefreshControl, StyleProp, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { K, native } from './tokens';
import { usePageMotion } from './pageMotion';
import { FocusReplay, Rise, ScrollBus, Txt, makeScrollBus, useLayout, useLoop } from './core';
import { Sidebar } from './sidebar';

function Glow({ size, color, opacity }: { size: number; color: string; opacity: number }) {
  const id = React.useMemo(() => 'g' + Math.random().toString(36).slice(2, 7), []);
  return (
    <Svg width={size} height={size}>
      <Defs><RadialGradient id={id} cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor={color} stopOpacity={opacity} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

/** Warm canvas with two slowly drifting copper glows. */
export function Backdrop({ dim }: { dim?: boolean }) {
  const a = useLoop(18000);
  const drift = (x: number, y: number) => [
    { translateX: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, x, 0] }) },
    { translateY: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, y, 0] }) },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <LinearGradient colors={[K.canvasTop, K.canvas, K.canvasBottom]} locations={[0, 0.5, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Animated.View style={{ position: 'absolute', top: -220, right: -220, transform: drift(-50, 40) }}><Glow size={620} color="#EDB896" opacity={dim ? 0.35 : 0.55} /></Animated.View>
      <Animated.View style={{ position: 'absolute', bottom: -260, left: -240, transform: drift(60, -40) }}><Glow size={680} color="#EBBFA4" opacity={dim ? 0.3 : 0.5} /></Animated.View>
    </View>
  );
}

type PageProps = {
  children: React.ReactNode;
  /** Compact title shown in the blurred bar once the page scrolls. */
  title?: string;
  /** Fixed header row (e.g. TopBar) above the scroll content. */
  header?: React.ReactNode;
  /** Pinned footer (primary action). */
  footer?: React.ReactNode;
  tabs?: boolean;
  maxWidth?: number;
  stagger?: boolean;
  scroll?: boolean;
  onRefresh?: () => Promise<void> | void;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Page({ children, title, header, footer, tabs, maxWidth = 1180, stagger = true, scroll = true, onRefresh, contentStyle }: PageProps) {
  const insets = useSafeAreaInsets();
  const { gutter, sidebar } = useLayout();
  const y = useRef(new Animated.Value(0)).current;
  const bus = useRef(makeScrollBus()).current;
  const scrollRef = useRef<any>(null);
  // page-level motion (web): see ./transition and ./pageMotion
  const motion = usePageMotion({ tabs, onBlur: () => { try { scrollRef.current?.scrollTo({ y: 0, animated: false }); } catch {} } });
  const [refreshing, setRefreshing] = React.useState(false);
  const bottom = (tabs && !sidebar ? 110 : 32) + insets.bottom + (footer ? 84 : 0);
  const top = insets.top + (sidebar ? 26 : 10);
  const kids = React.Children.toArray(children).filter(Boolean);
  const body = stagger ? kids.map((c, i) => <Rise key={i} i={i}>{c}</Rise>) : kids;
  const wrap: ViewStyle = { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: gutter };

  const page = (
      <View style={{ flex: 1, backgroundColor: K.canvas }}>
        <Backdrop />
        {header ? <View style={[wrap, { paddingTop: top, paddingBottom: 6, zIndex: 3 }]}><Rise from={8}>{header}</Rise></View> : null}
        {scroll ? (
          <Animated.ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], { useNativeDriver: native, listener: bus.emit })}
            refreshControl={onRefresh ? <RefreshControl tintColor={K.copper} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }} /> : undefined}
            contentContainerStyle={[wrap, { paddingTop: header ? 4 : top, paddingBottom: bottom }, contentStyle]}>
            {body}
          </Animated.ScrollView>
        ) : <View style={[wrap, { flex: 1, paddingTop: header ? 4 : top, paddingBottom: bottom }, contentStyle]}>{body}</View>}

        {title && !header ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + 44, opacity: y.interpolate({ inputRange: [40, 90], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
            <BlurView intensity={70} tint="light" style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: K.hair }}>
              <Txt v="subM">{title}</Txt>
            </BlurView>
          </Animated.View>
        ) : null}

        {tabs && !sidebar && !footer ? (
          <LinearGradient pointerEvents="none" colors={['rgba(247,238,232,0)', 'rgba(247,238,232,0.92)', K.canvas]} locations={[0, 0.45, 1]}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 + insets.bottom }} />
        ) : null}

        {footer ? (
          <>
          <LinearGradient pointerEvents="none" colors={['rgba(247,238,232,0)', 'rgba(244,229,220,0.92)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: (tabs && !sidebar ? 190 : 110) + insets.bottom }} />
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: (tabs && !sidebar ? 96 : 18) + insets.bottom, alignItems: 'center' }}>
            <Rise from={30} delay={200} style={{ width: '100%', maxWidth: Math.min(maxWidth, 560), paddingHorizontal: gutter }}>{footer}</Rise>
          </View>
          </>
        ) : null}
      </View>
  );
  const moving = <Animated.View style={[motion.style, { backgroundColor: K.canvas }]}>{page}</Animated.View>;
  // laptop website: pushed pages (radiation, report, briefing…) keep the left rail like the tab screens
  return (
    <FocusReplay>
      <ScrollBus.Provider value={bus}>
        {sidebar && !tabs ? <View style={{ flex: 1, flexDirection: 'row', backgroundColor: K.canvas }}><Sidebar /><View style={{ flex: 1, overflow: 'hidden' }}>{moving}</View></View> : moving}
      </ScrollBus.Provider>
    </FocusReplay>
  );
}

/** Two columns on wide screens, stacked on phones. */
export function Cols({ children, gap = 20, ratio = [1, 1], style }: { children: React.ReactNode; gap?: number; ratio?: [number, number]; style?: StyleProp<ViewStyle> }) {
  const { wide } = useLayout();
  const [a, b] = React.Children.toArray(children);
  if (!wide) return <View style={style}>{a}{b}</View>;
  return (
    <View style={[{ flexDirection: 'row', gap, alignItems: 'flex-start' }, style]}>
      <View style={{ flex: ratio[0], minWidth: 0 }}>{a}</View>
      <View style={{ flex: ratio[1], minWidth: 0 }}>{b}</View>
    </View>
  );
}
