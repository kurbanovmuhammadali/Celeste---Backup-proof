import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/auth';
import { api } from '@/api';
import { Input } from '@/astra';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Chip, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { setStore, useStore } from '@/data/store';
import { goBack } from '@/kit/transition';

const GENDERS = ['Female', 'Male', 'Prefer not to say'];

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const p = useStore(s => s.profile);
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(p.age);
  const [gender, setGender] = useState(p.gender);
  const [height, setHeight] = useState(p.height);
  const [weight, setWeight] = useState(p.weight);
  const [busy, setBusy] = useState(false);
  const num = (v: string) => v.replace(/[^0-9.]/g, '').slice(0, 5);
  const save = async () => {
    setBusy(true);
    try {
      if (name.trim() && name.trim() !== user?.name) { const r = await api<{ user: any }>('/api/account', { method: 'PUT', body: { name: name.trim() } }); setUser(r.user); }
      setStore(s => ({ ...s, profile: { ...s.profile, age, gender, height, weight } }));
      toast('Profile saved');
      goBack('/profile');
    } catch (e: any) { toast(e.message ?? 'Could not save'); } finally { setBusy(false); }
  };
  return (
    <Page title="Edit profile" maxWidth={640} header={<TopBar title="Edit profile" />} footer={<Button title="Save changes" onPress={save} loading={busy} disabled={!name.trim()} />}>
      <PageHead kicker="Crew profile" title="Personal details" sub="Used to personalise baselines and your training plan." style={{ marginTop: 6 }} />
      <Input label="Full name" value={name} onChangeText={setName} valid={name.trim().length > 1} autoCapitalize="words" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Input label="Age" value={age} onChangeText={v => setAge(num(v))} keyboardType="number-pad" valid={+age > 17} /></View>
        <View style={{ flex: 1 }}><Input label="Height · cm" value={height} onChangeText={v => setHeight(num(v))} keyboardType="decimal-pad" valid={+height > 120} /></View>
        <View style={{ flex: 1 }}><Input label="Mass · kg" value={weight} onChangeText={v => setWeight(num(v))} keyboardType="decimal-pad" valid={+weight > 35} /></View>
      </View>
      <View style={{ marginTop: 18 }}>
        <Txt v="subM" style={{ marginBottom: 8, marginLeft: 2 }}>Gender</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{GENDERS.map(g => <Chip key={g} label={g} on={gender === g} onPress={() => setGender(g)} />)}</View>
      </View>
      <Card sunk style={{ marginTop: 22 }}>
        <Kicker color={K.ink2}>Why we ask</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Age, sex, height and mass shape heart-rate zones and resistance loads. They stay in your Celeste account and are never shared without your consent.</Txt>
      </Card>
    </Page>
  );
}
