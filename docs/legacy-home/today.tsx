import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Moon, Flame, Plus, ArrowUpRight, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/auth';
import { useApi } from '@/useApi';
import { C, statusColor, statusWord } from '@/theme';
import type { Dashboard, Plan, Snap } from '@/types';
import { Big, Button, Card, DotBars, FadeIn, Grid, IconBtn, Loading, Notice, Row, Screen, Segmented, Sparkline, StatusDot, T, useWide } from '@/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DateStrip() {
  const days = useMemo(() => Array.from({ length: 5 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i - 2); return d; }), []);
  const lift = [0, 18, 34, 18, 0];
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6, marginBottom: 6, paddingHorizontal: 4 }}>
      {days.map((d, i) => (
        <View key={i} style={{ marginTop: lift[i], alignItems: 'center' }}>
          <T size={13} color={i === 2 ? C.ink : C.ink3}>{DAYS[d.getDay()]}</T>
          <T size={i === 2 ? 30 : 26} weight={i === 2 ? 'm' : 'r'} color={i === 2 ? C.ink : C.ink3}>{d.getDate()}</T>
        </View>
      ))}
    </Row>
  );
}

function MetricTile({ m, chart }: { m?: Snap; chart: 'spark' | 'pulse' | 'bars' | 'none' }) {
  if (!m) return null;
  const val = m.value == null ? '—' : m.value2 != null ? `${m.value}/${m.value2}` : String(m.value);
  return (
    <Card onPress={() => router.push(`/metric/${m.key}`)} style={{ minHeight: 172 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T size={15} weight="m">{m.label}</T>
        {m.deviation != null && m.deviation !== 0 ? <T size={13} color={C.ink3}>{m.deviation > 0 ? '+' : ''}{m.deviation}%</T> : null}
      </Row>
      <View style={{ marginTop: 10 }}><StatusDot status={m.stale ? 'none' : m.status} /></View>
      <Row gap={3} style={{ alignItems: 'flex-end', marginTop: 2 }}>
        <T size={m.value2 != null ? 26 : 30} weight="m">{val}</T>
        <T size={13} color={C.ink3} style={{ marginBottom: 5 }}>{m.unit}</T>
      </Row>
      <View style={{ marginTop: 8 }}>
        {chart === 'spark' && <Sparkline values={m.spark} height={40} />}
        {chart === 'pulse' && <Sparkline values={m.spark} height={40} pulse />}
        {chart === 'bars' && <DotBars values={m.spark} height={44} />}
      </View>
    </Card>
  );
}

export default function Today() {
  const { user } = useAuth();
  const { data, error, reload } = useApi<Dashboard>('/api/dashboard');
  const { data: plan } = useApi<Plan>('/api/plan');
  const [mode, setMode] = useState<'readiness' | 'recovery'>('readiness');
  const wide = useWide();
  if (!data) return <Screen>{error ? <Notice kind="red" title={error} action={<Button title="Retry" kind="light" onPress={reload} />} /> : <Loading />}</Screen>;
  const m = data.metrics;
  const big = mode === 'readiness' ? data.readiness : m.recovery?.value ?? null;
  const bigStatus = mode === 'readiness' ? (data.readiness >= 70 ? 'green' : data.readiness >= 50 ? 'amber' : 'red') : m.recovery?.status;
  const first = (user?.name ?? '').split(' ')[0];
  const adapt = plan?.adaptations?.[0];

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.coralTint, alignItems: 'center', justifyContent: 'center' }}>
            <T size={16} weight="sb" color={C.coral}>{first.slice(0, 1)}</T>
          </View>
          <View>
            <T size={15} weight="m">Hello, {first}!</T>
            <T size={12} color={C.ink3}>{user?.mission}</T>
          </View>
        </Row>
        <IconBtn label="Flight surgeon report" onPress={() => router.push('/report')}>
          <Bell size={19} color={C.ink} />
          {data.alerts.some(a => a.level === 'red') ? <View style={{ position: 'absolute', top: 12, right: 13, width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral }} /> : null}
        </IconBtn>
      </Row>

      <View style={wide ? { flexDirection: 'row', gap: 24, marginTop: 10 } : undefined}>
        <View style={wide ? { flex: 1 } : undefined}>
          <DateStrip />
          <View style={{ marginTop: 14 }}>
            <Segmented value={mode} onChange={setMode} options={[{ key: 'readiness', label: 'Readiness' }, { key: 'recovery', label: 'Recovery' }]} />
          </View>
          <FadeIn key={mode} style={{ alignItems: 'center', marginTop: 6, marginBottom: 18 }}>
            <T size={104} weight="m">{big ?? '—'}</T>
            <Row gap={8} style={{ marginTop: -4 }}>
              <T size={18} weight="m">{mode === 'readiness' ? 'Mission readiness' : 'WHOOP recovery %'}</T>
            </Row>
            <View style={{ marginTop: 6 }}><StatusDot status={bigStatus} size={13} /></View>
          </FadeIn>

          <Grid wide={2}>
            <Card onPress={() => router.push('/metric/sleep')} style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Moon size={22} color={C.ink} strokeWidth={1.6} />
              <T size={14} color={C.ink2} style={{ marginTop: 10 }}>Sleep</T>
              <T size={20} weight="m">{m.sleep?.value ?? '—'} h</T>
            </Card>
            <Card onPress={() => router.push('/metric/strain')} style={{ alignItems: 'center', paddingVertical: 22 }}>
              <Flame size={22} color={C.ink} strokeWidth={1.6} />
              <T size={14} color={C.ink2} style={{ marginTop: 10 }}>Day strain</T>
              <T size={20} weight="m">{m.strain?.value ?? '—'}</T>
            </Card>
          </Grid>

          {!data.checkedInToday && (
            <Pressable onPress={() => router.push('/checkin')} style={{ marginTop: 12 }}>
              <View style={{ borderRadius: 26, overflow: 'hidden' }}>
                <LinearGradient colors={['#C9AE9C', '#8F6F5C', '#5A4135']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <T size={22} weight="m" color="#fff" style={{ flex: 1 }}>How have you been{'\n'}feeling this morning?</T>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={18} color={C.ink} /></View>
                  </Row>
                  <T size={13} color="rgba(255,255,255,0.8)" style={{ marginTop: 10 }}>30-second check-in · +20 XP · 🔥 {data.game.streak}-day streak</T>
                </LinearGradient>
              </View>
            </Pressable>
          )}
        </View>

        <View style={wide ? { flex: 1.25 } : { marginTop: 22 }}>
          {data.alerts.length > 0 && (
            <View style={{ marginBottom: 8 }}>
              {data.alerts.slice(0, 3).map((a, i) => (
                <Notice key={i} kind={a.level} title={a.title} body={a.body}
                  action={a.escalate ? <Button title="Prepare surgeon report" kind="light" onPress={() => router.push('/report')} style={{ height: 44 }} /> : undefined} />
              ))}
            </View>
          )}

          {adapt && (
            <Card onPress={() => router.push('/plan')} style={{ marginBottom: 12 }} tint="#141312">
              <Row gap={8}><Sparkles size={16} color={C.coral2} /><T size={12} weight="m" color={C.coral2} style={{ letterSpacing: 1, textTransform: 'uppercase' }}>Plan adapted for you</T></Row>
              <T size={22} weight="m" color="#fff" style={{ marginTop: 10 }}>{adapt.title}</T>
              <T size={13} color="rgba(255,255,255,0.7)" style={{ marginTop: 6 }}>{adapt.detail}</T>
              <T size={12} color="rgba(255,255,255,0.5)" style={{ marginTop: 10 }}>Why: {adapt.reason}</T>
            </Card>
          )}

          <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 10 }}>
            <T size={20} weight="m">Daily updates</T>
            <Pressable onPress={() => router.push('/log')}><Row gap={4}><Plus size={16} color={C.coral} /><T size={14} weight="m" color={C.coral}>Log</T></Row></Pressable>
          </Row>
          <Grid wide={2}>
            <MetricTile m={m.spo2} chart="bars" />
            <MetricTile m={m.rhr} chart="pulse" />
            <MetricTile m={m.hrv} chart="spark" />
            <MetricTile m={m.bp} chart="spark" />
            <MetricTile m={m.temp} chart="spark" />
            <MetricTile m={m.glucose} chart="bars" />
          </Grid>

          <Card style={{ marginTop: 12 }} onPress={() => router.push('/body')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T size={16} weight="m">Body systems</T>
              <T size={13} color={C.ink3}>Open 3D map →</T>
            </Row>
            <Row wrap gap={8} style={{ marginTop: 12 }}>
              {data.systems.map(s => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.soft }}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor(s.status) }} />
                  <T size={13}>{s.label}</T>
                </View>
              ))}
            </Row>
            <T size={12} color={C.ink3} style={{ marginTop: 12 }}>Readiness combines recovery (35 %), sleep (20 %), mood (15 %) and body-system status (30 %). {statusWord(bigStatus)} today.</T>
          </Card>
        </View>
      </View>
    </Screen>
  );
}
