import React from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, PersonStanding, ListChecks, ChartColumn, User } from 'lucide-react-native';
import { useAuth } from '@/auth';
import { C, shadow } from '@/theme';
import { Loading } from '@/ui';

const ICONS: Record<string, any> = { today: House, body: PersonStanding, plan: ListChecks, trends: ChartColumn, profile: User };
const LABELS: Record<string, string> = { today: 'Today', body: 'Body map', plan: 'Plan', trends: 'Trends', profile: 'Profile' };

function PillBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 14), alignItems: 'center' }}>
      <View style={[{ flexDirection: 'row', gap: 4, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 999, padding: 6 }, shadow]}>
        {state.routes.map((r: any, i: number) => {
          const on = state.index === i;
          const Icon = ICONS[r.name] ?? House;
          return (
            <Pressable key={r.key} accessibilityRole="tab" accessibilityLabel={LABELS[r.name]} accessibilityState={{ selected: on }}
              onPress={() => { if (!on) navigation.navigate(r.name); }}
              style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.coral : 'transparent' }}>
              <Icon size={21} color={on ? '#fff' : C.ink} strokeWidth={1.8} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={p => <PillBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="body" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="trends" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
