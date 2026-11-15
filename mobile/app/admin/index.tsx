import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Phone, ShieldAlert, Users } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Card, Chip, Notice, PageHead, Skeleton, Tag, TopBar } from '@/kit/ui';
import { BarChart, Progress, Spark } from '@/kit/charts';
import { Button } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useAuth } from '@/auth';
import { useApi } from '@/useApi';
import { useLive } from '@/live/Live';
import type { Incident } from '@/live/Live';

export type CrewRow = {
  id: number; name: string; email: string; mission: string; missionYears: number | null; readiness: number; checkedInToday: boolean;
  alerts: { red: number; amber: number }; conditionsCount: number; cameraMeals?: string[]; planProgress: number; hasOverride: boolean; overrideAt: string | null; openHandoffs?: number;
  snapshot: { updatedAt: string; meals?: Record<string, string> | null; stress: { level: string } | null; sessionsThisWeek: number | null; radiation: { rate: number | null } | null } | null;
};
export const pct = (p: number) => (p > 1 ? p / 100 : p);
const tone = (n: number) => (n >= 67 ? 'ok' : n >= 34 ? 'watch' : 'flag');
const color = (n: number) => (n >= 67 ? K.ok : n >= 34 ? K.watch : K.flag);

function Tile({ label, value, tone: t, onPress }: { label: string; value: string | number; tone?: string; onPress?: () => void }) {
  const body = (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: K.card, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: t === 'flag' ? K.flag : K.hair }}>
      <Txt v="mono" color={K.ink3} upper>{label}</Txt>
      <Txt v="display" tabular color={t === 'flag' ? K.flag : t === 'ok' ? K.ok : K.ink}>{value}</Txt>
    </View>
  );
  return onPress ? <Pressy label={label} onPress={onPress} style={{ flex: 1, minWidth: 96 }}>{body}</Pressy> : body;
}

