/**
 * Real NASA research layer — Inspiration4 (2021, 3-day orbital flight) complete blood counts, kept apart from
 * the crew member's own data and labelled as research with pre/post-flight limits.
 * The dataset is NOT bundled yet: drop the NASA OSDR export into assets/research/inspiration4-cbc.json
 * ({ rows: [{ marker, unit, pre, post, refLow, refHigh }] }) and it renders here. No numbers are invented.
 */
import React from 'react';
import { View } from 'react-native';
import { FlaskConical } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { router } from 'expo-router';
import { Button, Card, IconBubble, Notice, PageHead, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';

type Row = { marker: string; unit: string; pre: number; post: number; refLow: number; refHigh: number };
let DATA: { rows: Row[]; source?: string } | null = null;
try { DATA = require('../assets/research/inspiration4-cbc.json'); } catch { DATA = null; }

export default function Research() {
  return (
    <Page title="NASA research" maxWidth={680} header={<TopBar title="NASA research" />}>
      <PageHead kicker="Real NASA research data" title="Inspiration4 blood counts" sub="Public research from a 3-day orbital flight (2021). Shown for context next to — never mixed with — your own readings." style={{ marginTop: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: '#E3ECF8' }}>
        <Txt v="mono" color="#3F6797" style={{ fontSize: 9.5 }}>NASA OSDR · RESEARCH · NOT YOUR DATA</Txt>
      </View>
      {DATA?.rows?.length ? (
        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          {DATA.rows.map((r, i) => (
            <View key={r.marker} style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="subM">{r.marker}</Txt><Txt v="caption" color={K.ink3}>ref {r.refLow}–{r.refHigh} {r.unit}</Txt></View>
              <Txt v="sub" color={K.ink2}>Pre-flight {r.pre} → post-flight {r.post} {r.unit}</Txt>
            </View>
          ))}
        </Card>
      ) : (
        <View style={{ marginTop: 14 }}>
          <Notice tone="watch" title="Dataset not bundled yet" body="Add the Inspiration4 complete-blood-count export from NASA’s Open Science Data Repository to show real pre- and post-flight values here." />
        </View>
      )}
      <Card sunk style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <IconBubble icon={FlaskConical} size={32} />
          <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Limits: four civilian crew, a 3-day flight in low Earth orbit, samples before and after flight only. Useful as research context, not as reference ranges for a long-duration mission.</Txt>
        </View>
      </Card>
      <Button kind="secondary" title="See every marker over time (charts)" onPress={() => router.push('/research-data')} style={{ marginTop: 12 }} />
      <Kicker color={K.ink3} style={{ marginTop: 14 }}>{DATA?.source ?? 'Source: NASA Open Science Data Repository (OSDR)'}</Kicker>
    </Page>
  );
}
