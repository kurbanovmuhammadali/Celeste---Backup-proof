import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, PageHead, TopBar, toast } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { dayKey, setStore, uid, useStore } from '@/data/store';
import { bodyNumbers } from '@/data/plan';
import { SLOTS, markAteNow, setMealCheck } from '@/data/mealchecks';
import { useCameraMeals } from '@/data/cammeals';

const PRESETS = [
  { name: 'Oatmeal breakfast', kcal: 350, protein: 12 }, { name: 'Rehydrated main meal', kcal: 600, protein: 28 }, { name: 'Protein bar', kcal: 220, protein: 20 },
  { name: 'Fruit', kcal: 90, protein: 1 }, { name: 'Nuts, handful', kcal: 170, protein: 6 }, { name: 'Coffee or tea', kcal: 5, protein: 0 },
];
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) && v >= 0 ? v : NaN; };

/** Food and water log: calories, protein and water against the targets in your plan. */
export default function Nutrition() {
  const profile = useStore(s => s.profile);
  const meals = useStore(s => s.meals);
  useCameraMeals();
  const checks = useStore(s => s.mealChecks[dayKey(0)]);
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [prot, setProt] = useState('');
  const n = useMemo(() => bodyNumbers({ age: Number(profile.age) || 32, sex: profile.gender, heightCm: Number(profile.height) || 175, weightKg: Number(profile.weight) || 72 }), [profile]);
  const day = dayKey(0);
  const today = meals.filter(m => m.day === day);
  const sum = (k: 'kcal' | 'protein' | 'waterMl') => today.reduce((a, m) => a + m[k], 0);
  const kc = sum('kcal'), pr = sum('protein'), wa = sum('waterMl');

  const add = (m: { name: string; kcal: number; protein: number; waterMl?: number }) => {
    if (m.kcal > 0 || m.protein > 0) markAteNow();
    setStore(s => ({ ...s, meals: [{ id: uid(), at: Date.now(), day: dayKey(0), name: m.name, kcal: Math.round(m.kcal), protein: Math.round(m.protein), waterMl: m.waterMl ?? 0 }, ...s.meals].slice(0, 400) }));
  };
  const addCustom = () => {
    const k = num(kcal), p = prot ? num(prot) : 0;
    if (!name.trim() || Number.isNaN(k) || Number.isNaN(p) || k > 5000) return toast('Enter a name and calories (0 to 5000)');
    add({ name: name.trim(), kcal: k, protein: p }); setName(''); setKcal(''); setProt(''); toast('Added');
  };
  const del = (id: string) => setStore(s => ({ ...s, meals: s.meals.filter(m => m.id !== id) }));
  const bar = (label: string, v: number, target: number, unit: string) => (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="subM">{label}</Txt><Txt v="sub" color={K.ink2} tabular>{v} / {target} {unit}</Txt></View>
      <View style={{ marginTop: 6 }}><Progress value={Math.min(1, v / target)} height={6} /></View>
    </View>
  );

  return (
    <Page title="Food and water" maxWidth={680} header={<TopBar title="Food and water" />}>
      <PageHead kicker="Nutrition tracking" title="Today's intake" sub="Targets come from your body numbers in My mission plan. Your dietitian adjusts them." style={{ marginTop: 6 }} />
      <Card style={{ marginTop: 14 }}>
        <Kicker>Did you eat?</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Station food is precooked, so there is nothing to photograph or cook. If the remote camera sees you eating, the meal is marked for you; you can also mark it yourself. Your flight surgeon sees both.</Txt>
        {SLOTS.map((sl, i) => (
          <View key={sl.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 8 }}>
            <View style={{ flex: 1 }}><Txt v="subM">{sl.label}</Txt>{checks?.[sl.key]?.via === 'camera' ? <Txt v="caption" color={K.copperInk}>Seen by the camera</Txt> : null}</View>
            <Chip label="Ate" on={checks?.[sl.key]?.s === 'ate'} onPress={() => setMealCheck(sl.key, checks?.[sl.key]?.s === 'ate' ? null : 'ate')} />
            <Chip label="Skipped" on={checks?.[sl.key]?.s === 'skipped'} onPress={() => setMealCheck(sl.key, checks?.[sl.key]?.s === 'skipped' ? null : 'skipped')} />
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }}>
        {bar('Calories', kc, n.kcal, 'kcal')}
        {bar('Protein', pr, n.protein[1], `g (target ${n.protein[0]}–${n.protein[1]})`)}
        {bar('Water', Math.round(wa / 100) / 10, n.waterL, 'L')}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <View style={{ flex: 1 }}><Button small kind="secondary" title="+ 250 ml water" onPress={() => add({ name: 'Water', kcal: 0, protein: 0, waterMl: 250 })} /></View>
          <View style={{ flex: 1 }}><Button small kind="secondary" title="+ 500 ml water" onPress={() => add({ name: 'Water', kcal: 0, protein: 0, waterMl: 500 })} /></View>
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Station menu (precooked)</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {PRESETS.map(p => <Chip key={p.name} label={`${p.name} · ${p.kcal}`} onPress={() => { add(p); toast(`Added ${p.name}`); }} />)}
        </View>
        <Field label="Item not on the menu" value={name} onChange={setName} keyboard="default" placeholder="Meal or snack" />
        <Field label="Calories" value={kcal} onChange={setKcal} unit="kcal" keyboard="numeric" placeholder="450" />
        <Field label="Protein (optional)" value={prot} onChange={setProt} unit="g" keyboard="numeric" placeholder="25" />
        <View style={{ marginTop: 14 }}><Button small title="Add to today" onPress={addCustom} /></View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Today's entries</Kicker>
        {today.length === 0 ? <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>Nothing logged yet today.</Txt> : today.map(m => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 8, borderTopWidth: 1, borderTopColor: K.hair }}>
            <View style={{ flex: 1 }}>
              <Txt v="subM">{m.name}</Txt>
              <Txt v="caption" color={K.ink2}>{m.waterMl ? `${m.waterMl} ml` : `${m.kcal} kcal${m.protein ? ` · ${m.protein} g protein` : ''}`} · {new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Txt>
            </View>
            <Pressy label={`Delete ${m.name}`} onPress={() => del(m.id)}><Trash2 size={17} color={K.flag} /></Pressy>
          </View>
        ))}
      </Card>
      <View style={{ marginTop: 12 }}><Notice tone="watch" title="Estimates only" body="Energy and protein targets are starting estimates from standard formulas. Your dietitian and flight surgeon set the real numbers." /></View>
    </Page>
  );
}
