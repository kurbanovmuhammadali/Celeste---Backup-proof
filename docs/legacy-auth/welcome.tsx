import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { C } from '@/theme';
import { Button, FadeIn, Logo, Row, T, useWide } from '@/ui';
import RingScene from '@/three/RingScene';

const SLIDES = [
  { k: 'Wearable + mission plan', h: 'Your body,\nin orbit.', p: 'Perigee reads your WHOOP band, your labs and your check-ins, and shows how your body is coping with spaceflight.' },
  { k: 'Personal baseline', h: 'Know before\nit matters.', p: 'Every indicator is compared with your own pre-flight baseline. Green, amber, red, readable in a second.' },
  { k: 'Adaptive plan', h: 'Your plan,\nadapted.', p: '“The plan says 1 km. Your bone markers say 2.” We keep the mission plan and add what your data asks for.' },
];

export default function Welcome() {
  const [i, setI] = useState(0);
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const s = SLIDES[i];
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : router.push('/age'));

  const copy = (
    <View style={{ alignItems: wide ? 'flex-start' : 'center' }}>
      <Row gap={6} style={{ marginBottom: 18 }}>
        {SLIDES.map((_, j) => <View key={j} style={{ width: j === i ? 30 : 18, height: 2, borderRadius: 1, backgroundColor: j === i ? '#fff' : 'rgba(255,255,255,0.4)' }} />)}
      </Row>
      <FadeIn key={i}>
        <T size={13} weight="m" color="rgba(255,255,255,0.75)" center={!wide} style={{ letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>{s.k}</T>
        <T size={wide ? 64 : 40} weight="m" color="#fff" center={!wide}>{s.h}</T>
        <T size={16} color="rgba(255,255,255,0.86)" center={!wide} style={{ marginTop: 16, maxWidth: 440 }}>{s.p}</T>
      </FadeIn>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#ECE7E2', '#CDB8A9', '#94735F', '#4A352A']} locations={[0, 0.38, 0.7, 1]} style={{ position: 'absolute', inset: 0 } as any} />
      <View style={{ flex: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 20, paddingHorizontal: 22, width: '100%', maxWidth: 1180, alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Logo />
          <Pressable onPress={() => router.push('/login')} style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 }}>
            <T size={14} weight="m">Sign in</T>
          </Pressable>
        </Row>

        {wide ? (
          <Row style={{ flex: 1 }} gap={40}>
            <View style={{ flex: 1 }}>
              {copy}
              <Row gap={12} style={{ marginTop: 36 }}>
                <Button title="Create account" kind="light" onPress={() => router.push('/age')} style={{ paddingHorizontal: 32 }} />
                <Button title={i < SLIDES.length - 1 ? 'Next' : 'Get started'} kind="dark" onPress={next} icon={<ArrowRight size={18} color="#fff" />} />
              </Row>
            </View>
            <View style={{ flex: 1.1 }}>
              <RingScene height={620} />
              <Tag />
            </View>
          </Row>
        ) : (
          <>
            <View style={{ flex: 1, justifyContent: 'center', minHeight: 300 }}>
              <RingScene height={360} />
              <Tag />
            </View>
            {copy}
            <Row style={{ justifyContent: 'space-between', marginTop: 28 }}>
              <Pressable accessibilityLabel="Previous" onPress={() => setI(Math.max(0, i - 1))} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.5 }}>
                <ChevronLeft size={22} color={C.ink} />
              </Pressable>
              <Button title={i < SLIDES.length - 1 ? 'Next' : 'Create account'} kind="light" onPress={next} style={{ flex: 1, marginLeft: 14, height: 54 }} />
            </Row>
          </>
        )}
      </View>
    </View>
  );
}

function Tag() {
  return (
    <View style={{ position: 'absolute', right: '8%', bottom: '18%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 999, paddingVertical: 8, paddingLeft: 8, paddingRight: 16 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: C.ink, borderWidth: 3, borderColor: '#fff' }} />
      <T size={13} weight="m">WHOOP · synced</T>
    </View>
  );
}
