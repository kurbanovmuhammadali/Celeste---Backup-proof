import React, { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AuthShell from '@/AuthShell';
import { Button, Notice, Row, T } from '@/ui';
import { C, F } from '@/theme';

const MIN_AGE = 18;
function ageOf(y: number, m: number, d: number, now = new Date()) {
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

export default function Age() {
  const [d, setD] = useState(''); const [m, setM] = useState(''); const [y, setY] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const mRef = useRef<TextInput>(null); const yRef = useRef<TextInput>(null);

  const go = () => {
    const dd = +d, mm = +m, yy = +y;
    const dt = new Date(yy, mm - 1, dd);
    if (!dd || !mm || y.length !== 4 || dt.getMonth() !== mm - 1 || dt.getDate() !== dd || dt > new Date() || yy < 1900) return setErr('Please enter a real date of birth.');
    const age = ageOf(yy, mm, dd);
    if (age < MIN_AGE) { setBlocked(true); return; }
    router.push({ pathname: '/register', params: { dob: `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` } });
  };

  const box = { height: 72, borderRadius: 20, backgroundColor: '#fff', fontFamily: F.m, fontSize: 28, textAlign: 'center' as const, color: C.ink, letterSpacing: -0.5 };
  if (blocked) return (
    <AuthShell step="Age check" title="Not yet, cadet." sub={`Perigee handles sensitive health data and is only available to people aged ${MIN_AGE} or older.`}>
      <Notice kind="info" title="We did not store anything" body="Your date of birth was only checked on this device and was not sent to our servers." />
      <Button title="Back to start" kind="dark" onPress={() => router.replace('/welcome')} />
    </AuthShell>
  );
  return (
    <AuthShell step="Step 1 of 2 · Age check" title="When were you born?" sub={`Perigee is for adults ${MIN_AGE}+. We use your age to interpret heart-rate and bone indicators correctly.`}>
      <Row gap={10}>
        <View style={{ flex: 1 }}><T size={12} color={C.ink3} style={{ marginBottom: 6, marginLeft: 4 }}>Day</T>
          <TextInput accessibilityLabel="Day" value={d} onChangeText={t => { const v = t.replace(/\D/g, '').slice(0, 2); setD(v); setErr(null); if (v.length === 2) mRef.current?.focus(); }} placeholder="DD" placeholderTextColor={C.ink3} keyboardType="number-pad" style={box} /></View>
        <View style={{ flex: 1 }}><T size={12} color={C.ink3} style={{ marginBottom: 6, marginLeft: 4 }}>Month</T>
          <TextInput ref={mRef} accessibilityLabel="Month" value={m} onChangeText={t => { const v = t.replace(/\D/g, '').slice(0, 2); setM(v); setErr(null); if (v.length === 2) yRef.current?.focus(); }} placeholder="MM" placeholderTextColor={C.ink3} keyboardType="number-pad" style={box} /></View>
        <View style={{ flex: 1.5 }}><T size={12} color={C.ink3} style={{ marginBottom: 6, marginLeft: 4 }}>Year</T>
          <TextInput ref={yRef} accessibilityLabel="Year" value={y} onChangeText={t => { setY(t.replace(/\D/g, '').slice(0, 4)); setErr(null); }} placeholder="YYYY" placeholderTextColor={C.ink3} keyboardType="number-pad" style={box} onSubmitEditing={go} /></View>
      </Row>
      {err ? <T size={13} color={C.red} style={{ marginTop: 10 }}>{err}</T> : null}
      <Button title="Continue" kind="dark" onPress={go} style={{ marginTop: 28 }} />
      <T size={13} color={C.ink3} center style={{ marginTop: 18 }}>Already have an account? <T size={13} weight="m" onPress={() => router.replace('/login')} style={{ textDecorationLine: 'underline' }}>Sign in</T></T>
    </AuthShell>
  );
}
