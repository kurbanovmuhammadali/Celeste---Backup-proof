import React, { useState } from 'react';
import { router } from 'expo-router';
import AuthShell from '@/AuthShell';
import { api } from '@/api';
import { Button, Field, Notice } from '@/ui';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try { const r = await api<{ message: string; devResetToken?: string }>('/api/auth/forgot', { body: { email } }); setMsg(r.message); setDevToken(r.devResetToken ?? null); }
    catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Reset password" sub="We’ll send a reset link to your email.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@agency.space" />
      {msg ? <Notice kind="green" title={msg} body={devToken ? 'Development mode: no mail server is configured, so you can open the reset screen directly.' : undefined}
        action={devToken ? <Button title="Open reset screen" kind="light" onPress={() => router.push({ pathname: '/reset', params: { token: devToken } })} /> : undefined} /> : null}
      <Button title="Send link" kind="dark" loading={busy} disabled={!email} onPress={submit} />
    </AuthShell>
  );
}
