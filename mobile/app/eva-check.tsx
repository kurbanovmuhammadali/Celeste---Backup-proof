import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Dot, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useStore } from '@/data/store';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { createReport } from '@/data/handoff';
import { MANUAL, autoItems, evaVerdict, toggleEva } from '@/data/eva';
import type { Status } from '@/data/eva';

const TONE: Record<Status, 'ok' | 'watch' | 'flag' | 'none'> = { pass: 'ok', caution: 'watch', fail: 'flag', unknown: 'none' };

/** Pre-EVA readiness: measured items fill in themselves, equipment and clearance are ticked by the crew member. */
export default function EvaReadiness() {
  const crew = useCrew();
  const sources = useSources(crew);
  const manual = useStore(s => s.evaChecks?.[new Date().toISOString().slice(0, 10)] ?? {});
  useStore(s => s.meals); useStore(s => s.mealChecks);
  const auto = autoItems(crew);
  const { verdict, why } = evaVerdict(auto, manual);
  const tone = verdict === 'GO' ? 'ok' : verdict === 'CAUTION' ? 'watch' : 'flag';

  const send = () => {
    createReport(crew, `EVA readiness: ${verdict}`, [
      { h: 'Reason for handoff', t: `Pre-EVA readiness check result: ${verdict}. Requesting medical clearance review.` },
      { h: 'Measured checks', t: auto.map(a => `${a.label}: ${a.status.toUpperCase()} (${a.detail})`).join('\n') },
      { h: 'Crew checklist', t: MANUAL.map(m => `${manual[m.key] ? '✓' : '–'} ${m.label}`).join('\n') },
      { h: 'Open points', t: why.length ? why.join('\n') : 'None' },
    ]);
    toast('Added to Handoff'); router.navigate('/handoff');
  };
  void sources; void computeAttention;

  return (
    <Page title="EVA readiness" maxWidth={680} header={<TopBar title="EVA readiness" right={<Tag label={verdict} tone={tone} />} />} footer={<Button title="Send result to my flight surgeon" onPress={send} />}>
      <PageHead kicker="Before you go outside" title="Ready for EVA?" sub="Measured items fill in by themselves. Tick the equipment and clearance items. This is decision support: your flight surgeon clears the EVA." style={{ marginTop: 6 }} />
      <View style={{ marginTop: 14 }}><Notice tone={tone === 'ok' ? 'ok' : tone} title={verdict === 'GO' ? 'All checks pass' : verdict === 'CAUTION' ? 'Some checks are open' : 'Do not proceed without your flight surgeon'} body={why.length ? why.slice(0, 3).join('\n') : 'Every measured and manual check is done.'} /></View>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Measured</Kicker>
        {auto.map((a, i) => (
          <View key={a.key} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 6 }}>
            <View style={{ marginTop: 6 }}><Dot tone={TONE[a.status]} size={8} /></View>
            <View style={{ flex: 1 }}><Txt v="subM">{a.label}</Txt><Txt v="caption" color={K.ink2}>{a.detail}</Txt></View>
            <Tag label={a.status === 'unknown' ? 'No data' : a.status} tone={TONE[a.status]} />
          </View>
        ))}
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Your checklist</Kicker>
        {MANUAL.map((m, i) => (
          <Pressy key={m.key} label={m.label} onPress={() => toggleEva(m.key)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 4 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: manual[m.key] ? K.copper : K.ink4, backgroundColor: manual[m.key] ? K.copper : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{manual[m.key] ? <Check size={14} color="#fff" /> : null}</View>
              <Txt v="sub" style={{ flex: 1 }}>{m.label}</Txt>
            </View>
          </Pressy>
        ))}
      </Card>
    </Page>
  );
}
