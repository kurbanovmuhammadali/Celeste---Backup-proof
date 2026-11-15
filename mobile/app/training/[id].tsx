import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, ChevronRight, Play } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt, useLayout } from '@/kit/core';
import { Button, Card, IconBubble, Tag, TopBar } from '@/kit/ui';
import { Cols, Page } from '@/kit/page';
import { SessionHero, StatPair, deviceIcon } from '@/kit/training';
import { sessionById } from '@/data/training';
import { DeviceNotice } from '@/kit/hmsc';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = sessionById(id);
  const { wide } = useLayout();
  const groups = ['Warm-up', 'Main session', 'Cool-down'] as const;
  return (
    <Page title={s.title} maxWidth={980} header={<TopBar title="Session detail" right={<Tag label={s.device} />} />}
      footer={<Button title="Review exercises" icon={ArrowRight} onPress={() => router.push({ pathname: '/training/setup', params: { id: s.id } })} />}>
      <View style={{ marginTop: 8 }}><DeviceNotice short /></View>
      <Cols gap={24} style={{ marginTop: 14 }}>
        <View>
          <SessionHero minimal s={s} kicker={s.credit ? `Station exercise · ${s.credit}` : 'Crew exercise'} height={wide ? 400 : 240} />
        </View>
        <View style={{ marginTop: wide ? 0 : 18 }}>
          <Kicker>{s.kind}</Kicker>
          <Txt v="display" style={{ marginTop: 4 }}>{s.title}</Txt>
          <View style={{ marginTop: 14 }}><StatPair items={[[`${s.minutes} min`, 'Planned time'], [`${s.phases.length} phases`, 'Session blocks']]} /></View>
          <Txt v="body" color={K.ink2} style={{ marginTop: 14 }}>{s.blurb}</Txt>
          <Txt v="title" style={{ marginTop: 22, marginBottom: 10, fontSize: 19 }}>Session blocks</Txt>
          <Card pad={0}>
            {groups.filter(g => s.phases.some(p => p.group === g)).map((g, gi) => {
              const ps = s.phases.filter(p => p.group === g);
              return (
                <View key={g} style={{ borderTopWidth: gi ? 1 : 0, borderTopColor: K.hair, padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <IconBubble icon={g === 'Main session' ? deviceIcon(s) : Play} size={34} />
                    <View style={{ flex: 1 }}>
                      <Txt v="subM">{ps.map(p => p.title).join(' · ')}</Txt>
                      <Txt v="caption" color={K.ink2}>{g} · {ps.reduce((a, p) => a + p.min, 0)} min</Txt>
                    </View>
                    <ChevronRight size={16} color={K.ink3} />
                  </View>
                </View>
              );
            })}
          </Card>
        </View>
      </Cols>
    </Page>
  );
}
