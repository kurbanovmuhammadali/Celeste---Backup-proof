import React from 'react';
import { View } from 'react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Dot, PageHead, Tag, TopBar } from '@/kit/ui';
import { LineChart } from '@/kit/charts';
import { Page } from '@/kit/page';
import { levelTone, levelWord, runAction, SyntheticBanner } from '@/kit/hmsc';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { sensorConfidence } from '@/data/confidence';
import { ConfidenceRow } from '@/kit/tools';

/** Explain, then act: what changed, against which baseline, from which source, why it matters, one next step. */
export default function AttentionScreen() {
  const crew = useCrew();
  const sources = useSources(crew);
  const att = computeAttention(crew, sources);
  const conf = sensorConfidence(crew, sources);
  const tone = levelTone(att.level);

  return (
    <Page title="Attention" maxWidth={720} header={<TopBar title="Attention" />}>
      <PageHead kicker={`Mission day ${att.missionDay} · ${levelWord(att.level)}`} title={att.headline} style={{ marginTop: 6 }} />
      {crew.synthetic ? <SyntheticBanner /> : null}

      <Card style={{ marginTop: 16 }}><ConfidenceRow c={conf} full /></Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>What changed</Kicker>
        <View style={{ marginTop: 8, gap: 8 }}>
          {att.changes.map((c, i) => <View key={i} style={{ flexDirection: 'row', gap: 8 }}><View style={{ marginTop: 6 }}><Dot tone={tone} size={6} /></View><Txt v="sub" style={{ flex: 1 }}>{c}</Txt></View>)}
        </View>
      </Card>

      {att.trends.map(t => (
        <Card key={t.key} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Kicker>{`${t.label} · 14 days`}</Kicker>
            <Tag label={t.band ? `Baseline ${t.baselineDays} d` : 'Baseline building'} tone={t.band ? 'ok' : 'watch'} />
          </View>
          <Txt v="num" tabular style={{ marginTop: 6 }}>{t.today == null ? 'No value today' : `${Math.round(t.today * 10) / 10} ${t.unit}`}</Txt>
          {t.method ? <Txt v="mono" color={K.ink3} style={{ marginTop: 2 }}>{t.method}</Txt> : null}
          <View style={{ marginTop: 8 }}><LineChart values={t.values} band={t.band ?? undefined} height={92} fmt={v => `${Math.round(v * 10) / 10} ${t.unit}`} /></View>
        </Card>
      ))}
      <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>
        {att.gaps ? `Missing-data gaps stay visible: ${att.gaps} value${att.gaps > 1 ? 's' : ''} missing across these three signals in the last 14 days.` : 'No missing days in the last 14 days.'} The shaded band is your personal normal range.
      </Txt>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Personal baseline</Kicker>
        <Txt v="sub" color={K.ink2} style={{ marginTop: 6 }}>{att.baselineNote}</Txt>
        <Kicker style={{ marginTop: 14 }}>Source & last update</Kicker>
        <View style={{ marginTop: 6, gap: 4 }}>{att.sources.map((s, i) => <Txt key={i} v="caption" color={K.ink2}>{s}</Txt>)}</View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Why it matters</Kicker>
        <Txt v="sub" style={{ marginTop: 6 }}>{att.why}</Txt>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Kicker>Next step</Kicker>
        {att.actions.map((a, i) => <Button key={a.id} kind={i === 0 ? 'primary' : 'secondary'} title={a.text} onPress={() => runAction(a.id, crew, att)} />)}
      </View>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 16 }}>Not a medical device. Thresholds are illustrative.</Txt>
    </Page>
  );
}
