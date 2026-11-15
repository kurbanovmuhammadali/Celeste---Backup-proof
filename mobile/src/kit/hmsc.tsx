/**
 * HMSC (Health Monitoring System Cometa) building blocks for Home: attention card, source freshness strip,
 * radiation card, mission strip and the synthetic-scenario banner. Built from the Copper Horizon kit.
 */
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, ChevronRight, Dumbbell, HeartHandshake, Orbit, Plug, Radiation, TriangleAlert, Utensils } from 'lucide-react-native';
import { Spark } from '@/kit/charts';
import { radiationLevel } from '@/data/plan';
import { STRESS_WORD } from '@/data/stress';
import type { Exposure } from '@/data/store';
import { K, toneColor } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Dot, IconBubble, Notice, Tag, toast } from '@/kit/ui';
import type { Attention, ActionId } from '@/data/attention';
import type { SourceStatus } from '@/data/freshness';
import { STATE_TONE, STATE_WORD } from '@/data/freshness';
import { createDraft } from '@/data/handoff';
import { api } from '@/api';
import type { useCrew } from '@/data/crew';
import { DESTINATIONS, hazardProfile, LEVEL_WORD } from '@/data/hmscMission';
import type { Briefing } from '@/data/store';
import { ConfidenceRow } from '@/kit/tools';
import type { Confidence } from '@/data/confidence';

type Crew = ReturnType<typeof useCrew>;
export const levelTone = (l: Attention['level']) => (l === 'ok' ? 'ok' : l === 'watch' ? 'watch' : l === 'flag' ? 'flag' : 'none');
export const levelWord = (l: Attention['level']) => (l === 'ok' ? 'NORMAL' : l === 'watch' ? 'WATCH' : l === 'flag' ? 'ACTION' : 'NO DATA');

/** Runs the action behind a button on the attention card / explain screen. */
export function runAction(id: ActionId, crew: Crew, att: Attention) {
  switch (id) {
    case 'rhr-check': case 'daily': router.push('/daily'); break;
    case 'checkin': router.push('/checkin'); break;
    case 'training': router.navigate('/plan'); break;
    case 'sources': router.push('/integrations'); break;
    case 'handoff': {
      createDraft(crew, att, `${att.headline}. ${att.changes[0] ?? ''}`.trim(), ['Reviewed the attention card']);
      toast('Added to the medical handoff as a draft');
      router.navigate('/handoff');
      break;
    }
    default: toast('Plan unchanged');
  }
}

export function AttentionCard({ att, crew, confidence }: { att: Attention; crew: Crew; confidence?: Confidence }) {
  const tone = levelTone(att.level);
  const shown = att.changes.slice(0, 3);
  return (
    <Card label={`Attention: ${att.headline}`} style={{ marginTop: 14, borderWidth: 1, borderColor: tone === 'none' ? K.hair : toneColor(tone) + '66' }}>
      <Pressy label={`Open details: ${att.headline}`} onPress={() => router.push('/attention')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Dot tone={tone} pulse={att.level === 'flag'} />
          <Kicker color={K.ink2}>{`Mission day ${att.missionDay} · ${levelWord(att.level)}`}</Kicker>
          <View style={{ flex: 1 }} />
          <Txt v="caption" color={K.copperInk}>Details</Txt><ChevronRight size={16} color={K.copperInk} />
        </View>
        <Txt v="title" style={{ marginTop: 8 }}>{att.headline}</Txt>
        <View style={{ marginTop: 8, gap: 5 }}>
          {shown.map((c, i) => <Txt key={i} v="sub" color={K.ink2}>• {c}</Txt>)}
        </View>
      </Pressy>
      {confidence ? <ConfidenceRow c={confidence} /> : null}
      {att.actions[0] ? (
        <View style={{ marginTop: 12 }}>
          <Txt v="mono" color={K.ink3} upper style={{ marginBottom: 6 }}>Action now</Txt>
          <Button small title={att.actions[0].text} onPress={() => runAction(att.actions[0].id, crew, att)} />
        </View>
      ) : null}
    </Card>
  );
}

/** Every source with its honest state: demo · received · stale · missing · error · queued. */
export function SourceStrip({ sources }: { sources: SourceStatus[] }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Kicker color={K.ink3}>Data sources</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {sources.map(s => <Tag key={s.key} tone={STATE_TONE[s.state]} label={`${s.label} · ${STATE_WORD[s.state]}`} onPress={() => toast(`${s.label}: ${s.detail}`)} />)}
      </View>
    </View>
  );
}

