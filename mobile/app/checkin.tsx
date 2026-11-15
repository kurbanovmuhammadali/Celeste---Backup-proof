import React, { useState } from 'react';
import { Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { api } from '@/api';
import { C, F } from '@/theme';
import { Dial, FadeIn, Logo, Notice, Row, T } from '@/ui';
import RingScene from '@/three/RingScene';

const SYMPTOMS: [string, string][] = [
  ['headache', 'Headache'], ['vision', 'Vision change'], ['insomnia', 'Trouble sleeping'], ['anxiety', 'Anxious / low'],
  ['back_pain', 'Back pain'], ['dizziness', 'Dizziness'], ['sore_throat', 'Sore throat'], ['fever', 'Feverish'], ['rash', 'Rash'], ['chest_pain', 'Chest pain'],
];
const word = (v: number) => (v >= 85 ? 'Great' : v >= 70 ? 'Relaxed' : v >= 55 ? 'Okay' : v >= 40 ? 'Low' : 'Struggling');

export default function CheckIn() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(72);
  const [sym, setSym] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<{ message: string; escalate: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (k: string) => setSym(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));
  const submit = async () => {
    try { setResult(await api('/api/checkins', { body: { mood, symptoms: sym, note } })); } catch (e: any) { setErr(e.message); }
  };
  const next = () => (step === 0 ? setStep(1) : result ? router.back() : submit());
  const dialW = Math.min(width - 40, 420);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={['#ECE7E2', '#C8B09F', '#8B6A57', '#3F2D24']} locations={[0, 0.4, 0.75, 1]} style={{ position: 'absolute', inset: 0 } as any} />
      <View style={{ flex: 1, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 22, paddingHorizontal: 20, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Logo />
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <X size={14} color={C.ink} /><T size={14} weight="m">Skip</T>
          </Pressable>
        </Row>
        <Row gap={6} style={{ alignSelf: 'center', marginTop: 24 }}>
          {[0, 1].map(j => <View key={j} style={{ width: j === step ? 30 : 18, height: 2, backgroundColor: j === step ? '#fff' : 'rgba(255,255,255,0.4)' }} />)}
        </Row>

        {result ? (
          <FadeIn style={{ flex: 1, justifyContent: 'center' }}>
            <T size={44} weight="m" color="#fff" center>{result.escalate ? 'Thank you.\nLet’s get help.' : 'Logged.\nNice work.'}</T>
            <View style={{ marginTop: 24 }}>
              <Notice kind={result.escalate ? 'red' : 'green'} title={result.message} />
            </View>
            {result.escalate ? <Pressable onPress={() => router.replace('/report')} style={{ alignSelf: 'center', marginTop: 8 }}><T size={15} weight="m" color="#fff" style={{ textDecorationLine: 'underline' }}>Open flight-surgeon report</T></Pressable> : null}
          </FadeIn>
        ) : step === 0 ? (
          <FadeIn key="s0" style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ flex: 1, minHeight: 160, justifyContent: 'center' }}><RingScene height={230} speed={0.2} /></View>
            <T size={34} weight="m" color="#fff" center>How have you been{'\n'}feeling this morning?</T>
            <T size={14} color="rgba(255,255,255,0.75)" center style={{ marginTop: 10 }}>Drag along the arc. Be honest — only you and your flight surgeon see this.</T>
            <View style={{ marginTop: 34 }}>
              <Dial value={mood} onChange={setMood} size={dialW} light />
              <Row style={{ justifyContent: 'space-between', width: dialW * 0.72, alignSelf: 'center', marginTop: -dialW * 0.2 }}>
                <T size={13} color="rgba(255,255,255,0.7)">0</T><T size={13} color="rgba(255,255,255,0.7)">100</T>
              </Row>
              <T size={96} weight="m" color={C.ink} center style={{ marginTop: dialW * 0.02 }}>{mood}</T>
              <T size={14} weight="m" color={C.ink} center>{word(mood)}</T>
            </View>
          </FadeIn>
        ) : (
          <FadeIn key="s1" style={{ flex: 1, justifyContent: 'center' }}>
            <T size={34} weight="m" color="#fff" center>Anything{'\n'}unusual today?</T>
            <T size={14} color="rgba(255,255,255,0.75)" center style={{ marginTop: 10, marginBottom: 22 }}>Tap all that apply. Vision changes and chest pain always go to the flight surgeon.</T>
            <Row wrap gap={8} style={{ justifyContent: 'center' }}>
              {SYMPTOMS.map(([k, l]) => {
                const on = sym.includes(k);
                return (
                  <Pressable key={k} onPress={() => toggle(k)} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }}>
                    <T size={14} weight="m" color={on ? C.ink : '#fff'}>{l}</T>
                  </Pressable>
                );
              })}
            </Row>
            <TextInput value={note} onChangeText={setNote} placeholder="Optional note for yourself…" placeholderTextColor="rgba(255,255,255,0.6)" multiline
              style={{ marginTop: 20, minHeight: 80, borderRadius: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.14)', color: '#fff', fontFamily: F.r, fontSize: 15 }} />
            {err ? <View style={{ marginTop: 12 }}><Notice kind="red" title={err} /></View> : null}
          </FadeIn>
        )}

        <Row style={{ justifyContent: 'space-between', marginTop: 18 }}>
          <Pressable accessibilityLabel="Back" onPress={() => (step && !result ? setStep(0) : router.back())} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={C.ink} />
          </Pressable>
          <Pressable accessibilityLabel={step === 0 ? 'Next' : 'Save check-in'} onPress={next} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={22} color={C.ink} />
          </Pressable>
        </Row>
      </View>
    </View>
  );
}
