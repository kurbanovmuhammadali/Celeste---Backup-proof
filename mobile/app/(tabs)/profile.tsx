import React, { useState } from 'react';
import { Animated, View } from 'react-native';
import { router } from 'expo-router';
import { UserPen, Orbit, Presentation, ScanFace, Cable, UserCog, Siren, Phone, Users, UsersRound, FileUser, Stethoscope } from 'lucide-react-native';
import { Status } from '@/kit/settings';
import { useAuth } from '@/auth';
import { useApi } from '@/useApi';
import { ELEV, K } from '@/kit/tokens';
import { Pressy, Txt, useLayout, useLoop } from '@/kit/core';
import { ListGroup, ListRow, Tag } from '@/kit/ui';
import { Cols, Page } from '@/kit/page';
import { useStore } from '@/data/store';
import { useLive } from '@/live/Live';

type Integrations = { providers: { key: string; status: string; name?: string }[] };

function Avatar({ name }: { name: string }) {
  const spin = useLoop(20000);
  return (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 1.2, borderColor: K.copperSoft, borderStyle: 'dashed', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
      <View style={[{ width: 76, height: 76, borderRadius: 38, backgroundColor: K.copperTint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' }, ELEV.card]}>
        <Txt v="display" color={K.copper}>{name.trim().charAt(0).toUpperCase() || 'A'}</Txt>
      </View>
    </View>
  );
}

export default function Profile() {
  const { user } = useAuth();
  const { wide } = useLayout();
  const { data: integ, reload: reloadInteg } = useApi<Integrations>('/api/integrations');
  const profile = useStore(s => s.profile);
  const watch = useStore(s => !!s.devices.appleWatch);
  const face = useStore(s => !!s.face);
  const settings = useStore(s => s.settings);
  const live = useLive();
  if (!user) return null;
  const whoop = integ?.providers.some(p => (p.key === 'whoop' || p.key === 'demo') && p.status === 'connected') ?? false;

  const head = (
    <View style={{ alignItems: 'center', marginTop: 10, marginBottom: 6 }}>
      <Avatar name={user.name} />
      <Txt v="title" style={{ marginTop: 10 }}>{user.name}</Txt>
      <Txt v="sub" color={K.ink2} style={{ marginTop: 2 }}>Crew member · {profile.duration}-day mission</Txt>
      <Txt v="mono" color={K.ink3} style={{ marginTop: 4 }}>{user.email}</Txt>
    </View>
  );

  const quick = (icon: any, title: string, sub: string, onPress: () => void) => (
    <Pressy label={title} onPress={onPress} style={{ flex: 1 }}>
      <View style={{ backgroundColor: K.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: K.hair, minHeight: 92, justifyContent: 'space-between' }}>
        {React.createElement(icon, { size: 22, color: K.copper })}
        <View><Txt v="subM">{title}</Txt><Txt v="caption" color={K.ink2} numberOfLines={1}>{sub}</Txt></View>
      </View>
    </Pressy>
  );
  const left = (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {quick(Phone, 'Call doctor', live.connected ? 'Flight surgeon' : 'Connecting…', () => live.call('doctors', 'doctor', 'Flight surgeon'))}
        {quick(UsersRound, 'My crew', 'Team, concerns, pulse', () => router.push('/crew'))}
        {quick(Users, 'Family', 'Link, call, messages', () => router.push('/family'))}
      </View>
      <ListGroup kicker="Me">
        <ListRow icon={UserPen} title="Edit profile" sub="Name and personal details" onPress={() => router.push('/profile/edit')} />
        <ListRow icon={FileUser} title="Medical file" sub="CV, health conditions and files for your surgeon" onPress={() => router.push('/background')} />
        <ListRow icon={Orbit} title="Mission briefing" sub="Destination, comm delay, EVA schedule, crew" onPress={() => router.push('/profile/briefing')} />
        <ListRow icon={ScanFace} title="Face scan" sub="Crew recognition for camera tools" right={<Status on={face} onText="Saved" offText="Set up" />} onPress={() => router.push('/profile/face')} />
      </ListGroup>
    </View>
  );
  const right = (
    <View style={{ gap: 12, marginTop: wide ? 0 : 12 }}>
      <ListGroup kicker="Settings">
        <ListRow icon={Cable} title="Connected data" sub={`WHOOP ${whoop ? 'connected' : 'not connected'} · Apple Watch ${watch ? 'connected' : 'off'}`} onPress={() => router.push('/profile/connected')} />
        <ListRow icon={Presentation} title="Drills & camera" sub="Emergency drill · camera station" onPress={() => router.push('/profile/presentation')} />
        <ListRow icon={UserCog} title="Account" sub="Privacy, flight surgeon, research, sign out" onPress={() => router.push('/profile/account')} />
      </ListGroup>
      {user.admin || user.role === 'surgeon' ? <ListGroup kicker="Flight surgeon"><ListRow icon={Stethoscope} title="Surgeon console" sub="Crew overview, alerts, concerns, plans" onPress={() => router.push('/admin')} /></ListGroup> : null}
      <ListGroup kicker="Safety">
        <ListRow icon={Siren} title="Emergency protocols" sub="Offline training checklists" tone="flag" onPress={() => router.push('/emergency')} />
      </ListGroup>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 8 }}>Not a medical device · Not affiliated with NASA</Txt>
    </View>
  );

  return (
    <Page tabs title="Settings" maxWidth={980} header={<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="headline">Settings</Txt><Tag label="Crew account" /></View>}>
      {head}
      <Cols gap={16} style={{ marginTop: 14 }}>{left}{right}</Cols>
    </Page>
  );
}