/** Radiation on Home: dose rate and interval dose always; cumulative only when the history is complete. */
export function RadiationCard({ crew }: { crew: Crew }) {
  const r = crew.radiation;
  const tag = r.source === 'synthetic' ? 'Synthetic' : r.source === 'demo' ? 'Demo' : r.source === 'dosimeter' ? 'Dosimeter' : 'No reading';
  return (
    <Card onPress={() => router.push('/radiation')} label="Radiation module" pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={Radiation} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">Radiation</Txt>
          <Txt v="caption" color={K.ink2}>{r.rate == null ? 'No dosimeter reading yet' : `${r.rate.toFixed(2)} mSv/day · last ${r.intervalDays} days ${r.interval?.toFixed(2)} mSv`}</Txt>
        </View>
        <Tag label={tag} tone={r.source === 'dosimeter' ? 'ok' : 'watch'} />
        <ChevronRight size={16} color={K.ink3} />
      </View>
      <Txt v="caption" color={r.cumulative == null ? K.copperInk : K.ink2} style={{ marginTop: 10 }}>
        {r.cumulative == null ? `Cumulative dose unavailable · ${r.missing} of ${r.missionDay} mission days have no reading` : `Cumulative dose ${r.cumulative.toFixed(1)} mSv · full ${r.missionDay}-day history`}
      </Txt>
    </Card>
  );
}

/** Mission context in one line, tap to edit the Mission Briefing. */
export function MissionStrip({ briefing }: { briefing?: Briefing }) {
  if (!briefing) {
    return (
      <Card onPress={() => router.push('/briefing')} label="Set up Mission Briefing" pad={14} style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBubble icon={Orbit} size={36} />
          <View style={{ flex: 1 }}>
            <Txt v="subM">Set up your Mission Briefing</Txt>
            <Txt v="caption" color={K.ink2}>Destination, duration, comms delay: HMSC builds your five-hazard profile</Txt>
          </View>
          <ArrowRight size={16} color={K.copper} />
        </View>
      </Card>
    );
  }
  const top = hazardProfile(briefing).filter(h => h.level === 2);
  return (
    <Card onPress={() => router.push('/briefing')} label="Mission Briefing" pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={Orbit} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">{DESTINATIONS[briefing.destination].label} · {briefing.durationDays} days · crew of {briefing.crew}</Txt>
          <Txt v="caption" color={K.ink2}>{top.length ? `High: ${top.map(h => h.label).join(', ')}` : 'No hazard rated high'}</Txt>
        </View>
        <ChevronRight size={16} color={K.ink3} />
      </View>
    </Card>
  );
}

