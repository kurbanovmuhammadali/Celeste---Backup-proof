/**
 * Check tab — the daily crew health check in five short steps (~90 s):
 *   Vitals (pre-filled from the watch with source + time; only missing values ask) → Mood (can stay private)
 *   → Symptoms → Exercise → Cabin. Steps slide; the progress dashes fill; saving gives one clear result.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Check as CheckIcon, Lock, LockOpen, Minus, Plus, ChevronLeft } from 'lucide-react-native';
import { api } from '@/api';
import { F } from '@/theme';
import { K, MOTION, native } from '@/kit/tokens';
import { Kicker, Pressy, Txt, haptic, useFocusTick } from '@/kit/core';
import { Button, Card, Chip, Notice } from '@/kit/ui';
import { Page } from '@/kit/page';
import { ReadingRow, ReadingSheet, SourceChip } from '@/kit/mission';
import { useMission, type Reading } from '@/data/mission';
import { dayKey, setStore, useStore } from '@/data/store';
import type { ManualEntry, Wellbeing } from '@/data/store';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { createDraft } from '@/data/handoff';
import { QUESTIONS, SUPPORT, blankWellbeing, saveWellbeing } from '@/data/wellbeing';
import { SLOTS, setMealCheck } from '@/data/mealchecks';

const STEPS = ['Vitals', 'Mood', 'Wellbeing', 'Symptoms', 'Exercise', 'Food', 'Cabin'];
const SYMPTOMS: [string, string][] = [['headache', 'Headache'], ['vision', 'Vision change'], ['insomnia', 'Trouble sleeping'], ['anxiety', 'Anxious / low'],
  ['back_pain', 'Back pain'], ['knee', 'Knee pain'], ['dizziness', 'Dizziness'], ['congestion', 'Stuffy / congested'], ['chest_pain', 'Chest pain'], ['nausea', 'Nausea'], ['breath', 'Short of breath']];
/** The same symptoms in the words the plan, attention and surgeon views use. */
const LABEL: Record<string, string> = { headache: 'Headache', vision: 'Vision changes', insomnia: 'Trouble sleeping', anxiety: 'Anxious / low', back_pain: 'Back pain', knee: 'Knee pain', dizziness: 'Dizziness', congestion: 'Congestion', chest_pain: 'Chest pain', nausea: 'Nausea', breath: 'Shortness of breath' };
const UNIT: Record<string, string> = { sleep: 'h', rhr: 'bpm', hrv: 'ms', dose: 'mSv', spo2: '%', bp: 'mmHg' };
const RED = ['vision', 'chest_pain', 'dizziness', 'breath'];
const moodWord = (v: number) => (v >= 85 ? 'Great' : v >= 70 ? 'Good' : v >= 55 ? 'Okay' : v >= 40 ? 'Low' : 'Struggling');

function Dashes({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {STEPS.map((_, i) => <Dash key={i} on={i <= step} cur={i === step} />)}
    </View>
  );
}
function Dash({ on, cur }: { on: boolean; cur: boolean }) {
  const a = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => { Animated.timing(a, { toValue: on ? 1 : 0, duration: 420, easing: MOTION.out, useNativeDriver: false }).start(); }, [on]);
  return (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EBDDD3', overflow: 'hidden' }}>
      <Animated.View style={{ height: 4, borderRadius: 2, backgroundColor: cur ? K.copperSoft : K.copper, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/** Slides the step content in from the direction of travel. */
function Slide({ k, dir, children }: { k: number; dir: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { a.setValue(0); Animated.timing(a, { toValue: 1, duration: 420, easing: MOTION.out, useNativeDriver: native }).start(); }, [k]);
  return <Animated.View style={{ opacity: a, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [dir * 40, 0] }) }] }}>{children}</Animated.View>;
}

function MoodSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [w, setW] = useState(0);
  const wRef = useRef(0); wRef.current = w;
  const last = useRef(value);
  const set = (x: number) => { const v = Math.round(Math.max(0, Math.min(100, (x / Math.max(1, wRef.current)) * 100))); if (v !== last.current) { if (Math.abs(v - last.current) >= 5 || v % 10 === 0) haptic.tap(); last.current = v; onChange(v); } };
  const pan = useRef(PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => set(e.nativeEvent.locationX), onPanResponderMove: e => set(e.nativeEvent.locationX) })).current;
  return (
    <View onLayout={e => setW(e.nativeEvent.layout.width)} {...pan.panHandlers} style={{ height: 54, justifyContent: 'center' }} accessible accessibilityRole="adjustable" accessibilityLabel="Mood" accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: '#EBDDD3', overflow: 'hidden' }}>
        <View style={{ height: 10, width: `${value}%`, backgroundColor: K.copper, borderRadius: 5 }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: (value / 100) * w - 15, width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', borderWidth: 3, borderColor: K.copper }} />
    </View>
  );
}

function Stepper({ value, onChange, step = 5, unit }: { value: number; onChange: (v: number) => void; step?: number; unit: string }) {
  const b = (d: number, Icon: any) => (
    <Pressy label={d > 0 ? 'More' : 'Less'} onPress={() => onChange(Math.max(0, value + d))}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: K.copperTint, alignItems: 'center', justifyContent: 'center' }}><Icon size={18} color={K.copperInk} /></View>
    </Pressy>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {b(-step, Minus)}
      <View style={{ alignItems: 'center' }}><Txt v="display" tabular>{value}</Txt><Txt v="caption" color={K.ink2}>{unit}</Txt></View>
      {b(step, Plus)}
    </View>
  );
}

