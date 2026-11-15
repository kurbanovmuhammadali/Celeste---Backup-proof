import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Play, PersonStanding, Gauge, Wind } from 'lucide-react-native';
import Svg, { Circle, SvgXml } from 'react-native-svg';
import { MUSCLE_SVG } from '@/art';
import { K } from '@/kit/tokens';
import { Kicker, Rise, Txt } from '@/kit/core';
import { Button, Card, IconBubble, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { StatPair, deviceIcon } from '@/kit/training';
import { sessionById } from '@/data/training';

function Muscle({ name, i }: { name: string; i: number }) {
  return (
    <Rise i={i} scale style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={58} height={58} style={{ position: 'absolute' }}><Circle cx={29} cy={29} r={27} stroke={K.copperSoft} strokeWidth={1.2} strokeDasharray="3 4" fill="rgba(246,228,217,0.6)" /></Svg>
        {MUSCLE_SVG[name] ? <SvgXml xml={MUSCLE_SVG[name]} width={40} height={40} /> : <PersonStanding size={24} color={K.copper} strokeWidth={1.7} />}
      </View>
      <Txt v="caption" color={K.ink2} style={{ marginTop: 6 }}>{name}</Txt>
    </Rise>
  );
}

export default function Setup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = sessionById(id);
  const groups = ['Warm-up', 'Main session', 'Cool-down'] as const;
  return (
    <Page title="Exercise setup" maxWidth={720} header={<TopBar title="Exercise setup" right={<Tag label={s.title} />} />}
      footer={<Button title="Start workout" icon={Play} onPress={() => router.push({ pathname: '/training/active', params: { id: s.id } })} />}>
      <View style={{ marginTop: 8 }}><StatPair items={[[`${s.minutes} min`, 'Planned time'], [s.device, 'Equipment']]} /></View>
      <Kicker style={{ marginTop: 22 }}>Target muscles</Kicker>
      <View style={{ flexDirection: 'row', marginTop: 12 }}>{s.muscles.map((m, i) => <Muscle key={m} name={m} i={i} />)}</View>
      {groups.filter(g => s.phases.some(p => p.group === g)).map(g => (
        <Card key={g} style={{ marginTop: 14 }} pad={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 }}>
            <Txt v="headline">{g}</Txt>
            {g === 'Warm-up' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 22, borderRadius: 11, backgroundColor: K.okTint }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: K.ok }} /><Txt v="caption" color={K.ok}>Included</Txt></View> : null}
          </View>
          {s.phases.filter(p => p.group === g).map((p, k) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
              <IconBubble icon={g === 'Warm-up' ? Gauge : g === 'Cool-down' ? Wind : deviceIcon(s)} size={34} />
              <View style={{ flex: 1 }}>
                <Txt v="subM">{p.title}</Txt>
                <Txt v="caption" color={K.ink2}>{p.target ? `${p.sub} · ${p.target}` : p.sub}</Txt>
              </View>
              <Txt v="mono" color={K.ink3}>{p.min} MIN</Txt>
            </View>
          ))}
        </Card>
      ))}
    </Page>
  );
}
