/**
 * Flight surgeon — compact report (trends, symptoms, missing data, actions taken, sources) and the
 * store-and-forward handoff queue for limited comms: Draft → Queued → Sent → Acknowledged.
 * Private mood never leaves the device. Status pills morph colour as an item moves through the queue.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Share, View } from 'react-native';
import { Send, Copy, Phone } from 'lucide-react-native';
import { K, MOTION } from '@/kit/tokens';
import { Kicker, Txt, haptic } from '@/kit/core';
import { Button, Card, Dot, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { SOURCE, useMission } from '@/data/mission';
import { useStore } from '@/data/store';
import { useCrew } from '@/data/crew';
import { createReport, handoffStatus, queueHandoff, removeHandoff, useHandoffSync } from '@/data/handoff';
import { useLive } from '@/live/Live';

const ST = { draft: ['Draft', K.copperTint, K.copperDeep], queued: ['Queued', K.watchTint, '#93621F'], sent: ['Sent', '#E3ECF8', '#3F6797'], ack: ['Acknowledged', K.okTint, '#3E7550'] } as const;
type Status = keyof typeof ST;
const toStatus = (s: 'draft' | 'queued' | 'sent' | 'acknowledged'): Status => (s === 'acknowledged' ? 'ack' : s);

function Pill({ s, at }: { s: Status; at?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { a.setValue(0); Animated.spring(a, { toValue: 1, useNativeDriver: false, speed: 14, bounciness: 12 }).start(); }, [s]);
  const [label, bg, fg] = ST[s];
  return (
    <Animated.View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: bg, justifyContent: 'center', transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
      <Txt v="caption" color={fg} style={{ fontFamily: 'Geist_600SemiBold' }}>{label}{at ? ` ${new Date(at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}</Txt>
    </Animated.View>
  );
}

export default function Report() {
  const m = useMission();
  const handoffs = useStore(s => s.handoffs);
  const crew = useCrew();
  const live = useLive();
  useHandoffSync(!crew.synthetic && !m.demo);
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const reports = handoffs.map(h => ({ id: h.id, title: h.title, createdAt: h.createdAt, status: toStatus(handoffStatus(h).state), at: h.ackAt ? Date.parse(h.ackAt.replace(' ', 'T') + 'Z') : h.sentAt ?? h.queuedAt, detail: handoffStatus(h).detail, queuedAt: h.queuedAt }));
  const checks = useStore(s => s.checks);
  const R = m.readings;
  const trend = (k: string) => { const r = R[k]; const s = r.series.filter((v): v is number => v != null); if (s.length < 3) return null; const d = s[s.length - 1] - s[s.length - 4]; return `${r.label} ${d > 0 ? '↑' : '↓'}`; };
  const lastCheck = checks.slice(-1)[0];
  const missing = Object.values(R).filter(r => r.fresh === 'missing' || r.fresh === 'stale').map(r => `${r.label} (${r.fresh})`);
  const sources = [...new Set(Object.values(R).filter(r => r.value != null).map(r => SOURCE[r.source]))];
  const body = [
    `CELESTE CREW HEALTH REPORT · Day ${m.day} · ${new Date().toISOString().slice(0, 10)}${m.demo ? ' · SYNTHETIC DEMO DATA' : ''}`,
    `Hazards: ${m.hazards.map(h => `${h.label} ${h.tone}`).join(', ')}`,
    `Trends: ${['hrv', 'sleep', 'dose', 'rhr'].map(trend).filter(Boolean).join(', ') || 'stable'}`,
    `Symptoms: ${m.symptoms.length ? m.symptoms.join(', ') : 'none reported'}`,
    `Missing data: ${missing.length ? missing.join(', ') : 'none'}`,
    `Actions taken: ${m.attention ? m.attention.action : 'none needed'}`,
    `Mood: ${lastCheck ? (lastCheck.moodPrivate ? 'kept private by crew member' : lastCheck.mood) : 'not logged'}`,
    `Sources: ${sources.join(' · ')}`,
  ].join('\n');

  const now = new Date();
  const window = new Date(now); window.setMinutes(40, 0, 0); if (window <= now) window.setHours(window.getHours() + 1);
  const linkUp = m.delay < 1;
  const add = (status: Status) => {
    haptic.success();
    const lines = body.split('\n').slice(1).map(l => { const [h, ...v] = l.split(': '); return { h: h.trim(), t: v.join(': ') }; });
    const h = createReport(crew, `Day ${m.day} report`, [{ h: 'Reason for handoff', t: 'Routine crew health report' }, ...lines], crew.synthetic || m.demo);
    if (status === 'queued') queueHandoff(h.id);
    toast(status === 'draft' ? 'Saved as draft' : 'Queued for the next comms window');
  };
  const share = async () => {
    if (Platform.OS === 'web') { try { await navigator.clipboard.writeText(body); toast('Report copied'); } catch {} }
    else await Share.share({ title: 'Celeste crew health report', message: body });
  };

  return (
    <Page title="Flight surgeon" maxWidth={720} header={<TopBar title="Flight surgeon" />}>
      <PageHead kicker="Store and forward" title="Flight surgeon" sub="Nothing is sent automatically. Reports wait for the next comms window." style={{ marginTop: 6 }} />
      <View style={{ marginTop: 12 }}><Button icon={Phone} title="Call the flight surgeon" kind="secondary" disabled={live.busy} onPress={() => live.call('doctors', 'doctor', 'Flight surgeon')} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair }}>
        <Dot tone={linkUp ? 'ok' : 'watch'} pulse={!linkUp} />
        <Txt v="caption">{linkUp ? 'Link up' : `Link down · next window ${window.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} · ${m.delay} min one-way`}</Txt>
      </View>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="subM">Report · Day {m.day}</Txt>
          <Pill s="draft" />
        </View>
        <View style={{ marginTop: 10, gap: 6 }}>
          {body.split('\n').slice(1).map(l => { const [k, ...v] = l.split(': '); return <Txt key={k} v="sub" color={K.ink2}><Txt v="subM">{k} </Txt>{v.join(': ')}</Txt>; })}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button title="Queue report" icon={Send} onPress={() => add('queued')} style={{ flex: 1.4 }} />
          <Button title="Save draft" kind="secondary" onPress={() => add('draft')} style={{ flex: 1 }} />
        </View>
        <Button title={Platform.OS === 'web' ? 'Copy text' : 'Share text'} kind="ghost" icon={Copy} small onPress={share} style={{ marginTop: 6 }} />
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, marginBottom: 8 }}>
        <Txt v="headline">Handoff queue</Txt>
        <Kicker color={K.ink3}>{reports.filter(r => r.status === 'queued' || r.status === 'sent').length} waiting</Kicker>
      </View>
      <Card style={{ paddingVertical: 4 }}>
        {!reports.length ? <Txt v="caption" color={K.ink3} style={{ paddingVertical: 14 }}>No reports yet.</Txt> : null}
        {reports.map((r, i) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
            <View style={{ flex: 1 }}>
              <Txt v="subM">{r.title}</Txt>
              <Txt v="caption" color={K.ink3}>{new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</Txt>
            </View>
            <Pill s={r.status} at={r.status === 'sent' || r.status === 'ack' ? r.at : undefined} />
            {r.status === 'draft' ? <Button small kind="secondary" title="Queue" onPress={() => queueHandoff(r.id)} /> : null}
          </View>
        ))}
      </Card>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>Reports reach the flight surgeon console of your server when the (simulated) link window opens; the surgeon's acknowledgement comes back here. Synthetic demo reports never leave the device.</Txt>
    </Page>
  );
}
