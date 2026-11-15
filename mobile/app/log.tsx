import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { HeartPulse, Droplet, Thermometer, Scale, FlaskConical, Radiation, Wind, Bone } from 'lucide-react-native';
import { api } from '@/api';
import { C, statusColor, statusWord } from '@/theme';
import { Button, Card, Field, Header, Notice, Row, Screen, T, Chip } from '@/ui';

const OPTIONS = [
  { k: 'bp', l: 'Blood pressure', unit: 'mmHg', icon: HeartPulse, dual: ['Systolic', 'Diastolic'], ph: ['120', '80'], tip: 'Sit quietly 5 min, cuff at heart level, 2 readings 1 min apart.' },
  { k: 'glucose', l: 'Glucose', unit: 'mg/dL', icon: Droplet, ph: ['92'], tip: 'Fasting finger-prick. Clean, dry finger; discard the first drop.' },
  { k: 'temp', l: 'Body temp', unit: '°C', icon: Thermometer, ph: ['36.8'], tip: 'At rest, not within 30 min of exercise or a hot drink.' },
  { k: 'weight', l: 'Body mass', unit: 'kg', icon: Scale, ph: ['78.2'], tip: 'Same time each day, after waking. On ISS use the SLAMMD device.' },
  { k: 'ntx', l: 'Bone NTx', unit: 'nmol/mmol', icon: Bone, ph: ['38'], tip: 'From the lab result of your second-void morning urine sample.' },
  { k: 'vitd', l: 'Vitamin D', unit: 'ng/mL', icon: FlaskConical, ph: ['32'], tip: 'From your latest blood panel.' },
  { k: 'radiation', l: 'Radiation', unit: 'mSv', icon: Radiation, ph: ['0.6'], tip: 'Daily dose from your personal dosimeter.' },
  { k: 'co2', l: 'Cabin CO₂', unit: 'mmHg', icon: Wind, ph: ['2.5'], tip: 'Read the CO₂ monitor near your sleep station.' },
];

export default function Log() {
  const { metric } = useLocalSearchParams<{ metric?: string }>();
  const [k, setK] = useState(OPTIONS.some(o => o.k === metric) ? metric! : 'bp');
  const [v1, setV1] = useState(''); const [v2, setV2] = useState(''); const [note, setNote] = useState('');
  const [res, setRes] = useState<{ status: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const o = OPTIONS.find(x => x.k === k)!;
  const save = async () => {
    setBusy(true); setErr(null);
    try { setRes(await api('/api/measurements', { body: { metric: k, value: v1.replace(',', '.'), value2: o.dual ? v2.replace(',', '.') : undefined, note } })); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Screen bottomSpace={40}>
      <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Header title="Log a measurement" back />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
          {OPTIONS.map(x => <Chip key={x.k} label={x.l} on={x.k === k} onPress={() => { setK(x.k); setRes(null); setV1(''); setV2(''); }} />)}
        </ScrollView>
        <Card style={{ marginTop: 14 }}>
          <Row gap={12} style={{ marginBottom: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' }}><o.icon size={20} color={C.coral} /></View>
            <View style={{ flex: 1 }}><T size={18} weight="m">{o.l}</T><T size={12} color={C.ink3}>{o.unit}</T></View>
          </Row>
          <Notice kind="info" title="How to measure" body={o.tip} />
          {o.dual ? (
            <Row gap={10}>
              <View style={{ flex: 1 }}><Field label={o.dual[0]} value={v1} onChangeText={setV1} keyboardType="decimal-pad" placeholder={o.ph[0]} /></View>
              <View style={{ flex: 1 }}><Field label={o.dual[1]} value={v2} onChangeText={setV2} keyboardType="decimal-pad" placeholder={o.ph[1]} /></View>
            </Row>
          ) : <Field label={`Value (${o.unit})`} value={v1} onChangeText={setV1} keyboardType="decimal-pad" placeholder={o.ph[0]} />}
          <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. after exercise" />
          {err ? <Notice kind="red" title={err} /> : null}
          {res ? (
            <Notice kind={res.status === 'red' ? 'red' : res.status === 'amber' ? 'amber' : 'green'} title={`Saved · ${statusWord(res.status)}`}
              body={res.status === 'red' ? 'Out of range. Re-measure following the instructions; if it stays red, contact your flight surgeon.' : res.status === 'amber' ? 'Slightly outside your target. Your plan has been adjusted.' : 'Within your normal range.'}
              action={<Row gap={8}><Button title="Done" kind="dark" onPress={() => router.back()} style={{ flex: 1, height: 46 }} />{res.status === 'red' ? <Button title="Report" kind="light" onPress={() => router.replace('/report')} style={{ flex: 1, height: 46 }} /> : null}</Row>} />
          ) : <Button title="Save" kind="coral" loading={busy} disabled={!v1 || (!!o.dual && !v2)} onPress={save} />}
        </Card>
      </View>
    </Screen>
  );
}