/** Shown until the required choice is made: connect WHOOP or enter data by hand. */
export function SetupCard() {
  return (
    <Card onPress={() => router.push('/data')} label="Choose your data source" pad={14} style={{ marginTop: 14, borderWidth: 1, borderColor: K.watch + '88' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={Plug} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">Choose your data source</Txt>
          <Txt v="caption" color={K.ink2}>Required: connect WHOOP or enter your numbers by hand</Txt>
        </View>
        <ArrowRight size={16} color={K.copper} />
      </View>
    </Card>
  );
}

/** Personal plan entry: radiation level for the route and an active post-exposure checklist if there is one. */
export function PlanCard({ briefing, exposures, surgeon }: { briefing?: Briefing; exposures: Exposure[]; surgeon?: boolean }) {
  const lvl = briefing ? radiationLevel(briefing) : null;
  const active = exposures.some(e => Date.now() - e.at < 72 * 36e5);
  return (
    <Card onPress={() => router.push('/mission-plan')} label="My mission plan" pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={Dumbbell} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">My mission plan</Txt>
          <Txt v="caption" color={K.ink2}>{active ? 'Post-exposure checklist is active' : lvl == null ? 'Training, food and radiation steps for your body and goal' : `Radiation ${['baseline', 'elevated', 'high'][lvl]} for your route · training, food, sleep`}</Txt>
        </View>
        {surgeon ? <Tag label="Surgeon plan" tone="ok" /> : null}
        {active ? <Tag label="72 h" tone="watch" /> : null}
        <ChevronRight size={16} color={K.ink3} />
      </View>
    </Card>
  );
}

/** Stress load (derived from WHOOP signals or typed in) and the way into the private wellbeing check. */
export function WellbeingCard({ crew }: { crew: Crew }) {
  const s = crew.stress;
  const tone = s.level === 'high' ? 'flag' : s.level === 'moderate' ? 'watch' : s.level === 'low' ? 'ok' : 'none';
  return (
    <Card onPress={() => router.push('/wellbeing')} label="Isolation and wellbeing" pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={HeartHandshake} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">Wellbeing · stress {STRESS_WORD[s.level].toLowerCase()}</Txt>
          <Txt v="caption" color={K.ink2}>Private check: mood, stress, loneliness</Txt>
        </View>
        <Tag label={s.basis === 'manual' ? 'By hand' : s.basis === 'derived' ? 'Derived' : 'No data'} tone={tone} />
      </View>
      {s.series.some(v => v != null) ? <View style={{ marginTop: 10 }}><Spark values={s.series} w={260} h={26} /></View> : null}
      <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>{s.highDays ? `High on ${s.highDays} of the last 7 days. ` : ''}{s.note}</Txt>
    </Card>
  );
}

/**
 * Why training here is a demo. In flight, crews do not do push-ups or pull-ups: they train on dedicated devices
 * (ARED resistive device, CEVIS cycle, T2 treadmill with a harness). HMSC is not integrated with that hardware.
 */
export function DeviceNotice({ short }: { short?: boolean }) {
  return (
    <Notice tone="watch" title="Prototype: not connected to NASA exercise devices"
      body={short ? 'In space, sessions run on ARED, CEVIS and the T2 treadmill. HMSC is not integrated with them yet, so tracking here is a demo on your phone.'
        : 'In orbit, crews cannot do push-ups or pull-ups: they train on dedicated devices (ARED resistive device, CEVIS cycle, T2 treadmill with a harness). HMSC is not integrated with that hardware yet, so session tracking here is a demo on your phone. On a mission it would read the device.'} />
  );
}

/** Calories and water today against the plan, tap to log food. */
export function NutritionCard({ kcal, target, waterL, waterTarget, meals }: { kcal: number; target: number; waterL: number; waterTarget: number; meals?: string }) {
  return (
    <Card onPress={() => router.push('/nutrition')} label="Food and water" pad={14} style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBubble icon={Utensils} size={36} />
        <View style={{ flex: 1 }}>
          <Txt v="subM">Food and water</Txt>
          <Txt v="caption" color={K.ink2}>{kcal} / {target} kcal · {waterL.toFixed(1)} / {waterTarget} L water</Txt>
          {meals ? <Txt v="caption" color={K.copperInk}>Meals: {meals}</Txt> : null}
        </View>
        <ChevronRight size={16} color={K.ink3} />
      </View>
    </Card>
  );
}

/** Transparency: tells the astronaut when the camera station is filming him and whether a surgeon is watching. */
export function CamLiveBanner() {
  const [st, setSt] = React.useState<{ live: boolean; viewing: boolean } | null>(null);
  React.useEffect(() => {
    let alive = true;
    const pull = () => api<{ live: boolean; viewing: boolean }>('/api/me/cam-status').then(r => { if (alive) setSt(r); }).catch(() => {});
    pull(); const t = setInterval(pull, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!st?.live) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Notice tone={st.viewing ? 'flag' : 'watch'} title={st.viewing ? 'A flight surgeon is watching you now' : 'The camera is on you'} body="The camera station is filming you. Nothing is recorded: only the latest frame is kept for a few seconds." />
    </View>
  );
}

export const SyntheticBanner = () => (
  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: K.watchTint, marginTop: 12 }}>
    <TriangleAlert size={16} color={K.watch} />
    <Txt v="caption" color={K.ink} style={{ flex: 1 }}>Synthetic demo scenario: invented Mars replay crew, not real astronaut data.</Txt>
    <Tag label="Exit demo" onPress={() => router.push('/judge')} />
  </View>
);

export { LEVEL_WORD };
