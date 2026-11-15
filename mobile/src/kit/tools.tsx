import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, HeartHandshake, Phone, Rocket, ShieldAlert, Siren } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Dot, IconBubble, Sheet, Tag, toast } from '@/kit/ui';
import { api } from '@/api';
import { useLive } from '@/live/Live';
import { useState } from 'react';
import { useStore } from '@/data/store';
import type { useCrew } from '@/data/crew';
import { whatChanged } from '@/data/changes';
import type { Confidence } from '@/data/confidence';
import { wellbeingInsight } from '@/data/wellbeing';
import { dayKey } from '@/data/store';
import { useTeam } from '@/data/team';

type Crew = ReturnType<typeof useCrew>;

/** One short daily summary of only the meaningful changes. */
export function WhatChangedCard({ crew }: { crew: Crew }) {
  const well = useStore(s => s.wellbeing);
  useStore(s => s.mealChecks); useStore(s => s.completed);
  const { items, basis } = whatChanged(crew, well);
  return (
    <Card style={{ marginTop: 12 }} label="What changed since yesterday">
      <Kicker>What changed since yesterday</Kicker>
      <View style={{ marginTop: 8, gap: 6 }}>
        {items.map((c, i) => <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}><View style={{ marginTop: 6 }}><Dot tone={c.tone} size={6} /></View><Txt v="sub" style={{ flex: 1 }}>{c.text}</Txt></View>)}
      </View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>{basis}</Txt>
    </Card>
  );
}

/** Confidence in today's alerts, with every deduction listed. */
export function ConfidenceRow({ c, full }: { c: Confidence; full?: boolean }) {
  return (
    <View style={{ marginTop: full ? 0 : 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Kicker color={K.ink2}>Sensor confidence</Kicker>
        <Tag label={`${c.label} · ${c.score}%`} tone={c.tone} />
      </View>
      {full ? (
        <View style={{ marginTop: 8, gap: 5 }}>
          {c.factors.length ? c.factors.map((f, i) => <Txt key={i} v="sub" color={K.ink2}>• {f.label} ({f.delta}): {f.detail}</Txt>) : <Txt v="sub" color={K.ink2}>Fresh data from a connected device with a full baseline.</Txt>}
        </View>
      ) : c.factors[0] ? <Txt v="caption" color={K.ink3} style={{ marginTop: 4 }}>Lowest: {c.factors.slice().sort((a, b) => a.delta - b.delta)[0].label}</Txt> : null}
    </View>
  );
}

/** Entry to the three mission tools. */
export function ToolsCard() {
  const live = useLive();
  const [sos, setSos] = useState(false);
  const w = useStore(s => s.wellbeing);
  const ins = wellbeingInsight(w), doneToday = !!w?.[dayKey(0)];
  const rows = [
    { icon: Phone, title: 'Call my doctor', sub: live.connected ? 'Rings the flight surgeons now' : 'Connecting…', to: '#call' },
    { icon: HeartHandshake, title: 'Private wellbeing check', sub: doneToday ? 'Done today · stays on this device' : 'Mood, stress, loneliness · 30 seconds', to: '/wellbeing', tag: ins.level === 'flag' ? 'Support' : ins.level === 'watch' ? 'Watch' : undefined },
    { icon: Rocket, title: 'EVA readiness check', sub: 'Sleep, hydration, symptoms, radiation, equipment', to: '/eva' },
    { icon: ShieldAlert, title: 'Radiation shelter drill', sub: 'Simulated solar particle event countdown', to: '/shelter' },
  ] as const;
  return (
    <Card style={{ marginTop: 10 }} pad={6}>
      {rows.map((r, i) => (
        <Pressy key={r.to} onPress={() => (r.to === '#call' ? live.call('doctors', 'doctor', 'Flight surgeon') : router.push(r.to as any))} label={r.title}><View style={{ padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBubble icon={r.icon} size={34} />
            <View style={{ flex: 1 }}><Txt v="subM">{r.title}</Txt><Txt v="caption" color={K.ink2}>{r.sub}</Txt></View>
            {'tag' in r && r.tag ? <Tag label={r.tag} tone={r.tag === 'Support' ? 'flag' : 'watch'} /> : null}
            <ChevronRight size={16} color={K.ink3} />
          </View>
        </View></Pressy>
      ))}
    <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: K.hair }}><Button small kind="secondary" icon={Siren} title="SOS: alert doctors and crew" onPress={() => setSos(true)} /></View>
    <Sheet open={sos} onClose={() => setSos(false)} kicker="Emergency" title="Alert everyone now?">
      <Txt v="sub" color={K.ink2}>Every flight surgeon and every crew mate gets a loud alert with your name, and they can call you.</Txt>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}><Button kind="secondary" title="Cancel" style={{ flex: 1 }} onPress={() => setSos(false)} /><Button title="Send SOS" style={{ flex: 1 }} onPress={async () => { setSos(false); try { await api('/api/alerts/sos', { body: {} }); toast('SOS sent. Help is alerted.'); } catch (e: any) { toast(e.message); } }} /></View>
    </Sheet>
    </Card>
  );
}

/** Stack of crew mates who are online right now (no health data). Tap opens My crew. */
export function CrewPresence() {
  const { crew } = useTeam();
  const mates = (crew?.members ?? []).filter(m => !m.you);
  if (!crew) return null;
  const on = mates.filter(m => m.online);
  return (
    <Pressy label={`Crew: ${on.length} online`} onPress={() => router.push('/crew')} hitSlop={6}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, paddingLeft: 4, paddingRight: 10, borderRadius: 14, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair2 }}>
        {(on.length ? on : mates).slice(0, 3).map((m, i) => (
          <View key={m.id} style={{ width: 20, height: 20, borderRadius: 10, marginLeft: i ? -6 : 0, backgroundColor: m.online ? K.copper : K.ink4, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="mono" color="#fff" style={{ fontSize: 9 }}>{m.name.charAt(0)}</Txt>
          </View>
        ))}
        <Txt v="caption" color={K.ink2} style={{ marginLeft: 6 }}>{on.length ? `${on.length} online` : 'Crew'}</Txt>
      </View>
    </Pressy>
  );
}
