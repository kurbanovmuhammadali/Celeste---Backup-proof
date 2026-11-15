import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Stethoscope } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Card, IconBubble, Tag } from '@/kit/ui';
import { DAYS, hasSchedule, todayKey3 } from '@/data/override';
import type { Override } from '@/data/override';
import { sessionById, SESSIONS } from '@/data/training';

const INTENSITY = { light: 'Keep it light', normal: 'Normal intensity', push: 'Push this week' } as const;

/** "From your flight surgeon": the message, targets, weekly schedule and extra tasks the surgeon sent. */
export function SurgeonPlan({ o }: { o: Override }) {
  const sched = hasSchedule(o);
  return (
    <Card style={{ borderWidth: 1, borderColor: K.copperSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBubble icon={Stethoscope} size={34} />
        <View style={{ flex: 1 }}><Kicker>From your flight surgeon</Kicker>{o.updatedAt ? <Txt v="caption" color={K.ink3}>Updated {o.updatedAt.slice(0, 16)} UTC</Txt> : null}</View>
        {o.intensity ? <Tag label={INTENSITY[o.intensity]} tone={o.intensity === 'light' ? 'watch' : 'ok'} /> : null}
      </View>
      {o.message ? <Txt v="sub" style={{ marginTop: 10 }}>{o.message}</Txt> : null}
      {o.resistancePerWeek || o.zone2Minutes ? (
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
          {o.resistancePerWeek ? <View><Txt v="caption" color={K.ink2}>Resistance</Txt><Txt v="headline">{o.resistancePerWeek} / week</Txt></View> : null}
          {o.zone2Minutes ? <View><Txt v="caption" color={K.ink2}>Zone 2</Txt><Txt v="headline">{o.zone2Minutes} min / week</Txt></View> : null}
        </View>
      ) : null}
      {sched ? (
        <View style={{ marginTop: 12 }}>
          <Kicker color={K.ink2}>This week</Kicker>
          {DAYS.map(d => {
            const ids = (o.week?.[d.key] ?? []).filter(id => SESSIONS.some(s => s.id === id));
            return (
              <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: K.hair }}>
                <Txt v="subM" color={d.key === todayKey3() ? K.copperInk : K.ink} style={{ width: 92 }}>{d.label}{d.key === todayKey3() ? ' · today' : ''}</Txt>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ids.length ? ids.map(id => <Tag key={id} label={`${sessionById(id).title} · ${sessionById(id).minutes} min`} onPress={() => router.push(`/training/${id}`)} />) : <Txt v="caption" color={K.ink3}>Rest</Txt>}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {o.tasks?.length ? (
        <View style={{ marginTop: 12 }}>
          <Kicker color={K.ink2}>Extra tasks</Kicker>
          {o.tasks.map((t, i) => <View key={i} style={{ marginTop: 8 }}><Txt v="subM">{t.title}</Txt>{t.detail ? <Txt v="caption" color={K.ink2}>{t.detail}</Txt> : null}</View>)}
        </View>
      ) : null}
    </Card>
  );
}