/** Flight surgeon console: KPIs, a tappable readiness chart, alerts, and every astronaut at a glance. */
export default function AdminHome() {
  const { user } = useAuth();
  const live = useLive();
  const { data, error, reload } = useApi<{ crew: CrewRow[] }>('/api/admin/crew');
  const { data: inc, reload: reloadInc } = useApi<{ incidents: Incident[]; active: number }>('/api/admin/incidents');
  const { data: rep } = useApi<{ open: number }>('/api/admin/reports');
  const [filter, setFilter] = useState<'all' | 'attention' | 'handoffs'>('all');
  const [sel, setSel] = useState<number | null>(null);
  const all = [...(data?.crew ?? [])].sort((a, b) => (b.openHandoffs ?? 0) - (a.openHandoffs ?? 0) || b.alerts.red - a.alerts.red || a.readiness - b.readiness);
  const crew = all.filter(c => filter === 'all' || (filter === 'attention' ? c.alerts.red > 0 || (c.readiness > 0 && c.readiness < 50) : (c.openHandoffs ?? 0) > 0));
  const picked = all.find(c => c.id === sel) ?? null;
  const denied = user && user.role !== 'surgeon';
  const hand = all.reduce((a, c) => a + (c.openHandoffs ?? 0), 0), attention = all.filter(c => c.alerts.red > 0).length, active = (inc?.incidents ?? []).filter(i => i.status === 'active');

  return (
    <Page title="Flight surgeon console" maxWidth={900} onRefresh={() => { reload(); reloadInc(); }} header={<TopBar title="Flight surgeon console" right={<Tag label={live.connected ? 'Live' : 'Offline'} tone={live.connected ? 'ok' : 'none'} />} />}>
      <PageHead kicker="Mission control" title="Crew overview" sub="Tap a bar to preview an astronaut. Alerts reach you live, with a sound." style={{ marginTop: 6 }} />
      {denied ? <View style={{ marginTop: 16 }}><Notice tone="flag" title="Flight surgeon access only" body="Sign in as a flight surgeon to use this console." /></View> : null}
      {error && !denied ? <View style={{ marginTop: 16 }}><Notice tone="flag" title="Could not load the crew" body={String((error as any)?.message ?? error)} /></View> : null}
      {!data && !error ? <View style={{ gap: 10, marginTop: 16 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={110} r={22} />)}</View> : null}

      {data ? <>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <Tile label="Astronauts" value={all.length} />
          <Tile label="Live alerts" value={active.length} tone={active.length ? 'flag' : 'ok'} />
          <Tile label="Handoffs" value={hand} tone={hand ? 'flag' : 'ok'} onPress={() => setFilter('handoffs')} />
          <Tile label="Concerns" value={rep?.open ?? 0} tone={rep?.open ? 'flag' : 'ok'} onPress={() => router.push('/admin/reports')} />
        </View>

        {active.map(i => (
          <View key={i.id} style={{ marginTop: 10, backgroundColor: '#B3261E', borderRadius: 18, padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={22} color="#fff" />
              <View style={{ flex: 1 }}><Txt v="subM" color="#fff">{i.name}: {i.label}</Txt><Txt v="caption" color="#FFD2C8">{i.at} UTC{i.evidence ? ` · ${i.evidence}` : ''}</Txt></View>
              <Button small kind="secondary" icon={Phone} title="Call" onPress={() => live.call(`u:${i.userId}`, 'doctor', i.name)} />
              <Button small kind="secondary" title="Open" onPress={() => router.push(`/admin/${i.userId}`)} />
            </View>
          </View>
        ))}

        <Card style={{ marginTop: 14 }}>
          <Kicker>Readiness by astronaut</Kicker>
          <View style={{ marginTop: 8 }}><BarChart items={all.map(c => ({ key: String(c.id), label: c.name.split(' ')[0], value: c.readiness, color: color(c.readiness) }))} selected={sel == null ? null : String(sel)} onPick={k => setSel(Number(k) === sel ? null : Number(k))} /></View>
          {picked ? (
            <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}><Txt v="headline">{picked.name}</Txt><Txt v="caption" color={K.ink2}>{picked.mission}{picked.missionYears ? ` · ${picked.missionYears} y` : ''}</Txt></View>
                <Tag label={picked.readiness ? `Readiness ${picked.readiness}` : 'No data yet'} tone={picked.readiness ? tone(picked.readiness) : 'none'} />
              </View>
              <Txt v="sub" color={K.ink2}>{picked.snapshot ? `Stress ${picked.snapshot.stress?.level ?? 'n/a'} · ${picked.snapshot.sessionsThisWeek ?? 0} sessions this week${picked.snapshot.radiation?.rate != null ? ` · ${picked.snapshot.radiation.rate.toFixed(2)} mSv/day` : ''}` : 'The astronaut app has not reported yet.'}</Txt>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Button small title="Open" onPress={() => router.push(`/admin/${picked.id}`)} />
                <Button small kind="secondary" icon={Phone} title="Call" onPress={() => live.call(`u:${picked.id}`, 'doctor', picked.name)} />
              </View>
            </View>
          ) : <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>Green 67+ · amber 34 to 66 · red below 34.</Txt>}
        </Card>

        <Card style={{ marginTop: 12 }} onPress={() => router.push('/admin/reports')} label="Anonymous concerns">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Users size={18} color={K.copper} /><View style={{ flex: 1 }}><Txt v="subM">Anonymous crew concerns</Txt><Txt v="caption" color={K.ink2}>{rep?.open ? `${rep.open} new, with how many different people raised each` : 'Nothing new'}</Txt></View><ChevronRight size={16} color={K.ink3} /></View>
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          {([['all', `All (${all.length})`], ['attention', `Attention (${attention})`], ['handoffs', `Handoffs (${all.filter(c => (c.openHandoffs ?? 0) > 0).length})`]] as const).map(([k, l]) => <Chip key={k} label={l} on={filter === k} onPress={() => setFilter(k)} />)}
        </View>

        {crew.map(c => (
          <Card key={c.id} onPress={() => router.push(`/admin/${c.id}`)} label={`Open ${c.name}`} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: K.copperTint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: color(c.readiness) }}><Txt v="subM" tabular>{c.readiness}</Txt></View>
              <View style={{ flex: 1 }}>
                <Txt v="headline">{c.name}</Txt>
                <Txt v="caption" color={K.ink2}>{c.mission}{c.missionYears ? ` · ${c.missionYears} y` : ''}</Txt>
              </View>
              <ChevronRight size={16} color={K.ink3} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {c.openHandoffs ? <Tag label={`${c.openHandoffs} handoff${c.openHandoffs > 1 ? 's' : ''} to acknowledge`} tone="flag" /> : null}
              {c.alerts.red ? <Tag label={`${c.alerts.red} red`} tone="flag" /> : null}
              {c.alerts.amber ? <Tag label={`${c.alerts.amber} watch`} tone="watch" /> : null}
              {!c.alerts.red && !c.alerts.amber ? <Tag label="No alerts" tone="ok" /> : null}
              <Tag label={c.checkedInToday ? 'Checked in' : 'No check-in'} tone={c.checkedInToday ? 'ok' : 'none'} />
              {c.hasOverride ? <Tag label="Plan sent" /> : null}
              {c.conditionsCount ? <Tag label={`${c.conditionsCount} condition${c.conditionsCount > 1 ? 's' : ''}`} tone="watch" /> : null}
            </View>
            <View style={{ marginTop: 10 }}><Progress value={pct(c.planProgress)} height={5} /></View>
            <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>Plan {Math.round(pct(c.planProgress) * 100)}% done</Txt>
          </Card>
        ))}
        {!crew.length ? <Txt v="sub" color={K.ink3} center style={{ marginTop: 20 }}>Nobody matches this filter.</Txt> : null}
      </> : null}
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 18 }}>Prototype: every surgeon sees every astronaut. A real deployment assigns crew to surgeons and records consent.</Txt>
    </Page>
  );
}
