import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { C } from './theme';
import { IconBtn, Logo, Row, T, useWide } from './ui';
import PlanetScene from './three/PlanetScene';

export default function AuthShell({ title, sub, children, step }: { title: string; sub?: string; children: React.ReactNode; step?: string }) {
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const form = (
    <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
      {step ? <T size={12} weight="m" color={C.ink3} style={{ letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>{step}</T> : null}
      <T size={36} weight="m">{title}</T>
      {sub ? <T size={15} color={C.ink2} style={{ marginTop: 8, marginBottom: 24 }}>{sub}</T> : <View style={{ height: 24 }} />}
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#F6F5F3', '#EEEAE5', '#E3DCD5']} style={{ position: 'absolute', inset: 0 } as any} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30, paddingHorizontal: 22 }}>
        <Row style={{ justifyContent: 'space-between', width: '100%', maxWidth: 1180, alignSelf: 'center' }}>
          <IconBtn label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}><ChevronLeft size={20} color={C.ink} /></IconBtn>
          <Logo size={18} />
          <View style={{ width: 48 }} />
        </Row>
        {wide ? (
          <Row style={{ flex: 1, width: '100%', maxWidth: 1180, alignSelf: 'center' }} gap={40}>
            <View style={{ flex: 1 }}><PlanetScene height={520} /></View>
            <View style={{ flex: 1 }}>{form}</View>
          </Row>
        ) : (
          <>
            <PlanetScene height={190} />
            {form}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
