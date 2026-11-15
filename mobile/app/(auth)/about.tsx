import React from 'react';
import { Redirect } from 'expo-router';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell, Input } from '@/astra';
import { useDraft } from '@/onboarding';
import { Label, Opt, Row } from '@/OnboardingBits';

const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : 0; };
export const HEIGHT_OK = (v: number) => v >= 120 && v <= 230;
export const WEIGHT_OK = (v: number) => v >= 35 && v <= 200;

/** Sex, height and weight: used for training loads, heart-rate zones, energy and hydration targets in the personal plan. */
export default function About() {
  const [d, set] = useDraft();
  if (!d.firstName) return <Redirect href="/name" />;
  const ok = !!d.sex && HEIGHT_OK(d.heightCm) && WEIGHT_OK(d.weightKg);
  return (
    <FormShell step={4} title="About your body" sub="HMSC sets your training loads, heart-rate zones, food and water targets from these. They stay on this device."
      onBack={() => nav.back('/mission')} onNext={() => nav.push('/goal')} nextDisabled={!ok}>
      <Label>Sex</Label>
      <Row>{(['Male', 'Female', 'Prefer not to say'] as const).map(s => <Opt key={s} label={s} on={d.sex === s} onPress={() => set({ sex: s })} />)}</Row>
      <Input label="Height (cm)" required value={d.heightCm ? String(d.heightCm) : ''} onChangeText={v => set({ heightCm: num(v) })} valid={HEIGHT_OK(d.heightCm)} placeholder="175" keyboardType="numeric" />
      <Input label="Weight (kg)" required value={d.weightKg ? String(d.weightKg) : ''} onChangeText={v => set({ weightKg: num(v) })} valid={WEIGHT_OK(d.weightKg)} placeholder="72" keyboardType="decimal-pad" />
      <T size={12.5} color={A.ink3} style={{ marginTop: 12, lineHeight: 17 }}>Used for estimates only. Your flight surgeon and trainer set the final numbers.</T>
    </FormShell>
  );
}
