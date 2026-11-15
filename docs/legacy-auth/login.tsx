import React, { useState } from 'react';
import { router } from 'expo-router';
import AuthShell from '@/AuthShell';
import { useAuth } from '@/auth';
import { Button, Field, Notice, T } from '@/ui';
import { C } from '@/theme';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await login(email.trim(), password); router.replace('/today'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <AuthShell title="Welcome back" sub="Sign in to see today’s readiness and your adapted plan.">
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="username" placeholder="you@agency.space" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" placeholder="••••••••" onSubmitEditing={submit} />
      <T size={13} weight="m" color={C.ink2} onPress={() => router.push('/forgot')} style={{ alignSelf: 'flex-end', marginBottom: 18, textDecorationLine: 'underline' }}>Forgot password?</T>
      {err ? <Notice kind="red" title={err} /> : null}
      <Button title="Sign in" kind="dark" loading={busy} disabled={!email || !password} onPress={submit} />
      <T size={13} color={C.ink3} center style={{ marginTop: 18 }}>New to Perigee? <T size={13} weight="m" onPress={() => router.replace('/age')} style={{ textDecorationLine: 'underline' }}>Create an account</T></T>
    </AuthShell>
  );
}
