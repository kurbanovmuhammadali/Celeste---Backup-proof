import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, View } from 'react-native';
import { Redirect, Tabs, router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { House, Orbit, ClipboardCheck, PersonStanding, User, Sparkles, Radiation, FileHeart, Siren } from 'lucide-react-native';
import { useAuth } from '@/auth';
import { AstraLogo } from '@/astra';
import { ELEV, K, native } from '@/kit/tokens';
import { Kicker, Pressy, Txt, haptic, useLayout } from '@/kit/core';
import { Backdrop } from '@/kit/page';
import { Dot, PageSkeleton, skeletonKind } from '@/kit/ui';
import { Sidebar, TABS } from '@/kit/sidebar';
import { leaveTab } from '@/kit/transition';
import Syncs from '@/kit/Syncs';



function TabIcon({ icon: Icon, on }: { icon: any; on: boolean }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.spring(a, { toValue: on ? 1 : 0, useNativeDriver: native, speed: 16, bounciness: 12 }).start(); }, [on]);
  return (
    <Animated.View style={{ transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
      <Icon size={20} color={on ? '#fff' : K.ink2} strokeWidth={on ? 2 : 1.7} />
    </Animated.View>
  );
}

/** Floating dock: a copper bubble glides to the active tab and the icon pops. */
function Dock({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const routes = state.routes.filter((r: any) => TABS.some(t => t.name === r.name));
  const current = Math.max(0, routes.findIndex((r: any) => r.key === state.routes[state.index]?.key));
  // the bubble moves the moment you tap, while the old tab plays its exit (src/kit/transition.ts)
  const [going, setGoing] = useState<number | null>(null);
  const busy = useRef(false);
  useEffect(() => { setGoing(null); }, [current]);
  const active = going ?? current;
  const go = async (i: number, name: string) => {
    if (busy.current || i === current) return;
    busy.current = true; setGoing(i);
    try { await leaveTab(state.routes[state.index]?.name, name); navigation.navigate(name); } finally { busy.current = false; }
  };
  const x = useRef(new Animated.Value(active)).current;
  const squish = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(x, { toValue: active, useNativeDriver: native, speed: 14, bounciness: 7 }),
      Animated.sequence([
        Animated.timing(squish, { toValue: 1.25, duration: 120, useNativeDriver: native }),
        Animated.spring(squish, { toValue: 1, useNativeDriver: native, speed: 12, bounciness: 10 }),
      ]),
    ]).start();
  }, [active]);
  const seg = w / Math.max(1, routes.length);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 6, 12), alignItems: 'center', paddingHorizontal: 14 }}>
      <View style={[{ width: '100%', maxWidth: 440, borderRadius: 32 }, ELEV.float]}>
        <BlurView intensity={native ? 80 : 40} tint="light" style={{ borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}>
          <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 12)} style={{ flexDirection: 'row', padding: 6, backgroundColor: 'rgba(255,250,246,0.82)' }}>
            {w > 0 ? (
              <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 6 + seg / 2 - 21, width: 42, height: 42, borderRadius: 21, backgroundColor: K.copper,
                transform: [{ translateX: Animated.multiply(x, seg) }, { scaleX: squish }] }} />
            ) : null}
            {routes.map((r: any, i: number) => {
              const t = TABS.find(t => t.name === r.name)!;
              const on = i === active;
              return (
                <Pressable key={r.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }}
                  onPress={() => { haptic.tap(); go(i, r.name); }} style={{ flex: 1, alignItems: 'center', paddingTop: 2 }}>
                  <View style={{ width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }}><TabIcon icon={t.icon} on={on} /></View>
                  <Txt v="caption" color={on ? K.copperInk : K.ink2} style={{ fontSize: 10.5, marginTop: 1, fontFamily: on ? 'Geist_600SemiBold' : 'Geist_400Regular' }}>{t.label}</Txt>
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, ready } = useAuth();
  const { sidebar } = useLayout();
  const path = usePathname();
  if (!ready) return <PageSkeleton kind={skeletonKind(path)} />;
  if (!user) return <Redirect href="/welcome" />;
  const tabs = (
    <Tabs tabBar={p => (sidebar ? null : <Dock {...p} />)} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: K.canvas }, animation: native ? 'shift' : 'none' }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="hazards" />
      <Tabs.Screen name="assistant" />
      <Tabs.Screen name="body" />
      <Tabs.Screen name="handoff" options={{ href: null }} />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="plan" options={{ href: null }} />
      <Tabs.Screen name="check" options={{ href: null }} />
      <Tabs.Screen name="trends" options={{ href: null }} />
    </Tabs>
  );
  const withSyncs = <><Syncs />{tabs}</>;
  if (!sidebar) return withSyncs;
  return <View style={{ flex: 1, flexDirection: 'row', backgroundColor: K.canvas }}><Sidebar /><View style={{ flex: 1 }}>{withSyncs}</View></View>;
}
