import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import AuthShell from '@/AuthShell';
import { api } from '@/api';
import { Button, Field, Notice } from '@/ui';

export default function Reset() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const submit = async () => {
    try { await api('/api/auth/reset', { body: { token, password: pw } }); setOk(true); } catch (e: any) { setErr(e.message); }
  };
  return (
    <AuthShell title="New password" sub="Choose a new password. All other sessions will be signed out.">
      {ok ? <><Notice kind="green" title="Password updated" /><Button title="Sign in" kind="dark" onPress={() => router.replace('/login')} /></> : <>
        <Field label="New password" value={pw} onChangeText={setPw} secureTextEntry placeholder="8+ characters, a letter and a number" />
        {err ? <Notice kind="red" title={err} /> : null}
        <Button title="Update password" kind="dark" disabled={!pw || !token} onPress={submit} />
      </>}
    </AuthShell>
  );
}
