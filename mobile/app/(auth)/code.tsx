import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { A, F } from '@/theme';
import { T } from '@/ui';
import { Floaty, FormShell, IMG, RATIO, focusSoon, thud, tick } from '@/astra';
import { setStore } from '@/data/store';
import { useDraft } from '@/onboarding';
import { useAuth, type CodePurpose } from '@/auth';
import { EASE_OUT, nav, native, useEntrance } from '@/motion';

/** One code box: the digit pops in, the active box shows a blinking caret, success turns it copper. */
function Box({ ch, active, error, success, i }: { ch?: string; active: boolean; error: boolean; success: Animated.Value; i: number }) {
  const pop = useRef(new Animated.Value(ch ? 1 : 0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (ch) { pop.setValue(0); Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 18, bounciness: 14 }).start(); }
    else pop.setValue(0);
  }, [ch]);
  useEffect(() => {
    if (!active) { blink.stopAnimation(); blink.setValue(0); return; }
    const l = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 420, useNativeDriver: native }),
      Animated.timing(blink, { toValue: 0, duration: 420, useNativeDriver: native }),
    ]));
    l.start();
    return () => l.stop();
  }, [active]);
  const s = success.interpolate({ inputRange: [i * 0.18, i * 0.18 + 0.4], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <Animated.View style={{ width: 62, height: 70, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.4,
      backgroundColor: s.interpolate({ inputRange: [0, 1], outputRange: ['#FFFFFF', A.copper] }),
      borderColor: error ? '#D9583F' : active ? A.copper : ch ? A.copperSoft : 'transparent',
      transform: [{ scale: s.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.1, 1] }) }] }}>
      {ch ? (
        <Animated.Text style={{ fontFamily: F.sb, fontSize: 28, color: s.interpolate({ inputRange: [0, 1], outputRange: [A.ink, '#FFFFFF'] }) as any,
          opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }, { translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{ch}</Animated.Text>
      ) : active ? <Animated.View style={{ width: 2, height: 28, borderRadius: 1, backgroundColor: A.copper, opacity: blink }} /> : null}
    </Animated.View>
  );
}

