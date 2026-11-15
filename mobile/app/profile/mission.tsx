import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Dumbbell, Bike, Footprints, StretchHorizontal } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt, useTween } from '@/kit/core';
import { Button, Card, Chip, IconBubble, ListGroup, ListRow, PageHead, TopBar, toast } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { dayKey, setStore, useStore } from '@/data/store';
import { useCrew } from '@/data/crew';

const DURATIONS = ['30', '90', '180', '365'];

export default function Mission() {
  const p = useStore(s => s.profile);
  const crew = useCrew();
  const [duration, setDuration] = useState(p.duration);
  const [day, setDay] = useState(crew.missionDay);
  const shown = useTween(day, 500, false);
  const pct = Math.min(1, day / Number(duration));
  const save = () => {
    setStore(s => ({ ...s, profile: { ...s.profile, duration, missionStart: dayKey(-(day - 1)) } }));
    toast('Mission settings saved');
    router.back();
  };
  return (
    <Page title="Mission & training" maxWidth={640} header={<TopBar title="Mission & training" />} footer={<Button title="Save" onPress={save} />}>
      <PageHead kicker="Plan inputs" title="Your mission" sub="Flight duration and today’s mission day set your plan and baselines." style={{ marginTop: 6 }} />
      <Card style={{ marginTop: 18 }}>
        <Kicker color={K.ink2}>Flight duration · days</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>{DURATIONS.map(d => <Chip key={d} label={`${d} days`} on={duration === d} onPress={() => { setDuration(d); setDay(x => Math.min(x, Number(d))); }} />)}</View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <View>
            <Kicker color={K.ink2}>Mission day</Kicker>
            <Txt v="display" tabular style={{ marginTop: 4 }}>{Math.round(shown)} <Txt v="sub" color={K.ink2}>/ {duration}</Txt></Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="secondary" title="−" onPress={() => setDay(d => Math.max(1, d - 1))} />
            <Button small kind="secondary" title="+" onPress={() => setDay(d => Math.min(Number(duration), d + 1))} />
          </View>
        </View>
        <View style={{ marginTop: 14 }}><Progress value={pct} height={6} /></View>
        <Txt v="mono" color={K.ink3} style={{ marginTop: 6 }}>{Math.round(pct * 100)}% COMPLETE · {Number(duration) - day} DAYS TO GO</Txt>
      </Card>
      <ListGroup kicker="Countermeasure hardware" style={{ marginTop: 14 }}>
        <ListRow icon={Bike} title="CEVIS cycle ergometer" sub="Aerobic sessions" chevron={false} />
        <ListRow icon={Dumbbell} title="ARED resistance device" sub="Strength and bone loading" chevron={false} />
        <ListRow icon={Footprints} title="T2 treadmill" sub="Harnessed running" chevron={false} />
        <ListRow icon={StretchHorizontal} title="Mobility" sub="No equipment" chevron={false} />
      </ListGroup>
      <Card sunk style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <IconBubble icon={Dumbbell} size={32} />
          <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Training personalisation uses age, sex, height, mass, flight duration and device readings. Plan changes that affect medication or load limits need flight surgeon approval.</Txt>
        </View>
      </Card>
    </Page>
  );
}
