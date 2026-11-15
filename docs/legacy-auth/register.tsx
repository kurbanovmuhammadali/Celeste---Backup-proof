import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, Redirect, router, useLocalSearchParams } from 'expo-router';
import AuthShell from '@/AuthShell';
import { useAuth } from '@/auth';
import { Button, Checkbox, Chip, Field, Notice, Row, T } from '@/ui';
import { C } from '@/theme';

const ROLES = [{ k: 'astronaut', l: 'Astronaut' }, { k: 'analog', l: 'Analog crew' }, { k: 'surgeon', l: 'Flight surgeon' }];
const ENVS = [{ k: 'station', l: 'Space station' }, { k: 'spacecraft', l: 'Spacecraft' }, { k: 'lunar', l: 'Lunar base' }, { k: 'mars', l: 'Mars base' }, { k: 'analog', l: 'Earth analog' }];

export default function Register() {
  const { dob } = useLocalSearchParams<{ dob?: string }>();
  const { register } = useAuth();
  const [f, setF] = useState({ name: '', email: '', password: '', mission: 'ISS Expedition 74', role: 'astronaut', environment: 'station' });
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!dob) return <Redirect href="/age" />;
  const set = (k: keyof typeof f) => (v: string) => { setF({ ...f, [k]: v }); setErr(null); };

  const pwOk = f.password.length >= 8 && /[A-Za-z]/.test(f.password) && /\d/.test(f.password);
  const submit = async () => {
    if (!terms || !health) return setErr('Please accept both agreements to continue.');
    setBusy(true);
    try {
      await register({ ...f, dob, acceptTerms: terms, acceptPrivacy: terms, consentHealth: health });
      router.replace('/today');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const link = (href: '/legal/terms' | '/legal/privacy', label: string) => <Link href={href}><T size={13} weight="m" style={{ textDecorationLine: 'underline' }}>{label}</T></Link>;
  return (
    <AuthShell step="Step 2 of 2 · Crew profile" title="Join the crew" sub="Your data stays yours. Only you decide what goes to your flight surgeon.">
      <Field label="Full name" value={f.name} onChangeText={set('name')} placeholder="Ada Orbit" autoComplete="name" textContentType="name" />
      <Field label="Email" value={f.email} onChangeText={set('email')} placeholder="you@agency.space" autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
      <Field label="Password" value={f.password} onChangeText={set('password')} placeholder="8+ characters, a letter and a number" secureTextEntry autoComplete="new-password" textContentType="newPassword" />
      {f.password ? <Row gap={6} style={{ marginTop: -6, marginBottom: 14, marginLeft: 4 }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pwOk ? C.green : C.amber }} /><T size={12} color={C.ink2}>{pwOk ? 'Strong enough' : '8+ characters with a letter and a number'}</T></Row> : null}

      <T size={13} weight="m" color={C.ink2} style={{ marginBottom: 8, marginLeft: 4 }}>Role</T>
      <Row gap={8} wrap style={{ marginBottom: 16 }}>{ROLES.map(r => <Chip key={r.k} label={r.l} on={f.role === r.k} onPress={() => set('role')(r.k)} />)}</Row>
      <Field label="Mission" value={f.mission} onChangeText={set('mission')} placeholder="ISS Expedition 74" />
      <T size={13} weight="m" color={C.ink2} style={{ marginBottom: 8, marginLeft: 4 }}>Where will you be?</T>
      <Row gap={8} wrap style={{ marginBottom: 18 }}>{ENVS.map(r => <Chip key={r.k} label={r.l} on={f.environment === r.k} onPress={() => set('environment')(r.k)} color={C.coral} />)}</Row>

      <Checkbox checked={terms} onChange={setTerms}>
        <T size={13} color={C.ink2}>I am 18 or older and agree to the {link('/legal/terms', 'Terms of Use')} and {link('/legal/privacy', 'Privacy Policy')}.</T>
      </Checkbox>
      <Checkbox checked={health} onChange={setHealth}>
        <T size={13} color={C.ink2}>I explicitly consent to Perigee processing my health data (vitals, sleep, mood, labs, wearable data) to show my health status. I can withdraw this anytime by deleting my account.</T>
      </Checkbox>

      {err ? <View style={{ marginTop: 12 }}><Notice kind="red" title={err} /></View> : null}
      <Button title="Create account" kind="dark" loading={busy} disabled={!f.name || !f.email || !pwOk || !terms || !health} onPress={submit} style={{ marginTop: 18 }} />
      <T size={12} color={C.ink3} center style={{ marginTop: 14 }}>Your account starts with a clearly-labelled demo dataset so you can explore. Connect WHOOP or clear it anytime.</T>
    </AuthShell>
  );
}