export default function Code() {
  const { purpose: p } = useLocalSearchParams<{ purpose?: string }>();
  const purpose: CodePurpose = p === 'login' ? 'login' : p === 'doctor' ? 'doctor' : 'signup';
  const [d, set] = useDraft();
  const { requestCode, verifyCode } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(30);
  const input = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const success = useRef(new Animated.Value(0)).current;
  const fly = useRef(new Animated.Value(0)).current;      // envelope "sent" on success
  const drop = useEntrance(1100, 100);                    // envelope drops in on arrival

  useEffect(() => (d.devCode ? undefined : focusSoon(input, 700)), []);
  useEffect(() => { const id = setInterval(() => setWait(w => Math.max(0, w - 1)), 1000); return () => clearInterval(id); }, []);

  // Demo mode (no email service yet): the code types itself in so the flow can be tested end to end.
  useEffect(() => {
    if (!d.devCode) return;
    const digits = d.devCode.split('');
    const timers = digits.map((_, k) => setTimeout(() => onChange(d.devCode.slice(0, k + 1)), 1100 + k * 260));
    return () => timers.forEach(clearTimeout);
  }, [d.devCode]);

  if (!d.email) return <Redirect href={purpose === 'login' ? '/login' : purpose === 'doctor' ? '/doctor' : '/name'} />;

  const verify = async (c: string) => {
    setBusy(true); setErr(null);
    try {
      const profile = purpose === 'doctor' ? { name: `${d.firstName} ${d.lastName}`.trim(), acceptTerms: true } : purpose === 'signup' ? { firstName: d.firstName, lastName: d.lastName, age: d.age, heightCm: d.heightCm, weightKg: d.weightKg, missionYears: d.missionYears, missionGoal: d.goalDest || d.goalTasks.length ? { dest: d.goalDest, tasks: d.goalTasks } : null, acceptTerms: d.acceptTerms } : undefined;
      await verifyCode(d.email.trim(), purpose, c, profile);
      if (purpose === 'signup') setStore(st => ({ ...st, profile: { ...st.profile, age: String(d.age), height: String(d.heightCm), weight: String(d.weightKg) } }));
      thud();
      await new Promise<void>(res => Animated.parallel([
        Animated.timing(success, { toValue: 1, duration: 700, easing: EASE_OUT, useNativeDriver: false }),
        Animated.timing(fly, { toValue: 1, duration: 800, delay: 250, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
      ]).start(() => res()));
      // (the draft is cleared by the next sign-up's "Get started"; clearing it here would trip this screen's redirect guard)
      if (purpose === 'doctor') nav.replace('/admin');
      else if (purpose === 'login') nav.replace('/today');
      else nav.replace('/data');
    } catch (e: any) {
      setErr(e.message); setCode('');
      Animated.sequence([12, -11, 8, -5, 0].map(v => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: native }))).start();
      input.current?.focus();
      setBusy(false);
    }
  };
  function onChange(t: string) {
    const c = t.replace(/\D/g, '').slice(0, 4);
    if (c.length > code.length) tick();
    setCode(c); setErr(null);
    if (c.length === 4) verify(c); // continues by itself once all four digits are in
  }
  const resend = async () => {
    try { const r = await requestCode(d.email.trim(), purpose); set({ devCode: r.devCode ?? '' }); setCode(''); setWait(30); setErr(null); } catch (e: any) { setErr(e.message); }
  };

  return (
    <FormShell step={purpose === 'signup' ? 6 : undefined} title="Check your email" onBack={() => nav.back(purpose === 'login' ? '/login' : purpose === 'doctor' ? '/doctor' : '/email')}
      onNext={() => verify(code)} nextDisabled={code.length < 4} nextLoading={busy} nextLabel="Verify">
      <Animated.View style={{ alignSelf: 'center', marginTop: 18,
        opacity: drop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: Animated.add(drop.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }), fly.interpolate({ inputRange: [0, 1], outputRange: [0, -260] })) },
          { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }) },
          { rotate: Animated.add(drop.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }), fly.interpolate({ inputRange: [0, 1], outputRange: [0, 22] })).interpolate({ inputRange: [-30, 30], outputRange: ['-30deg', '30deg'] }) },
          { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
        ] }}>
        <Floaty amp={6} rotate={2}>
          <Image source={IMG.envelope} style={{ width: 170, height: 170 / RATIO.envelope }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Floaty>
      </Animated.View>
      <T size={15} color={A.ink2} center style={{ marginTop: 18, lineHeight: 21 }}>
        We’ve sent a 4-digit code to{'\n'}<T size={15} weight="m" color={A.ink}>{d.email.trim()}</T>
      </T>

      <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code">
        <Animated.View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 26, transform: [{ translateX: shake }] }}>
          {[0, 1, 2, 3].map(k => <Box key={k} i={k} ch={code[k]} active={k === code.length && !busy} error={!!err} success={success} />)}
        </Animated.View>
      </Pressable>
      <TextInput ref={input} value={code} onChangeText={onChange} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={4}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, fontFamily: F.r }} accessibilityLabel="Enter the 4-digit code" />

      {err ? <T size={13.5} color="#C0472F" center style={{ marginTop: 14 }}>{err}</T>
        : <T size={13} color={A.ink3} center style={{ marginTop: 14, fontStyle: 'italic' }}>{busy ? 'Verifying…' : 'Continues automatically after verification.'}</T>}
      <T size={13.5} color={A.ink2} center style={{ marginTop: 18 }}>
        Didn’t get it? {wait > 0 ? <T size={13.5} color={A.ink3}>Resend in 0:{String(wait).padStart(2, '0')}</T> : <T size={13.5} weight="m" color={A.copper} onPress={resend}>Resend code</T>}
      </T>
      {d.devCode ? (
        <View style={{ alignSelf: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.7)' }}>
          <T size={12} color={A.ink2}>Demo mode · code {d.devCode} is filled in for you</T>
        </View>
      ) : null}
    </FormShell>
  );
}
