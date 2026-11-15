import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Dumbbell, Bike, StretchHorizontal, LayoutGrid, Check } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Swap, Txt, useLayout } from '@/kit/core';
import { Button, Card, Chip, ChipRow, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { SessionHero, SessionRow } from '@/kit/training';
import { SESSIONS, doneToday, sessionById } from '@/data/training';
import { todaySessionId, useOverride } from '@/data/override';
import { useCrew } from '@/data/crew';
import { useStore } from '@/data/store';

const CATS = [{ k: 'all', l: 'All', i: LayoutGrid }, { k: 'resistance', l: 'Resistance', i: Dumbbell }, { k: 'aerobic', l: 'Aerobic', i: Bike }, { k: 'mobility', l: 'Mobility', i: StretchHorizontal }] as const;

export default function Sets() {
  useStore(s => s.completed);
  const crew = useCrew();
  const { gutter, wide } = useLayout();
  const [cat, setCat] = useState<(typeof CATS)[number]['k']>('all');
  const override = useOverride();
  const TODAY_SESSION = todaySessionId(override);
  const today = sessionById(TODAY_SESSION);
  const list = SESSIONS.filter(s => cat === 'all' || s.category === cat);
  return (
    <Page title="Workout sets" maxWidth={820} header={<TopBar title="Workout sets" right={<Tag label={`Day ${crew.missionDay}`} />} />}
      footer={<Button title={`View ${today.title.toLowerCase()}`} icon={ArrowRight} onPress={() => router.push(`/training/${today.id}`)} />}>
      <View style={{ marginTop: 8 }}><SessionHero s={today} kicker="Today’s session" done={doneToday(today.id)} onPress={() => router.push(`/training/${today.id}`)} height={wide ? 280 : 200} /></View>
      <Txt v="title" style={{ marginTop: 24, marginBottom: 10, fontSize: 19 }}>Categories</Txt>
      <ChipRow gutter={gutter}>{CATS.map(c => <Chip key={c.k} label={c.l} icon={c.i} on={cat === c.k} onPress={() => setCat(c.k)} />)}</ChipRow>
      <Txt v="title" style={{ marginTop: 24, marginBottom: 10, fontSize: 19 }}>Workout list</Txt>
      <Swap k={cat}>
        <Card pad={4}>
          {list.map((s, i) => (
            <View key={s.id}>
              {i ? <View style={{ height: 1, backgroundColor: K.hair, marginLeft: 78 }} /> : null}
              <SessionRow s={s} onPress={() => router.push(`/training/${s.id}`)} right={
                doneToday(s.id) ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Check size={13} color={K.ok} strokeWidth={3} /><Txt v="caption" color={K.ok}>Done</Txt></View>
                  : <View style={{ alignItems: 'flex-end' }}><Txt v="subM" tabular>{s.minutes} min</Txt><Txt v="caption" color={s.id === TODAY_SESSION ? K.copperInk : K.ink3}>{s.id === TODAY_SESSION ? 'Today' : 'Planned'}</Txt></View>
              } />
            </View>
          ))}
        </Card>
      </Swap>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 18 }}>Training imagery courtesy of NASA</Txt>
    </Page>
  );
}
