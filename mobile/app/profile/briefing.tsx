/**
 * Mission briefing — set before tracking begins, editable any time: destination, mission duration,
 * communication delay (suggested from the destination), EVA schedule, crew size and mission objective.
 */
import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Minus, Plus, X } from 'lucide-react-native';
import { F } from '@/theme';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt, haptic } from '@/kit/core';
import { Button, Card, Chip, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import Planet from '@/Planet';
import { COMM_DELAY, DEST_NAME, useMission } from '@/data/mission';
import { dayKey, setStore, useStore, type AppState } from '@/data/store';
import { goBack } from '@/kit/transition';
import { SENSORS } from '@/data/hmscMission';

type Dest = AppState['briefing']['dest'];
const DESTS: Dest[] = ['iss', 'moon', 'mars', 'jupiter', 'deep'];

function Count({ label, value, unit, onChange, step = 1, min = 0, max = 9999 }: { label: string; value: number; unit: string; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const b = (d: number, I: any) => (
    <Pressy label={`${d > 0 ? 'Increase' : 'Decrease'} ${label}`} onPress={() => { haptic.tap(); onChange(Math.max(min, Math.min(max, +(value + d).toFixed(2)))); }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: K.copperTint, alignItems: 'center', justifyContent: 'center' }}><I size={15} color={K.copperInk} /></View>
    </Pressy>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
      <Txt v="subM" style={{ flex: 1 }}>{label}</Txt>
      {b(-step, Minus)}
      <Txt v="headline" tabular style={{ minWidth: 86, textAlign: 'center' }}>{value} <Txt v="caption" color={K.ink2}>{unit}</Txt></Txt>
      {b(step, Plus)}
    </View>
  );
}

export default function Briefing() {
  const m = useMission();
  const b0 = useStore(s => s.briefing);
  const b = b0.custom ? b0 : { ...b0, dest: m.dest, commDelayMin: m.delay };
  const p = useStore(s => s.profile);
  const [d, setD] = useState(b);
  const [duration, setDuration] = useState(Number(p.duration) || 180);
  const pickDest = (k: Dest) => setD(x => ({ ...x, dest: k, commDelayMin: COMM_DELAY[k] }));
  const addEva = () => { const last = [...d.evaDates].sort().slice(-1)[0]; const base = last && last >= dayKey(0) ? new Date(last + 'T12:00:00') : new Date(); base.setDate(base.getDate() + 7); setD(x => ({ ...x, evaDates: [...x.evaDates, base.toISOString().slice(0, 10)] })); };
  const save = () => {
    haptic.success();
    setStore(s => ({ ...s, briefing: { ...d, custom: true, durationDays: duration, at: Date.now() }, profile: { ...s.profile, duration: String(duration) } }));
    toast('Mission briefing saved');
    goBack('/profile');
  };
  return (
    <Page title="Mission briefing" maxWidth={640} header={<TopBar title="Mission briefing" />} footer={<Button title="Save briefing" onPress={save} />}>
      <PageHead kicker="Before tracking begins" title="Mission briefing" sub="Celeste uses this to set hazards, the comms delay and EVA readiness." style={{ marginTop: 6 }} />
      <Card style={{ marginTop: 16 }}>
        <Kicker color={K.ink2}>Destination</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {DESTS.map(k => (
            <Pressy key={k} label={DEST_NAME[k]} role="radio" selected={d.dest === k} onPress={() => { haptic.tap(); pickDest(k); }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 12, height: 38, borderRadius: 19, borderWidth: 1.2, borderColor: d.dest === k ? K.copper : K.hair2, backgroundColor: d.dest === k ? '#FFF3EC' : '#fff' }}>
                <Planet k={k} size={28} /><Txt v="subM">{DEST_NAME[k]}</Txt>
              </View>
            </Pressy>
          ))}
        </View>
      </Card>
      <Card style={{ marginTop: 10, paddingTop: 6 }}>
        <Count label="Mission duration" value={duration} unit="days" step={30} min={30} max={1500} onChange={setDuration} />
        <Count label="Comm delay (one-way)" value={d.commDelayMin} unit="min" step={d.commDelayMin < 1 ? 0.5 : 1} min={0} max={120} onChange={v => setD(x => ({ ...x, commDelayMin: v }))} />
        <Count label="Crew size" value={d.crewSize} unit="crew" min={1} max={12} onChange={v => setD(x => ({ ...x, crewSize: v }))} />
      </Card>
      <Card style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker color={K.ink2}>EVA schedule</Kicker>
          <Pressy label="Add EVA" onPress={() => { haptic.tap(); addEva(); }}><Txt v="subM" color={K.copperInk}>+ Add</Txt></Pressy>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {[...d.evaDates].sort().map(e => (
            <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 6, height: 34, borderRadius: 17, backgroundColor: e >= dayKey(0) ? K.copperTint : K.cardSunk }}>
              <Txt v="subM">{new Date(e + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Txt>
              <Pressy label="Remove EVA" onPress={() => setD(x => ({ ...x, evaDates: x.evaDates.filter(y => y !== e) }))} hitSlop={6}><X size={14} color={K.ink2} /></Pressy>
            </View>
          ))}
          {!d.evaDates.length ? <Txt v="caption" color={K.ink3}>No spacewalks scheduled.</Txt> : null}
        </View>
      </Card>
      <Card style={{ marginTop: 10 }}>
        <Kicker color={K.ink2}>Sensors on board</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {SENSORS.map(x => <Chip key={x} label={x} on={(d.sensors ?? []).includes(x)} onPress={() => setD(v => ({ ...v, sensors: (v.sensors ?? []).includes(x) ? (v.sensors ?? []).filter(y => y !== x) : [...(v.sensors ?? []), x] }))} />)}
        </View>
        <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>Decides which hazards can be measured and which are only estimated.</Txt>
      </Card>
      <Card style={{ marginTop: 10 }}>
        <Kicker color={K.ink2}>Mission objective</Kicker>
        <TextInput value={d.objective} onChangeText={t => setD(x => ({ ...x, objective: t }))} placeholder="e.g. Surface science and habitat assembly" placeholderTextColor={K.ink3} multiline
          style={{ marginTop: 8, minHeight: 64, fontFamily: F.r, fontSize: 15, color: K.ink }} />
      </Card>
    </Page>
  );
}
