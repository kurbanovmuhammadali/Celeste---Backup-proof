import React, { useState } from 'react';
import { Redirect } from 'expo-router';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell, Input } from '@/astra';
import { useDraft } from '@/onboarding';
import { useAuth } from '@/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Email() {
  const [d, set] = useDraft();
  const { requestCode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  if (!d.firstName) return <Redirect href="/name" />;
  const valid = EMAIL_RE.test(d.email.trim());

  const next = async () => {
    setBusy(true); setErr(null); setExists(false);
    try {
      const r = await requestCode(d.email.trim(), 'signup');
      set({ devCode: r.devCode ?? '' });
      nav.push({ pathname: '/code', params: { purpose: 'signup' } });
    } catch (e: any) { setErr(e.message); setExists(e.status === 409); } finally { setBusy(false); }
  };
  return (
    <FormShell step={5} title="Your email" sub="We’ll send a 4-digit code to confirm your account."
      onBack={() => nav.back('/goal')} onNext={next} nextDisabled={!valid} nextLoading={busy} nextLabel="Send code">
      <Input label="Email" required value={d.email} onChangeText={v => { set({ email: v }); setErr(null); }} valid={valid} placeholder="example@gmail.com"
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" focusOnEnter
        returnKeyType="send" onSubmitEditing={() => valid && next()} error={err} />
      {exists ? <T size={13.5} weight="m" color={A.copper} style={{ marginTop: 10, marginLeft: 4 }} onPress={() => nav.replace('/login')}>Log in with this email instead →</T> : null}
    </FormShell>
  );
}
