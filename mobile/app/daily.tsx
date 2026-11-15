import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { dayKey, setStore, todayKey, useStore } from '@/data/store';
import type { ManualEntry } from '@/data/store';
import { useCrew } from '@/data/crew';
import { staleSleep } from '@/data/freshness';

const SYMPTOMS = ['Headache', 'Nausea', 'Dizziness', 'Congestion', 'Back pain', 'Vision changes', 'Chest pain', 'Shortness of breath'];
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : undefined; };

/** Daily Crew Health Check: enter only what you have. Manual values win over sensors and are labelled "manual". */
export default function Daily() {
  const crew = useCrew();
  const existing = useStore(s => s.manual[todayKey()]);
  const [sleep, setSleep] = useState(existing?.sleep != null ? String(existing.sleep) : '');
  const [rhr, setRhr] = useState(existing?.rhr != null ? String(existing.rhr) : '');
  const [exercise, setExercise] = useState(existing?.exercise != null ? String(existing.exercise) : '');
  const [dose, setDose] = useState(existing?.radiation != null ? String(existing.radiation) : '');
  const [hrv, setHrv] = useState(existing?.hrv != null ? String(existing.hrv) : '');
  const [stress, setStress] = useState<number | undefined>(existing?.stress);
  const [mood, setMood] = useState<number | undefined>(existing?.mood);
  const [symptoms, setSymptoms] = useState<string[]>(existing?.symptoms ?? []);
  const stale = staleSleep(crew);

  const save = () => {
    const e: ManualEntry = { at: Date.now(), sleep: num(sleep), rhr: num(rhr), hrv: num(hrv), stress, exercise: num(exercise), radiation: num(dose), mood, symptoms };
    if (e.sleep != null && (e.sleep < 0 || e.sleep > 16)) return toast('Sleep should be between 0 and 16 hours');
    if (e.rhr != null && (e.rhr < 25 || e.rhr > 160)) return toast('Resting heart rate should be between 25 and 160 bpm');
    if (e.radiation != null && e.radiation < 0) return toast('Dose cannot be negative');
    const key = todayKey();
    setStore(s => ({
      ...s,
      manual: { ...s.manual, [key]: e },
      // a dosimeter value entered here is the dose for the last 24 h (today's date), replacing an earlier entry from this form
      radiation: e.radiation != null
        ? [...s.radiation.filter(r => r.id !== `daily-${key}`), { id: `daily-${key}`, at: Date.now(), fromDay: key, toDay: key, mSv: e.radiation, device: 'Personal dosimeter', location: 'Crew quarters' }]
        : s.radiation,
    }));
    toast('Daily check saved');
    router.back();
  };

  return (
    <Page title="Daily check" maxWidth={640} header={<TopBar title="Daily crew health check" />} footer={<Button title="Save daily check" onPress={save} />}>
      <PageHead kicker={`Mission day ${crew.missionDay}`} title="How are you today?" sub="Enter only what you have. If a sensor is silent, a manual value keeps the picture honest." style={{ marginTop: 6 }} />
      {stale ? <View style={{ marginTop: 14 }}><Notice tone="watch" title={`Sleep source has not updated for ${stale.hours} hours`} body="Check the watch or enter a manual measurement below." /></View> : null}
      <Card style={{ marginTop: 16 }}>
        <Field label="Sleep last night" value={sleep} onChange={setSleep} unit="h" placeholder="5.5" />
        <Field label="Resting heart rate" value={rhr} onChange={setRhr} unit="bpm" keyboard="numeric" placeholder="68" hint="Measure after 5 minutes of rest." />
        <Field label="HRV (optional)" value={hrv} onChange={setHrv} unit="ms" keyboard="numeric" placeholder="45" hint="Use the same method every day (for example RMSSD from your own measurement)." />
        <Field label="Exercise today" value={exercise} onChange={setExercise} unit="min" keyboard="numeric" placeholder="30" />
        <Field label="Radiation, last 24 h" value={dose} onChange={setDose} unit="mSv" placeholder="0.4" hint="From your personal dosimeter. Leave empty if you have no reading." />
        <Kicker color={K.ink2} style={{ marginTop: 18 }}>Stress today</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map(n => <Chip key={n} label={`${n}`} on={stress === n} onPress={() => setStress(stress === n ? undefined : n)} />)}
        </View>
        <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>1 calm · 5 very stressed. Leave empty to let HMSC derive it from your data.</Txt>
        <Kicker color={K.ink2} style={{ marginTop: 18 }}>Mood</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map(n => <Chip key={n} label={`${n}`} on={mood === n} onPress={() => setMood(mood === n ? undefined : n)} />)}
        </View>
        <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>1 low · 5 great</Txt>
        <Kicker color={K.ink2} style={{ marginTop: 18 }}>Symptoms</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {SYMPTOMS.map(s => <Chip key={s} label={s} on={symptoms.includes(s)} onPress={() => setSymptoms(x => (x.includes(s) ? x.filter(y => y !== s) : [...x, s]))} />)}
        </View>
      </Card>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 14 }}>Private to your crew account. Not a medical device.</Txt>
    </Page>
  );
}
