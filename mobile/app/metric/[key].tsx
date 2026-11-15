import React, { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useApi } from '@/useApi';
import { C, statusColor } from '@/theme';
import { Button, Card, DotMatrix, Header, Loading, Row, Screen, Segmented, StatusDot, T, useWide } from '@/ui';
import { PageSkeleton } from '@/kit/ui';
import { Rise } from '@/kit/core';

export default function MetricDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const [days, setDays] = useState<'7' | '30'>('30');
  const { data, error } = useApi<any>(`/api/metrics/${key}?days=${days}`);
  const wide = useWide();
  if (error) return <Screen><Header title="Metric" back /><T>{error}</T></Screen>;
  if (!data) return <PageSkeleton tabs={false} />;
  const s = data.snapshot, info = data.info;
  const val = s.value == null ? '—' : s.value2 != null ? `${s.value}/${s.value2}` : s.value;
  const manual = ['bp', 'glucose', 'temp', 'weight', 'ntx', 'vitd', 'radiation', 'co2'].includes(key!);

  return (
    <Screen bottomSpace={40}>
      <Rise from={22}>
      <Header title={info.label} back sub={`Source · ${s.source ?? info.source}`} />
      <View style={wide ? { flexDirection: 'row', gap: 24 } : undefined}>
        <View style={wide ? { flex: 1 } : undefined}>
          <View style={{ alignItems: 'center' }}>
            <Row gap={6} style={{ alignItems: 'flex-end' }}>
              <T size={96} weight="m" color={C.ink}>{val}</T>
              <T size={20} color={C.ink3} style={{ marginBottom: 16 }}>{info.unit}</T>
            </Row>
            <StatusDot status={s.status} size={14} />
            <T size={13} color={C.ink3} style={{ marginTop: 6 }}>
              Baseline {s.baseline ?? '—'} {info.unit}{s.deviation != null ? ` · ${s.deviation > 0 ? '+' : ''}${s.deviation}% vs baseline` : ''}{s.stale ? ' · older than 3 days' : ''}
            </T>
          </View>
          <View style={{ marginTop: 18 }}>
            <Segmented value={days} onChange={setDays} options={[{ key: '7', label: '7 days' }, { key: '30', label: '30 days' }]} />
          </View>
          <View style={{ marginTop: 14 }}>
            {data.series.length ? <DotMatrix values={data.series.map((p: any) => p.value)} rows={12} height={days === '7' ? 240 : 200} highlight={data.series.length - 1} /> : <T color={C.ink3} center>No data yet.</T>}
          </View>
          {manual && <Button title={`Log ${info.label.toLowerCase()}`} kind="coral" icon={<Plus size={18} color="#fff" />} onPress={() => router.push({ pathname: '/log', params: { metric: key } })} style={{ marginTop: 18 }} />}
        </View>
        <View style={wide ? { flex: 1 } : { marginTop: 20 }}>
          <Card style={{ marginBottom: 12 }}>
            <T size={12} weight="m" color={C.ink3} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>What it is</T>
            <T size={15} style={{ marginTop: 6 }}>{info.what}</T>
          </Card>
          <Card style={{ marginBottom: 12 }} tint={C.coralTint}>
            <T size={12} weight="m" color={C.coral} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>Why it matters in space</T>
            <T size={15} style={{ marginTop: 6 }}>{info.space}</T>
          </Card>
          <Card style={{ marginBottom: 12 }}>
            <T size={12} weight="m" color={C.ink3} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>How to measure</T>
            <T size={15} style={{ marginTop: 6 }}>{info.how}</T>
          </Card>
          <Card>
            <T size={16} weight="m" style={{ marginBottom: 8 }}>Recent readings</T>
            {data.recent.slice(0, 8).map((r: any) => (
              <Row key={r.id} style={{ justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <T size={13} color={C.ink2}>{r.recorded_at.slice(0, 16)}</T>
                <Row gap={6}><T size={14} weight="m">{r.value2 != null ? `${r.value}/${r.value2}` : r.value}</T><T size={11} color={C.ink3}>{r.source}</T></Row>
              </Row>
            ))}
            {!data.recent.length && <T size={13} color={C.ink3}>Nothing logged yet.</T>}
          </Card>
        </View>
      </View>
      </Rise>
    </Screen>
  );
}
