import React, { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { router } from 'expo-router';
import { Download, FileText, Lock, Cookie, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/auth';
import { api, API_URL } from '@/api';
import { Input } from '@/astra';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button, ListGroup, ListRow, Notice, PageHead, Sheet, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';

export default function Privacy() {
  const { user, logout } = useAuth();
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const exportData = async () => {
    if (Platform.OS === 'web') { window.open(`${API_URL}/api/account/export`, '_blank'); return; }
    const data = await api('/api/account/export');
    await Share.share({ title: 'Celeste export', message: JSON.stringify(data, null, 2) });
  };
  const deleteAccount = async () => {
    setBusy(true);
    try { await api('/api/account', { method: 'DELETE', body: user.passwordless ? { confirm: pw } : { password: pw } }); await logout(); router.replace('/welcome'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Page title="Privacy" maxWidth={640} header={<TopBar title="Privacy & account" />}>
      <PageHead kicker="Account" title="Privacy controls" sub="Your health data belongs to you. Export it or delete it at any time." style={{ marginTop: 6 }} />
      <ListGroup kicker="Your data" style={{ marginTop: 18 }}>
        <ListRow icon={Download} title="Export my data" sub="Measurements, check-ins and consents as JSON" onPress={exportData} />
      </ListGroup>
      <ListGroup kicker="Policies" style={{ marginTop: 12 }}>
        <ListRow icon={FileText} title="Terms of Use" onPress={() => router.push('/legal/terms')} />
        <ListRow icon={Lock} title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
        <ListRow icon={Cookie} title="Cookie Policy" onPress={() => router.push('/legal/cookies')} />
      </ListGroup>
      <ListGroup kicker="Danger zone" style={{ marginTop: 12 }}>
        <ListRow icon={Trash2} title="Delete account" sub="Permanently erase your account and health data" danger onPress={() => setDel(true)} />
      </ListGroup>
      <Sheet open={del} onClose={() => setDel(false)} kicker="Delete account" title="This cannot be undone">
        <Notice tone="flag" title="All measurements, check-ins, connections and consents are erased." body="Export your data first if you want a copy." />
        {user.passwordless
          ? <Input label={`Type ${user.email} to confirm`} value={pw} onChangeText={setPw} autoCapitalize="none" keyboardType="email-address" error={err} />
          : <Input label="Confirm with your password" value={pw} onChangeText={setPw} secureTextEntry error={err} />}
        <Button title="Delete forever" kind="danger" disabled={!pw} loading={busy} onPress={deleteAccount} style={{ marginTop: 18 }} />
        <Txt v="caption" color={K.ink3} center style={{ marginTop: 10 }}>You’ll be signed out immediately.</Txt>
      </Sheet>
    </Page>
  );
}
