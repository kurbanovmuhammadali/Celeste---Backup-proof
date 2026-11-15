/**
 * EVA readiness check: four gates from today's data (sleep, heart/HRV, dose, red symptoms).
 * Gates tick in one by one; any failed gate says who to talk to and why.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { router } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { K, MOTION, native } from '@/kit/tokens';
import { Txt, useFocusTick } from '@/kit/core';
import { Button, Card, PageHead, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useMission, type Gate } from '@/data/mission';

function GateRow({ g, i }: { g: Gate; i: number }) {
  const tick = useFocusTick();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { a.setValue(0); Animated.spring(a, { toValue: 1, delay: 250 + i * 260, useNativeDriver: native, speed: 12, bounciness: 12 }).start(); }, [tick]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
      <Animated.View style={{ width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: g.ok ? K.ok : K.flag, transform: [{ scale: a }], opacity: a }}>
        {g.ok ? <Check size={16} color="#fff" strokeWidth={3} /> : <X size={16} color="#fff" strokeWidth={3} />}
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Txt v="subM">{g.label}</Txt>
        <Txt v="caption" color={K.ink2}>{g.why}</Txt>
      </View>
      <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9 }}>{g.source}</Txt>
    </View>
  );
}

export default function Eva() {
  const m = useMission();
  const fails = m.gates.filter(g => !g.ok);
  const ready = fails.length === 0;
  const when = m.nextEva ? new Date(m.nextEva + 'T08:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : null;
  return (
    <Page title="EVA readiness" maxWidth={640} header={<TopBar title="EVA readiness" />}>
      <PageHead kicker={when ? `Next EVA · ${when} · 08:00` : 'No EVA scheduled'} title={ready ? 'Ready for the spacewalk' : 'Not ready yet'}
        sub={ready ? 'All four checks pass on today’s data.' : `${fails.length} of 4 checks ${fails.length === 1 ? 'needs' : 'need'} the flight surgeon.`} style={{ marginTop: 6 }} />
      <Card style={{ marginTop: 16, paddingVertical: 4 }}>{m.gates.map((g, i) => <GateRow key={g.label} g={g} i={i} />)}</Card>
      {!ready ? <Button title="Prepare a note for the flight surgeon" onPress={() => router.push('/report')} style={{ marginTop: 14 }} /> : null}
      <Button kind="secondary" title="Full pre-EVA checklist (equipment, clearance)" onPress={() => router.push('/eva-check')} style={{ marginTop: 10 }} />
      <Txt v="caption" color={K.ink3} style={{ marginTop: 14 }}>Readiness support for the crew, not a medical clearance. The flight surgeon makes the final call.</Txt>
    </Page>
  );
}
