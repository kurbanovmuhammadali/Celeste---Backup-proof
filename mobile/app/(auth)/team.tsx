import React, { useState } from 'react';
import { Redirect } from 'expo-router';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell, Input } from '@/astra';
import { useAuth } from '@/auth';
import { api } from '@/api';
import { Label, Opt, Row } from '@/OnboardingBits';

/** Last sign-up step: create or join a crew (skippable). Crew mates share the mission and are alerted together in an emergency. */
export default function Team() {
  const { user } = useAuth();
  const [mode, setMode] = useState<'join' | 'create' | 'skip'>('join');
  const [val, setVal] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState<string | null>(null);
  if (!user) return <Redirect href="/welcome" />;
  const ok = mode === 'skip' || (mode === 'join' ? val.trim().length >= 6 : val.trim().length >= 2);
  const next = async () => {
    setErr(null);
    if (mode === 'skip') return nav.replace('/done');
    setBusy(true);
    try { await api(mode === 'join' ? '/api/crew/join' : '/api/crew', { body: mode === 'join' ? { code: val } : { name: val } }); nav.replace('/done'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Your crew" sub="Crew mates share the same mission and can call each other. In an emergency, everyone is alerted at once."
      onBack={() => nav.back('/data')} onNext={next} nextDisabled={!ok} nextLoading={busy} nextLabel={mode === 'skip' ? 'Skip' : mode === 'join' ? 'Join' : 'Create'}>
      <Label>What would you like to do?</Label>
      <Row><Opt label="Join with a code" on={mode === 'join'} onPress={() => { setMode('join'); setVal(''); }} /><Opt label="Create a crew" on={mode === 'create'} onPress={() => { setMode('create'); setVal(''); }} /><Opt label="Later" on={mode === 'skip'} onPress={() => setMode('skip')} /></Row>
      {mode !== 'skip' ? <Input label={mode === 'join' ? 'Crew code' : 'Crew name'} value={val} onChangeText={v => { setVal(v); setErr(null); }} placeholder={mode === 'join' ? 'K7M-2QX' : 'Odyssey'} autoCapitalize={mode === 'join' ? 'characters' : 'words'} autoCorrect={false} error={err} /> : <T size={13.5} color={A.ink2} style={{ marginTop: 16, lineHeight: 19 }}>You can join a crew any time in Settings.</T>}
    </FormShell>
  );
}
