import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useGlobalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { AuthProvider } from '@/auth';
import CookieBanner from '@/CookieBanner';
import { C } from '@/theme';
import { DeviceFrame, DeviceInsets, shouldFrame } from '@/DeviceFrame';
import LaptopPanels from '@/LaptopPanels';
import { BootSkeleton, PageSkeleton, ToastHost, skeletonKind } from '@/kit/ui';
import { useAuth } from '@/auth';
import { K } from '@/kit/tokens';
import { loadStore } from '@/data/store';
import { LiveProvider } from '@/live/Live';

/** Pushed screens inside the crew app slide in natively on iOS; on web each page animates itself (src/kit/page.tsx). */
const PUSHED = ['signals', 'assistant/history', 'assistant/menu', 'training/sets', 'training/[id]', 'training/setup', 'profile/edit', 'profile/privacy', 'profile/connected', 'profile/account', 'profile/presentation', 'profile/face', 'integrations', 'report', 'metric/[key]', 'legal/[doc]', 'radiation', 'eva', 'eva-check', 'radiation-log', 'research-data', 'formcheck', 'research', 'profile/briefing', 'crew', 'family', 'wellbeing', 'shelter', 'daily', 'background', 'nutrition', 'mission-plan', 'attention', 'judge', 'admin/reports', 'admin/index', 'admin/[id]', 'admin/leader'];

/** Reload skeleton until sign-in state is known (min ~0.7 s so it reads as a deliberate loading state).
 *  Its shape matches the page being opened (Home, Mission, AI, Body, Profile, lists, sign-up…). */
function Boot() {
  const { ready } = useAuth();
  const path = usePathname();
  const { tab } = useGlobalSearchParams<{ tab?: string }>();
  return <BootSkeleton ready={ready} kind={skeletonKind(path, tab)} />;
}

export default function Root() {
  const path = usePathname();
  const [loaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, GeistMono_400Regular, GeistMono_500Medium });
  useEffect(() => { loadStore(); }, []);
  if (shouldFrame) return <DeviceFrame />; // ?frame=1 on desktop → the app inside an iPhone-sized frame
  if (!loaded) return <SafeAreaProvider><PageSkeleton kind={skeletonKind(path)} /></SafeAreaProvider>;
  return (
    <SafeAreaProvider>
      <DeviceInsets>
      <AuthProvider>
      <LiveProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'fade_from_bottom' }}>
          {/* onboarding screens animate themselves (src/motion.tsx), so the native stack transition is off */}
          {['intro', 'welcome', '(auth)/name', '(auth)/age', '(auth)/mission', '(auth)/goal', '(auth)/data', '(auth)/email', '(auth)/code', '(auth)/face', '(auth)/team', '(auth)/login', '(auth)/doctor', '(auth)/done', 'cam/[token]', 'camera', 'f/[token]'].map(n => (
            <Stack.Screen key={n} name={n} options={{ animation: 'none', contentStyle: { backgroundColor: '#F8EEE8' } }} />
          ))}
          <Stack.Screen name="(tabs)" options={{ animation: 'fade', contentStyle: { backgroundColor: K.canvas } }} />
          {PUSHED.map(n => <Stack.Screen key={n} name={n} options={{ animation: 'slide_from_right', gestureEnabled: true, contentStyle: { backgroundColor: K.canvas } }} />)}
          <Stack.Screen name="training/active" options={{ animation: 'slide_from_bottom', gestureEnabled: false, contentStyle: { backgroundColor: K.canvas } }} />
          <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="remeasure" options={{ presentation: 'modal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: K.canvas } }} />
          <Stack.Screen name="emergency" options={{ animation: 'fade', contentStyle: { backgroundColor: '#1C120D' } }} />
          <Stack.Screen name="log" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
        <CookieBanner />
        <LaptopPanels />
        <ToastHost />
        <Boot />
      </LiveProvider>
      </AuthProvider>
      </DeviceInsets>
    </SafeAreaProvider>
  );
}
