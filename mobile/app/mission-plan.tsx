import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Dot, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { setStore, uid, useStore , useBriefing} from '@/data/store';
import type { Exposure } from '@/data/store';
import { useCrew } from '@/data/crew';
import { buildPlan } from '@/data/plan';
import { DEFAULT_BRIEFING } from '@/data/hmscMission';
import { useOverride } from '@/data/override';
import { SurgeonPlan } from '@/kit/SurgeonPlan';
import { useApi } from '@/useApi';

const KINDS: { key: Exposure['kind']; label: string }[] = [{ key: 'eva', label: 'Spacewalk (EVA)' }, { key: 'storm-shelter', label: 'Solar storm shelter' }, { key: 'deep-space-transit', label: 'Deep-space transit leg' }];
const HOURS = [1, 2, 4, 6, 8];
const RAD_WORD = ['Baseline', 'Elevated', 'High'] as const;
const RAD_TONE = ['ok', 'watch', 'flag'] as const;

/** Personal mission plan from your body numbers, goal, route and exposure log. */
export default function MissionPlan() {
  const crew = useCrew();
  const profile = useStore(s => s.profile);
  const briefing = useBriefing();
  const exposures = useStore(s => s.exposures);
  const checks = useStore(s => s.planChecks);
  const [kind, setKind] = useState<Exposure['kind']>('eva');
  const [hours, setHours] = useState(6);

  const override = useOverride();
  const { data: bgData } = useApi<{ background: { conditions?: { name: string }[] } | null }>('/api/me/background');
  const conditions = (bgData?.background?.conditions ?? []).map(c => c.name);
  const plan = useMemo(() => buildPlan({
    body: { age: Number(profile.age) || 32, sex: profile.gender, heightCm: Number(profile.height) || 175, weightKg: Number(profile.weight) || 72 },
    briefing: briefing ?? DEFAULT_BRIEFING(), exposures, radiation: crew.radiation, stress: crew.stress, override, conditions,
  }), [profile, briefing, exposures, crew.radiation, crew.stress, override, bgData]);
  const n = plan.numbers;
  const act = plan.activeExposure;
  const done = act ? plan.checklist.filter(i => checks[`${act.id}:${i.id}`]).length : 0;

  const log = () => {
    setStore(s => ({ ...s, exposures: [{ id: uid(), at: Date.now(), kind, hours }, ...s.exposures].slice(0, 30) }));
    toast('Exposure logged. Add the dose reading in Radiation.');
  };
  const toggle = (id: string) => setStore(s => ({ ...s, planChecks: { ...s.planChecks, [id]: !s.planChecks[id] } }));
  const num = (label: string, v: string) => <View style={{ flex: 1, minWidth: 90 }}><Txt v="caption" color={K.ink2}>{label}</Txt><Txt v="headline" tabular style={{ marginTop: 2 }}>{v}</Txt></View>;

  return (
    <Page title="My mission plan" maxWidth={720} header={<TopBar title="My mission plan" right={<Tag label={`Radiation ${RAD_WORD[plan.radiationLevel]}`} tone={RAD_TONE[plan.radiationLevel]} />} />}>
      <PageHead kicker={`${profile.gender === 'Prefer not to say' ? 'Crew member' : profile.gender} · ${profile.age} y · ${profile.height} cm · ${profile.weight} kg`} title="Built for you" sub="Training, food, radiation and wellbeing steps from your body numbers, mission goal and route. Starting estimates: your flight surgeon and trainer have the final say." style={{ marginTop: 6 }} />
      {override ? <View style={{ marginTop: 14 }}><SurgeonPlan o={override} /></View> : null}
      {!briefing ? <View style={{ marginTop: 14 }}><Notice tone="watch" title="Set your Mission Briefing for a sharper plan" body="Destination, duration and spacewalk frequency change the radiation protocol." /><View style={{ marginTop: 8 }}><Button small kind="secondary" title="Open Mission Briefing" onPress={() => router.push('/briefing')} /></View></View> : null}

      <Card style={{ marginTop: 16 }}>
        <Kicker>Your numbers</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 }}>
          {num('BMI', String(n.bmi))}{num('Max heart rate', `${n.hrMax} bpm`)}{num('Zone 2', `${n.zone2[0]}–${n.zone2[1]} bpm`)}
          {num('Energy', `${n.kcal} kcal`)}{num('Protein', `${n.protein[0]}–${n.protein[1]} g`)}{num('Water', `${n.waterL} L`)}
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Log an exposure</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>After a spacewalk or a solar-storm shelter, log it. HMSC starts a 72-hour post-exposure checklist.</Txt>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>{KINDS.map(k => <Chip key={k.key} label={k.label} on={kind === k.key} onPress={() => setKind(k.key)} />)}</View>
        <Kicker color={K.ink2} style={{ marginTop: 14 }}>Hours</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>{HOURS.map(h => <Chip key={h} label={`${h}`} on={hours === h} onPress={() => setHours(h)} />)}</View>
        <View style={{ marginTop: 14, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button small title="Log exposure" onPress={log} /></View>
          <Button small kind="secondary" title="Add dose" onPress={() => router.push('/radiation')} />
        </View>
      </Card>

      {act ? (
        <Card style={{ marginTop: 12, borderWidth: 1, borderColor: K.watch + '88' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Kicker>Post-exposure checklist · 72 h</Kicker><Tag label={`${done}/${plan.checklist.length}`} tone={done === plan.checklist.length ? 'ok' : 'watch'} />
          </View>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>{KINDS.find(k => k.key === act.kind)?.label} · {act.hours} h · {new Date(act.at).toLocaleString()}</Txt>
          <View style={{ marginTop: 10 }}><Progress value={done / plan.checklist.length} height={5} /></View>
          <View style={{ marginTop: 6 }}>
            {plan.checklist.map(i => {
              const on = !!checks[`${act.id}:${i.id}`];
              return (
                <Pressy key={i.id} label={i.title} role="checkbox" checked={on} onPress={() => toggle(`${act.id}:${i.id}`)}>
                  <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: on ? K.copper : K.ink4, backgroundColor: on ? K.copper : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{on ? <Check size={13} color="#fff" strokeWidth={3} /> : null}</View>
                    <View style={{ flex: 1 }}><Txt v="subM" color={on ? K.ink3 : K.ink}>{i.title}</Txt><Txt v="caption" color={K.ink2} style={{ marginTop: 2 }}>{i.detail}</Txt></View>
                  </View>
                </Pressy>
              );
            })}
          </View>
        </Card>
      ) : exposures.length ? <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>Last logged exposure is more than 72 hours ago: no active checklist.</Txt> : null}

      {plan.sections.map(sec => (
        <Card key={sec.key} style={{ marginTop: 12 }}>
          <Kicker>{sec.title}</Kicker>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 3 }}>{sec.sub}</Txt>
          {sec.items.map((it, i) => (
            <View key={it.id} style={{ paddingTop: 12, marginTop: i ? 12 : 8, borderTopWidth: 1, borderTopColor: K.hair }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>{it.tone && it.tone !== 'none' ? <Dot tone={it.tone} size={7} /> : null}<Txt v="subM" style={{ flex: 1 }}>{it.title}</Txt></View>
              <Txt v="sub" color={K.ink2} style={{ marginTop: 4 }}>{it.detail}</Txt>
            </View>
          ))}
          {sec.key === 'isolation' ? <View style={{ marginTop: 14 }}><Button small title="Open the wellbeing check" onPress={() => router.push('/wellbeing')} /></View> : null}
        </Card>
      ))}
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 16 }}>Not a medical device. Estimates only: follow your flight surgeon's instructions.</Txt>
    </Page>
  );
}
