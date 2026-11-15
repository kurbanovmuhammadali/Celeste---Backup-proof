import React, { useState } from 'react';
import { View } from 'react-native';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell, Input, Star } from '@/astra';
import { useDraft } from '@/onboarding';
import { useAuth } from '@/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Flight surgeon sign-in: email → emailed code → the doctor console. Only emails the administrator has added can sign in. */
export default function Doctor() {
  const [d, set] = useDraft();
  const { requestCode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = EMAIL_RE.test(d.email.trim());
  const next = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await requestCode(d.email.trim(), 'doctor');
      set({ devCode: r.devCode ?? '' });
      nav.push({ pathname: '/code', params: { purpose: 'doctor' } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Doctor sign-in" sub="For flight surgeons. Enter the email the mission administrator registered and we’ll send you a code."
      top={<View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: A.ink, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 14 }}><Star size={30} color="#fff" /></View>}
      onBack={() => nav.back('/welcome')} onNext={next} nextDisabled={!valid} nextLoading={busy} nextLabel="Send code">
      <Input label="Work email" required value={d.email} onChangeText={v => { set({ email: v }); setErr(null); }} valid={valid} placeholder="doctor@agency.org"
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" focusOnEnter
        returnKeyType="send" onSubmitEditing={() => valid && next()} error={err} />
      <Input label="Your name (first time only)" value={`${d.firstName}${d.lastName ? ' ' + d.lastName : ''}`}
        onChangeText={v => { const [f, ...r] = v.split(' '); set({ firstName: f ?? '', lastName: r.join(' ') }); }} placeholder="Dr. Elena Voss" autoCapitalize="words" />
      <T size={12.5} color={A.ink3} style={{ marginTop: 12, lineHeight: 18 }}>By signing in you accept the Terms and Privacy Policy. Not on the list? Ask the mission administrator to add your email.</T>
    </FormShell>
  );
}
