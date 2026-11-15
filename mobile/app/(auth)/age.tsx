import React from 'react';
import { Animated, Image } from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Floaty, IMG, RATIO } from '@/astra';
import { useDraft } from '@/onboarding';
import { nav, useEntrance } from '@/motion';
import QuestionScreen, { useHero } from '@/QuestionScreen';

/** Age: the spacecraft glides in and drifts above Mars while the crew member picks their age (18–100). */
function Ship() {
  const { W, heroH } = useHero();
  const insets = useSafeAreaInsets();
  const e = useEntrance(1500, 120);
  const shipW = Math.min(W * 0.86, 460);
  return (
    <Animated.View style={{ position: 'absolute', alignSelf: 'center', top: Math.max(insets.top + 40, heroH * 0.16), opacity: e.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
      transform: [{ translateX: e.interpolate({ inputRange: [0, 1], outputRange: [W * 0.7, 0] }) }, { translateY: e.interpolate({ inputRange: [0, 1], outputRange: [-60, 0] }) },
        { scale: e.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }, { rotate: e.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '0deg'] }) }] }}>
      <Floaty amp={9} dur={3400} rotate={2.5}>
        <Image source={IMG.ship} style={{ width: shipW, height: shipW / RATIO.ship }} resizeMode="contain" />
      </Floaty>
    </Animated.View>
  );
}

export default function Age() {
  const [d, set] = useDraft();
  if (!d.firstName) return <Redirect href="/name" />;
  return (
    <QuestionScreen
      step={2}
      question="How old are you?"
      hero={<Ship />}
      ruler={{ min: 18, max: 100, step: 1, majorEvery: 5, value: d.age, onChange: v => set({ age: v }) }}
      value={String(d.age)}
      unit="years old"
      onBack={() => nav.back('/name')}
      onNext={() => nav.push('/mission')}
    />
  );
}
