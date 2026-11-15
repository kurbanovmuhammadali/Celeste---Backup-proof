import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Dot, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { useStore , useBriefing} from '@/data/store';
import { useCrew } from '@/data/crew';
import { createReport, handoffStatus, queueHandoff } from '@/data/handoff';
import { delaySeconds } from '@/data/hmscMission';

/**
 * Radiation shelter drill. A SIMULATED solar particle event: warning, countdown to the shelter-by time, shelter, all clear,
 * and a report to the flight surgeon. 1 simulated minute = 2 real seconds. The numbers are invented; nothing here is real space weather.
 */
const WARN_MIN = 20, SEC_PER_MIN = 2;
type Phase = 'idle' | 'warning' | 'late' | 'sheltered' | 'clear';
const LEVELS = [[0, 'S0 · none'], [0.25, 'S1 · minor'], [0.5, 'S2 · moderate'], [0.75, 'S3 · strong'], [1, 'S4 · severe']] as const;

export default function Shelter() {
  const crew = useCrew();
  const briefing = useBriefing();
  const handoffs = useStore(s => s.handoffs);
  const [phase, setPhase] = useState<Phase>('idle');
  const [t, setT] = useState(0);              // simulated minutes since the warning
  const [inAt, setInAt] = useState<number | null>(null);
  const [repId, setRepId] = useState<string | null>(null);
  const t0 = useRef(0);
  const delayMin = Math.round(delaySeconds(briefing?.delay ?? 'none') / 60);
  const [, tick] = useState(0);

  useEffect(() => {
    if (phase === 'idle' || phase === 'clear') return;
    const id = setInterval(() => { setT((performance.now() - t0.current) / 1000 / SEC_PER_MIN); tick(n => n + 1); }, 250);
    return () => clearInterval(id);
  }, [phase]);
  useEffect(() => { if (phase === 'warning' && t >= WARN_MIN) setPhase('late'); }, [t, phase]);

  const flux = Math.min(1, t / (WARN_MIN + 25)), rate = 0.04 + flux * flux * 6; // mSv/h, invented ramp
  const level = [...LEVELS].reverse().find(l => flux >= l[0])![1];
  const left = Math.max(0, WARN_MIN - t);
  const start = () => { t0.current = performance.now(); setT(0); setInAt(null); setRepId(null); setPhase('warning'); };
  const enter = () => { setInAt(t); setPhase('sheltered'); };
  const allClear = () => {
    const dwell = inAt != null ? Math.max(1, Math.round(t - inAt)) : 0;
    const h = createReport(crew, 'Radiation shelter drill (simulation)', [
      { h: 'Reason for handoff', t: 'Simulated solar particle event drill. Not a real event.' },
      { h: 'Timeline', t: `Warning at T-${WARN_MIN} min. ${inAt != null ? `In shelter at T-${Math.max(0, Math.round(WARN_MIN - inAt))} min${inAt > WARN_MIN ? ' (after the shelter-by time)' : ''}, dwell ${dwell} min.` : 'Shelter was not reached.'}` },
      { h: 'Sensor state (simulated)', t: `Peak simulated dose rate ${rate.toFixed(2)} mSv/h, flux level ${level}.` },
      { h: 'Crew status', t: 'No symptoms reported in the drill. All clear called by the crew member.' },
      { h: 'Data label', t: 'Simulation: invented numbers, not crew data.' },
    ], true);
    queueHandoff(h.id); setRepId(h.id); setPhase('clear'); toast('Drill report created');
  };
  const rep = handoffs.find(h => h.id === repId);
  const rs = rep ? handoffStatus(rep) : null;
  useEffect(() => { if (!rep || rs?.state === 'acknowledged') return; const id = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(id); }, [rep, rs?.state]);

  return (
    <Page title="Radiation shelter drill" maxWidth={640} header={<TopBar title="Shelter drill" right={<Tag label="Simulation" tone="watch" />} />}>
      <PageHead kicker="Solar particle event" title="Shelter countdown" sub="Practise the sequence: warning, shelter-by time, sensor state, shelter, report. All numbers here are invented." style={{ marginTop: 6 }} />
      <View style={{ marginTop: 14 }}><Notice tone="watch" title="This is a drill" body="Nothing here is real space weather. The report it creates is marked as a simulation and is never sent to a flight surgeon." /></View>

      {phase === 'idle' ? (
        <Card style={{ marginTop: 12 }}>
          <Txt v="sub" color={K.ink2}>A warning gives you about {WARN_MIN} simulated minutes ({WARN_MIN * SEC_PER_MIN} real seconds) to reach the shelter.{delayMin ? ` With your ${delayMin}-minute one-way delay to Earth, a message sent now would arrive after the event has started, so you act first and report afterwards.` : ''}</Txt>
          <View style={{ marginTop: 14 }}><Button title="Start the drill" onPress={start} /></View>
        </Card>
      ) : (
        <View>
          <Card style={{ marginTop: 12, borderWidth: 1, borderColor: phase === 'late' ? K.flag : K.hair }}>
            <Kicker color={phase === 'late' ? K.flag : K.ink2}>{phase === 'warning' ? 'Shelter by' : phase === 'late' ? 'Shelter now' : phase === 'sheltered' ? 'In the shelter' : 'All clear'}</Kicker>
            <Txt v="hero" tabular style={{ fontSize: 56, lineHeight: 60, marginTop: 4 }} color={phase === 'late' ? K.flag : K.ink}>
              {phase === 'warning' ? `T-${Math.ceil(left)} min` : phase === 'late' ? `+${Math.floor(t - WARN_MIN)} min late` : phase === 'sheltered' ? `${Math.max(0, Math.round(t - (inAt ?? t)))} min inside` : 'Done'}
            </Txt>
            <View style={{ marginTop: 10 }}><Progress value={Math.min(1, t / WARN_MIN)} height={6} /></View>
            <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>Simulated clock: {Math.floor(t)} min since the warning</Txt>
          </Card>
          <Card style={{ marginTop: 12 }}>
            <Kicker>Sensor state (simulated)</Kicker>
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 8 }}>
              <View><Txt v="caption" color={K.ink2}>Dose rate</Txt><Txt v="headline" tabular>{rate.toFixed(2)} mSv/h</Txt></View>
              <View><Txt v="caption" color={K.ink2}>Proton flux level</Txt><Txt v="headline">{level}</Txt></View>
            </View>
          </Card>
          <Card style={{ marginTop: 12 }}>
            <Kicker>Do now</Kicker>
            {[['Stop work and secure equipment', true], ['Move to the radiation shelter', phase === 'sheltered' || phase === 'clear'], ['Stay inside until the all clear', phase === 'clear'], ['Report to the flight surgeon', !!rep]].map(([a, done], i) => (
              <View key={String(a)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 6 }}>
                <Dot tone={done ? 'ok' : 'none'} size={8} /><Txt v="sub" style={{ flex: 1 }} color={done ? K.ink : K.ink2}>{a as string}</Txt>
              </View>
            ))}
            <View style={{ marginTop: 12 }}>
              {phase === 'warning' || phase === 'late' ? <Button title="I am in the shelter" onPress={enter} /> : null}
              {phase === 'sheltered' ? <Button title="All clear: create my report" onPress={allClear} /> : null}
              {phase === 'clear' ? <Button kind="secondary" title="Run the drill again" onPress={start} /> : null}
            </View>
          </Card>
          {rs ? (
            <Card style={{ marginTop: 12 }}>
              <Kicker>Report status</Kicker>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}><Tag label={rs.label} tone={rs.state === 'acknowledged' ? 'ok' : 'watch'} /><Txt v="caption" color={K.ink2} style={{ flex: 1 }}>{rs.detail}</Txt></View>
              <View style={{ marginTop: 10 }}><Button small kind="secondary" title="Open in Handoff" onPress={() => router.navigate('/handoff')} /></View>
            </Card>
          ) : null}
        </View>
      )}
    </Page>
  );
}