function ManualField({ r, value, onChange, value2, onChange2 }: { r: Reading; value: string; onChange: (v: string) => void; value2?: string; onChange2?: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
      <View style={{ flex: 1 }}><Txt v="subM">{r.label}</Txt><SourceChip r={r} compact /></View>
      <TextInput value={value} onChangeText={t => onChange(t.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 5))} keyboardType="decimal-pad" placeholder={({ sleep: '6.5', rhr: '60', hrv: '45', dose: '0.40', spo2: '97', bp: 'sys' } as Record<string, string>)[r.key] ?? ''} placeholderTextColor={K.ink3} maxLength={5}
        accessibilityLabel={`${r.label} value`} style={{ width: 70, height: 40, borderRadius: 12, borderWidth: 1.2, borderColor: value ? K.copper : K.hair2, textAlign: 'center', fontFamily: F.sb, fontSize: 17, color: K.ink, backgroundColor: '#fff' }} />
      {r.key === 'bp' && onChange2 ? (<>
        <Txt v="subM" color={K.ink2}>/</Txt>
        <TextInput value={value2 ?? ''} onChangeText={t => onChange2(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="dia" placeholderTextColor={K.ink3} maxLength={3}
          accessibilityLabel="Diastolic pressure" style={{ width: 62, height: 40, borderRadius: 12, borderWidth: 1.2, borderColor: value2 ? K.copper : K.hair2, textAlign: 'center', fontFamily: F.sb, fontSize: 16, color: K.ink }} />
      </>) : null}
      <Txt v="caption" color={K.ink2} style={{ width: 44 }}>{UNIT[r.key] ?? ''}</Txt>
    </View>
  );
}

export default function CheckTab() {
  const m = useMission();
  const checks = useStore(s => s.checks);
  const tick = useFocusTick();
  const today = dayKey(0);
  const done = checks.find(c => c.day === today);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [mood, setMood] = useState(done?.mood ?? 70);
  const [priv, setPriv] = useState(done?.moodPrivate ?? true);
  const [sym, setSym] = useState<string[]>(done?.symptoms ?? []);
  const [ex, setEx] = useState(done?.exerciseMin ?? 30);
  const [manual, setManual] = useState<Record<string, string>>({});
  const crew = useCrew();
  const sources = useSources(crew);
  const savedWb = useStore(s => s.wellbeing?.[dayKey(0)]);
  const [wb, setWb] = useState<Wellbeing>(savedWb ?? blankWellbeing());
  const meals = useStore(s => s.mealChecks[dayKey(0)]);
  const [sheet, setSheet] = useState<Reading | null>(null);
  const [saved, setSaved] = useState(!!done);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!done) { setStep(0); setSaved(false); } }, [tick]);
  const R = m.readings;
  const vitals = [R.sleep, R.rhr, R.hrv, R.dose];
  const manualKeys = [R.sleep, R.rhr, R.hrv, R.dose, R.spo2, R.bp].filter(r => r.value == null || r.fresh === 'stale');
  const lowConf = vitals.filter(r => r.value != null).sort((a, b) => a.confidence - b.confidence)[0];
  const go = (d: number) => { haptic.tap(); setDir(d); setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + d))); };

  const save = async () => {
    setBusy(true);
    const man: Record<string, number> = {};
    for (const [k, v] of Object.entries(manual)) if (v) man[k] = +v;
    const num = (k: string) => (manual[k] ? +manual[k] : undefined);
    const bpOk = !!manual.bp && !!manual.bp2;
    if (!bpOk) { delete man.bp; delete man.bp2; } // a blood pressure needs both numbers
    const entry: ManualEntry = { at: Date.now(), sleep: num('sleep'), rhr: num('rhr'), hrv: num('hrv'), spo2: num('spo2'), bp: bpOk ? num('bp') : undefined, bp2: bpOk ? num('bp2') : undefined, exercise: ex, radiation: num('dose'), mood: Math.round(mood / 25) + 1, stress: wb.stress, symptoms: sym.map(k => LABEL[k] ?? k) };
    setStore(s => ({
      ...s,
      checks: [...s.checks.filter(c => c.day !== today), { day: today, at: Date.now(), mood, moodPrivate: priv, symptoms: sym, exerciseMin: ex, manual: man }],
      manual: { ...s.manual, [today]: { ...(s.manual[today] ?? {}), ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)) } as ManualEntry },
      radiation: entry.radiation != null ? [...s.radiation.filter(r => r.id !== `daily-${today}`), { id: `daily-${today}`, at: Date.now(), fromDay: today, toDay: today, mSv: entry.radiation, device: 'Personal dosimeter', location: 'Crew quarters' }] : s.radiation,
    }));
    saveWellbeing(wb); // private: stays on this device
    // hand-entered vitals also go to the server, so the SI and your flight surgeon see the same numbers
    const sendM = (metric: string, value?: number, value2?: number) => { if (value != null && Number.isFinite(value)) api('/api/measurements', { body: { metric, value, ...(value2 != null ? { value2 } : {}) } }).catch(() => {}); };
    sendM('sleep', entry.sleep); sendM('rhr', entry.rhr); sendM('hrv', entry.hrv); sendM('spo2', entry.spo2); sendM('bp', entry.bp, entry.bp2); sendM('radiation', entry.radiation);
    try { await api('/api/checkins', { body: { mood: priv ? undefined : mood, symptoms: sym, note: '' } }); } catch {} // offline is fine: the check is stored on the device
    haptic.success(); setBusy(false); setSaved(true);
  };

  if (saved) {
    const red = sym.filter(s => RED.includes(s));
    return (
      <Page tabs title="Check" header={<Txt v="headline">Daily check</Txt>}>
        <Card style={{ marginTop: 16, alignItems: 'center', paddingVertical: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: K.ok, alignItems: 'center', justifyContent: 'center' }}><CheckIcon size={30} color="#fff" strokeWidth={3} /></View>
          <Txt v="title" style={{ marginTop: 14 }}>Today’s check is in</Txt>
          <Txt v="sub" color={K.ink2} center style={{ marginTop: 4 }}>{priv ? 'Your mood stays private on this device.' : 'Mood shared with your flight surgeon.'} Hazards and the attention card are updated.</Txt>
        </Card>
        {red.length ? <View style={{ marginTop: 12 }}><Notice tone="flag" title="These go to your flight surgeon" body={`${red.map(k => SYMPTOMS.find(s => s[0] === k)?.[1]).join(', ')} — added to today’s report.`} /></View> : null}
        {wb.support >= 1 ? <View style={{ marginTop: 12 }}><Button kind="secondary" title="Send a confidential note to my flight surgeon" onPress={() => { createDraft(crew, computeAttention(crew, sources), wb.support === 2 ? 'Confidential: I need support' : 'Confidential: wellbeing concern', ['Private wellbeing check: the crew member asked for support']); router.navigate('/report'); }} /></View> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button title="Back to Home" onPress={() => router.navigate('/today')} style={{ flex: 1 }} />
          <Button title="Edit" kind="secondary" onPress={() => { setSaved(false); setStep(0); }} style={{ flex: 1 }} />
        </View>
      </Page>
    );
  }

  const body = [
    <View key="v">
      <Txt v="sub" color={K.ink2}>From your devices this morning. Tap a value to see its source and baseline.</Txt>
      <Card style={{ marginTop: 12, paddingVertical: 4 }}>{vitals.map((r, i) => <ReadingRow key={r.key} r={r} first={i === 0} onPress={() => setSheet(r)} />)}</Card>
      {manualKeys.length ? (
        <Card style={{ marginTop: 10, paddingVertical: 4 }}>
          <Kicker color={K.ink2} style={{ marginTop: 8, marginBottom: 2 }}>Missing · add by hand</Kicker>
          {manualKeys.map(r => <ManualField key={r.key} r={r} value={manual[r.key] ?? ''} onChange={v => setManual(s => ({ ...s, [r.key]: v }))} value2={manual.bp2 ?? ''} onChange2={v => setManual(s => ({ ...s, bp2: v }))} />)}
        </Card>
      ) : null}
      {lowConf && lowConf.confidence < 85 ? (
        <Card style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="subM">Sensor confidence · {lowConf.label}</Txt><Txt v="subM" color={K.watch}>{lowConf.confidence}%</Txt></View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: K.copperTint, marginTop: 8, overflow: 'hidden' }}><View style={{ height: 6, width: `${lowConf.confidence}%`, backgroundColor: K.watch }} /></View>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 6 }}>{(lowConf.note ?? 'Signal quality was low').replace(/\.$/, '')}. Re-measure for a cleaner value.</Txt>
          <Pressy label="Re-measure" onPress={() => router.push({ pathname: '/remeasure', params: { metric: lowConf.key } })}><Txt v="subM" color={K.copperInk} style={{ marginTop: 8 }}>Re-measure {lowConf.label} →</Txt></Pressy>
        </Card>
      ) : null}
    </View>,
    <View key="m">
      <Txt v="sub" color={K.ink2}>How have you been feeling since yesterday?</Txt>
      <Card style={{ marginTop: 12, alignItems: 'center', paddingVertical: 22 }}>
        <Txt v="hero" tabular style={{ fontSize: 56, lineHeight: 60 }}>{mood}</Txt>
        <Txt v="subM" color={K.copperInk}>{moodWord(mood)}</Txt>
        <View style={{ alignSelf: 'stretch', marginTop: 14 }}><MoodSlider value={mood} onChange={setMood} /></View>
      </Card>
      <Pressy label="Private wellbeing" onPress={() => { haptic.tap(); setPriv(p => !p); }} to={0.98}>
        <View style={{ marginTop: 10, padding: 14, borderRadius: 18, backgroundColor: priv ? K.cardSunk : K.cardSolid, borderWidth: 1, borderColor: K.hair, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {priv ? <Lock size={18} color={K.copper} /> : <LockOpen size={18} color={K.ink2} />}
          <View style={{ flex: 1 }}>
            <Txt v="subM">{priv ? 'Private · only me' : 'Shared with flight surgeon'}</Txt>
            <Txt v="caption" color={K.ink2}>{priv ? 'Mood stays on this device and out of reports.' : 'Mood is included in today’s report.'}</Txt>
          </View>
          <Txt v="caption" color={K.copperInk}>Change</Txt>
        </View>
      </Pressy>
    </View>,
    <View key="w">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Lock size={15} color={K.copper} /><Txt v="sub" color={K.ink2} style={{ flex: 1 }}>Private. These answers stay on this device. Nothing is sent unless you choose to.</Txt></View>
      {QUESTIONS.filter(q => q.key !== 'mood').map(q => (
        <Card key={q.key} style={{ marginTop: 10 }}>
          <Txt v="subM">{q.label}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(n => <View key={n} style={{ flex: 1 }}><Chip label={String(n)} on={wb[q.key] === n} onPress={() => setWb(v => ({ ...v, [q.key]: n, mood: Math.round(mood / 25) + 1 }))} /></View>)}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}><Txt v="caption" color={K.ink3}>1 · {q.low}</Txt><Txt v="caption" color={K.ink3}>5 · {q.high}</Txt></View>
        </Card>
      ))}
      <Card style={{ marginTop: 10 }}>
        <Txt v="subM">Do you need support?</Txt>
        <View style={{ gap: 8, marginTop: 8 }}>{SUPPORT.map((t, i) => <Chip key={t} label={t} on={wb.support === i} tone={i === 2 ? 'flag' : undefined} onPress={() => setWb(v => ({ ...v, support: i as 0 | 1 | 2 }))} />)}</View>
        {wb.support >= 1 ? <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>After saving you can send a confidential note to your flight surgeon.</Txt> : null}
      </Card>
    </View>,
    <View key="s">
      <Txt v="sub" color={K.ink2}>Anything unusual today? Vision change, chest pain and dizziness always go to the flight surgeon.</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        {SYMPTOMS.map(([k, l]) => <Chip key={k} label={l} on={sym.includes(k)} tone={RED.includes(k) ? 'flag' : undefined} onPress={() => setSym(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]))} />)}
      </View>
    </View>,
    <View key="e">
      <Txt v="sub" color={K.ink2}>Exercise since yesterday. WHOOP workouts arrive after they finish — set it by hand if needed.</Txt>
      <Card style={{ marginTop: 12 }}>
        <Stepper value={ex} onChange={setEx} unit="minutes" />
        <View style={{ marginTop: 10, alignItems: 'center' }}><SourceChip r={R.exercise} /></View>
      </Card>
    </View>,
    <View key="f">
      <Txt v="sub" color={K.ink2}>Space food is precooked: just mark what you had. The camera station can tick it for you when it sees you eating.</Txt>
      <Card style={{ marginTop: 12, paddingVertical: 4 }}>
        {SLOTS.map((sl, i) => (
          <View key={sl.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
            <View style={{ flex: 1 }}><Txt v="subM">{sl.label}</Txt>{meals?.[sl.key]?.via === 'camera' ? <Txt v="caption" color={K.copperInk}>Seen by the camera</Txt> : null}</View>
            <Chip label="Ate" on={meals?.[sl.key]?.s === 'ate'} onPress={() => setMealCheck(sl.key, meals?.[sl.key]?.s === 'ate' ? null : 'ate')} />
            <Chip label="Skipped" on={meals?.[sl.key]?.s === 'skipped'} onPress={() => setMealCheck(sl.key, meals?.[sl.key]?.s === 'skipped' ? null : 'skipped')} />
          </View>
        ))}
      </Card>
    </View>,
    <View key="c">
      <Txt v="sub" color={K.ink2}>Cabin conditions come from the station’s sensors. Nothing to type.</Txt>
      <Card style={{ marginTop: 12, paddingVertical: 4 }}>{[R.co2, R.temp].map((r, i) => <ReadingRow key={r.key} r={r} first={i === 0} onPress={() => setSheet(r)} />)}</Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {[['headache', 'Headache'], ['congestion', 'Stuffy air']].map(([k, l]) => <Chip key={k} label={l} on={sym.includes(k)} onPress={() => setSym(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]))} />)}
      </View>
    </View>,
  ];

  return (
    <Page tabs title="Check" header={<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="headline">Daily check</Txt><Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>{step + 1} of {STEPS.length} · ~90 s</Txt></View>}
      footer={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {step > 0 ? (
            <Pressy label="Back" onPress={() => go(-1)}><View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: K.hair }}><ChevronLeft size={20} color={K.ink} /></View></Pressy>
          ) : null}
          <Button title={step < STEPS.length - 1 ? `Continue · ${STEPS[step + 1]}` : 'Save today’s check'} onPress={() => (step < STEPS.length - 1 ? go(1) : save())} loading={busy} style={{ flex: 1 }} />
        </View>
      }>
      <View style={{ marginTop: 10 }}><Dashes step={step} /></View>
      <Txt v="display" style={{ marginTop: 16 }}>{STEPS[step]}</Txt>
      <View style={{ marginTop: 8 }}><Slide k={step} dir={dir}>{body[step]}</Slide></View>
      <ReadingSheet r={sheet} onClose={() => setSheet(null)} />
    </Page>
  );
}
