import React from 'react';
import { Linking, View } from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Notice, PageHead, Tag, TopBar } from '@/kit/ui';
import { LineChart } from '@/kit/charts';
import { Page } from '@/kit/page';
import { INSPIRATION4 as D } from '@/data/inspiration4';

const URL = 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-569';
const fmt = (v: number, unit: string) => `${v >= 100 ? Math.round(v) : Math.round(v * 100) / 100} ${unit}`;

/** Real astronaut research data: the Inspiration4 crew's complete blood count, before and after flight. */
export default function Research() {
  return (
    <Page title="Real NASA data" maxWidth={720} header={<TopBar title="Real NASA data" />}>
      <PageHead kicker="Real astronaut research data" title="Inspiration4 blood counts" sub="NASA OSDR dataset OSD-569: four crew members, a 3-day orbital flight in September 2021, complete blood count measured before and after." style={{ marginTop: 6 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}><Tag label="Real research data" tone="ok" /><Tag label="De-identified" /><Tag label={`${D.crew} crew`} /></View>

      {D.markers.map(m => (
        <Card key={m.key} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Kicker>{m.label}</Kicker>
            <Txt v="mono" color={K.ink3}>{m.unit}</Txt>
          </View>
          <View style={{ marginTop: 8 }}>
            <LineChart values={[...m.mean]} band={m.refMin != null && m.refMax != null ? [m.refMin, m.refMax] : undefined} height={96} labels={['L-92', 'R+194']} fmt={v => fmt(v, m.unit)} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {D.timepoints.map(t => <Txt key={t} v="mono" color={K.ink3} style={{ fontSize: 8.5 }}>{t}</Txt>)}
          </View>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>
            Crew mean per time point; individual range at R+1: {fmt(m.min[3], m.unit)} to {fmt(m.max[3], m.unit)}. Shaded band is the lab reference range{m.refMin != null ? ` (${fmt(m.refMin, m.unit)} – ${fmt(m.refMax!, m.unit)})` : ''}.
          </Txt>
        </Card>
      ))}

      <View style={{ marginTop: 14 }}>
        <Notice tone="watch" title="How HMSC uses this" body="It shows how real crews' blood markers move across a flight and how a baseline is compared with later values. It is research context only, not a prediction or diagnosis for you." />
      </View>
      <View style={{ marginTop: 12 }}><Button kind="secondary" icon={ExternalLink} title="Open dataset on NASA OSDR" onPress={() => Linking.openURL(URL)} /></View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>L = days before launch, R = days after return. Values aggregated from file LSDS-7_Complete_Blood_Count_CBC_TRANSFORMED.csv in OSD-569. NASA does not endorse this app.</Txt>
    </Page>
  );
}
