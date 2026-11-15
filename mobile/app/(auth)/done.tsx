import React from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
import { MotionScreen, Reveal, nav, useEntrance } from '@/motion';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight } from 'lucide-react-native';
import { A } from '@/theme';
import { T } from '@/ui';
import { Floaty, IMG, Pill, RATIO } from '@/astra';
import { useAuth } from '@/auth';
import { draft } from '@/onboarding';

export default function Done() {
  const { user } = useAuth();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const first = user?.name.split(' ')[0] ?? '';
  const years = user?.missionYears ?? null;
  const bodyW = Math.min(W * 0.92, 440);
  const rise = useEntrance(1600, 100);
  return (
    <View style={{ flex: 1, backgroundColor: A.sand }}>
      <Image source={IMG.gradient} resizeMode="cover" style={{ position: 'absolute', width: W, height: H }} />
      <MotionScreen>
      <Animated.View style={{ position: 'absolute', top: insets.top + 30, alignSelf: 'center', opacity: rise, transform: [{ scale: rise.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }}>
        <Floaty amp={6} rotate={0} dur={3800}>
          <Image source={IMG.body} style={{ width: bodyW, height: bodyW / RATIO.body, opacity: 0.95 }} resizeMode="contain" />
        </Floaty>
      </Animated.View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 24, paddingBottom: insets.bottom + 34, width: '100%', maxWidth: 520, alignSelf: 'center' }}>
        <Reveal i={3}>
          <T size={38} weight="sb" color="#fff" style={{ letterSpacing: -1, lineHeight: 42 }}>{`Welcome aboard,\n${first}.`}</T>
          <T size={15.5} color="rgba(255,255,255,0.88)" style={{ marginTop: 10, lineHeight: 22 }}>
            {years ? `Your ${years}-year mission profile is ready. ` : ''}Let’s look after you up there.
          </T>
        </Reveal>
        <Reveal i={5} from={30} style={{ marginTop: 28 }}>
          <Pill title="Go to main page" kind="white" icon={<ArrowRight size={18} color={A.ink} />} onPress={() => { draft.reset(); nav.replace('/today'); }} />
        </Reveal>
      </View>
      </MotionScreen>
    </View>
  );
}
