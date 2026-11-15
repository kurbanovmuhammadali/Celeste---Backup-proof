import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Radiation, ChevronRight, Info } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Swap, Txt, useLayout, useTween } from '@/kit/core';
import { Card, IconBubble, PageHead, Segmented, Tag, TopBar } from '@/kit/ui';
import { Gauge, LineChart, Progress } from '@/kit/charts';
import { Cols, Page } from '@/kit/page';
import { fmtSleep, useCrew } from '@/data/crew';

type Sig = 'rhr' | 'hrv' | 'sleep';
const SIG: Record<Sig, { label: string; unit: string; fmt: (v: number) => string; src: string }> = {
  rhr: { label: 'Resting heart rate', unit: 'bpm', fmt: v => `${Math.round(v)} bpm`, src: 'WHOOP' },
  hrv: { label: 'Heart-rate variability', unit: 'ms', fmt: v => `${Math.round(v)} ms`, src: 'WHOOP' },
  sleep: { label: 'Sleep duration', unit: 'h', fmt: v => fmtSleep(v), src: 'WHOOP' },
};

export default function Signals() {
  const crew = useCrew();
  const { wide } = useLayout();
  const [sig, setSig] = useState<Sig>('rhr');
  const [scrub, setScrub] = useState<number | null>(null);
  const today = crew.days[6];
  const vals = crew.series[sig];
  const nums = vals.filter((v): v is number => v != null);
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  const band: [number, number] = [avg * 0.95, avg * 1.05];
  const shown = scrub != null ? vals[scrub] : vals[6];
  const total = useTween(crew.doseTotal ?? 0, 1200);
  const limit = 50; // illustrative annual-style reference for the bar only
  const range = `${crew.days[0].short} – ${crew.days[6].short}`;

  const recovery = (
    <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
      <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Kicker color={K.ink2}>Recovery</Kicker><Txt v="mono" color={K.ink3} upper>{crew.source.recovery === 'sample' ? 'WHOOP · sample' : crew.source.recovery}</Txt>
      </View>
      <Gauge value={today.recovery} label="WHOOP recovery" sub={today.recovery != null ? (today.recovery >= 67 ? 'READY TO PERFORM' : today.recovery >= 34 ? 'MAINTAIN · TAKE IT STEADY' : 'PRIORITISE REST') : undefined} />
      <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 6 }}>
        {[['Sleep', fmtSleep(today.sleep)], ['HRV', today.hrv != null ? `${Math.round(today.hrv)} ms` : '—'], ['Resting HR', today.rhr != null ? `${Math.round(today.rhr)} bpm` : '—']].map(([k, v], i) => (
          <View key={k} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: K.hair }}>
            <Txt v="caption" color={K.ink2}>{k}</Txt><Txt v="subM" tabular style={{ marginTop: 2 }}>{v}</Txt>
          </View>
        ))}
      </View>
    </Card>
  );

  const trend = (
    <Card style={{ marginTop: 12 }}>
      <Segmented value={sig} onChange={k => { setSig(k); setScrub(null); }} options={[{ key: 'rhr', label: 'Heart' }, { key: 'hrv', label: 'HRV' }, { key: 'sleep', label: 'Sleep' }]} />
      <Swap k={sig}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16 }}>
          <View>
            <Txt v="subM">{SIG[sig].label}</Txt>
            <Txt v="caption" color={K.ink2}>{scrub != null ? crew.days[scrub].label : 'Today'} · band = your 7-day baseline</Txt>
          </View>
          <Txt v="title" tabular>{shown == null ? '—' : SIG[sig].fmt(shown)}</Txt>
        </View>
        <View style={{ marginTop: 10 }}>
          <LineChart values={vals} band={band} labels={crew.days.map(d => d.short)} fmt={SIG[sig].fmt} onScrub={setScrub} />
        </View>
        <Txt v="mono" color={K.ink3} upper style={{ marginTop: 2 }}>{SIG[sig].src} · {range} · drag to inspect</Txt>
      </Swap>
    </Card>
  );

  const dose = (
    <Card style={{ marginTop: wide ? 0 : 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconBubble icon={Radiation} />
        <View style={{ flex: 1 }}>
          <Kicker color={K.ink2}>Radiation · whole-person exposure</Kicker>
          <Txt v="caption" color={K.ink3} style={{ marginTop: 2 }}>Personal dosimeter · {today.short}</Txt>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color={K.ink2}>Latest daily dose</Txt>
          <Txt v="title" tabular style={{ marginTop: 2 }}>{today.dose?.toFixed(2) ?? '—'} <Txt v="sub" color={K.ink2}>mSv</Txt></Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="caption" color={K.ink2}>Mission total</Txt>
          {crew.doseTotal == null ? <Txt v="subM" style={{ marginTop: 6 }}>Cumulative dose unavailable</Txt> : <Txt v="title" tabular style={{ marginTop: 2 }}>{total.toFixed(1)} <Txt v="sub" color={K.ink2}>mSv</Txt></Txt>}
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <Progress value={crew.doseTotal == null ? 0 : Math.min(1, crew.doseTotal / limit)} height={6} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Txt v="mono" color={K.ink3}>DAY 1</Txt><Txt v="mono" color={K.ink3}>DAY {crew.missionDay} OF {crew.duration}</Txt>
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        <LineChart values={crew.series.dose} labels={crew.days.map(d => d.short)} height={80} fmt={v => `${v.toFixed(2)} mSv`} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, padding: 10, borderRadius: 12, backgroundColor: K.cardSunk }}>
        <Info size={14} color={K.ink2} style={{ marginTop: 1 }} />
        <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Radiation readings are shown separately from body findings. Cabin monitors are not your personal dose.</Txt>
      </View>
    </Card>
  );

  return (
    <Page title="Health signals" header={<TopBar title="Body analytics" right={<Tag label={range} />} />}>
      <PageHead kicker="Recorded signals" title="Health signals" sub="Read each signal with its source." style={{ marginTop: 6 }} />
      <Cols gap={20} style={{ marginTop: 18 }}>
        <View>{recovery}{trend}</View>
        <View>
          {dose}
          <Card onPress={() => router.push('/metric/recovery')} label="Full history" style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Txt v="subM" style={{ flex: 1 }}>Full history and data sources</Txt><ChevronRight size={17} color={K.ink3} /></View>
          </Card>
        </View>
      </Cols>
    </Page>
  );
}
