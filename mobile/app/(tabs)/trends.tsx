import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Clock, Settings } from 'lucide-react-native';
import { useApi } from '@/useApi';
import { C } from '@/theme';
import { Chip, DotMatrix, FadeIn, IconBtn, Loading, Row, Screen, Segmented, StatusDot, T, useWide } from '@/ui';

const PICK = [
  { k: 'recovery', l: 'Recovery' }, { k: 'hrv', l: 'HRV' }, { k: 'sleep', l: 'Sleep' }, { k: 'strain', l: 'Strain' },
  { k: 'rhr', l: 'Resting HR' }, { k: 'mood', l: 'Mood' }, { k: 'exercise', l: 'Exercise' }, { k: 'bp', l: 'BP' }, { k: 'ntx', l: 'Bone NTx' }, { k: 'weight', l: 'Mass' },
];
const DN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Trends() {
  const [metric, setMetric] = useState('recovery');
  const [range, setRange] = useState<'week' | 'month'>('week');
  const days = range === 'week' ? 7 : 30;
  const { data } = useApi<any>(`/api/metrics/${metric}?days=${days}`);
  const wide = useWide();
  const series: { day: string; value: number }[] = data?.series ?? [];
  const vals = series.map(p => p.value);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const maxI = vals.length ? vals.indexOf(Math.max(...vals)) : -1;
  const minI = vals.length ? vals.indexOf(Math.min(...vals)) : -1;
  const fmt = (v: number | null) => (v == null ? '—' : Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : (Math.round(v * 10) / 10).toString());
  const dayLabel = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short' });

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <IconBtn label="History" onPress={() => router.push(`/metric/${metric}`)}><Clock size={19} color={C.ink} /></IconBtn>
        <T size={17} weight="m">Trends</T>
        <IconBtn label="Data sources" onPress={() => router.push('/integrations')}><Settings size={19} color={C.ink} /></IconBtn>
      </Row>
      <View style={{ marginTop: 16 }}>
        <Segmented value={range} onChange={setRange} options={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -20 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {PICK.map(p => <Chip key={p.k} label={p.l} on={metric === p.k} onPress={() => setMetric(p.k)} />)}
      </ScrollView>

      {!data ? <Loading /> : (
        <FadeIn key={metric + range}>
          <View style={{ alignItems: 'center', marginTop: 22 }}>
            <T size={wide ? 120 : 92} weight="m">{fmt(avg)}</T>
            <T size={18} weight="m" style={{ marginTop: 2 }}>{data.info.label}{data.info.unit ? ` · ${data.info.unit}` : ''}</T>
            <T size={13} color={C.ink3} style={{ marginTop: 4 }}>{range === 'week' ? '7-day' : '30-day'} average · baseline {fmt(data.snapshot.baseline)}</T>
            <View style={{ marginTop: 6 }}><StatusDot status={data.snapshot.status} /></View>
          </View>

          <View style={{ marginTop: 24, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              {minI >= 0 ? <T size={15} weight="m">Low · {dayLabel(series[minI].day)}: {fmt(vals[minI])}</T> : <View />}
              {maxI >= 0 ? <T size={15} weight="m">High · {dayLabel(series[maxI].day)}: {fmt(vals[maxI])}</T> : <View />}
            </Row>
            {vals.length ? (
              <DotMatrix values={vals} rows={range === 'week' ? 14 : 12} height={range === 'week' ? 300 : 240} highlight={vals.length - 1}
                labels={series.map(p => (range === 'week' ? DN[new Date(p.day + 'T12:00:00Z').getUTCDay()] : (new Date(p.day + 'T12:00:00Z').getUTCDate() % 5 === 0 ? String(new Date(p.day + 'T12:00:00Z').getUTCDate()) : '')))} />
            ) : <T color={C.ink3} center style={{ marginTop: 40 }}>No data in this range yet.</T>}
          </View>
          <T size={13} color={C.ink2} center style={{ marginTop: 18, maxWidth: 520, alignSelf: 'center' }}>{data.info.space}</T>
        </FadeIn>
      )}
    </Screen>
  );
}
