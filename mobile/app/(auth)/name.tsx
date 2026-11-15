import React, { useState } from 'react';
import { router } from 'expo-router';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { CheckRow, FormShell, Input, MeasureField } from '@/astra';
import { ftIn, useDraft } from '@/onboarding';
import { Label, Opt, Row } from '@/OnboardingBits';

export default function Name() {
  const [d, set] = useDraft();
  const [open, setOpen] = useState<'h' | 'w' | null>(null);
  const toggle = (k: 'h' | 'w') => setOpen(o => (o === k ? null : k));
  const ok = d.firstName.trim().length > 0 && d.lastName.trim().length > 0 && d.acceptTerms;
  return (
    <FormShell step={1} title="What should we call you?" sub="We’ll use your name to personalise Celeste throughout your mission."
      onBack={() => nav.back('/welcome')} onNext={() => nav.push('/age')} nextDisabled={!ok}>
      <Input label="First name" required value={d.firstName} onChangeText={v => set({ firstName: v })} valid={d.firstName.trim().length > 1} placeholder="e.g. Joseph" autoComplete="given-name" textContentType="givenName" focusOnEnter returnKeyType="next" />
      <Input label="Last name" required value={d.lastName} onChangeText={v => set({ lastName: v })} valid={d.lastName.trim().length > 1} placeholder="e.g. Brown" autoComplete="family-name" textContentType="familyName" />
      <MeasureField label="Height" min={140} max={210} value={d.heightCm} onChange={v => set({ heightCm: v })} unit="cm" alt={ftIn(d.heightCm)} open={open === 'h'} onToggle={() => toggle('h')} />
      <MeasureField label="Weight" min={40} max={150} value={d.weightKg} onChange={v => set({ weightKg: v })} unit="kg" alt={`${Math.round(d.weightKg * 2.20462)} lb`} open={open === 'w'} onToggle={() => toggle('w')} />
      <Label>Sex (for training loads and energy targets)</Label>
      <Row>{(['Male', 'Female', 'Prefer not to say'] as const).map(x => <Opt key={x} label={x} on={d.sex === x} onPress={() => set({ sex: x })} />)}</Row>
      <CheckRow checked={d.acceptTerms} onChange={v => set({ acceptTerms: v })}>
        <T size={13.5} color={A.ink2} style={{ lineHeight: 19 }}>
          I agree to the <T size={13.5} weight="m" color={A.copper} onPress={() => router.push('/legal/terms')}>Terms of Service</T> and <T size={13.5} weight="m" color={A.copper} onPress={() => router.push('/legal/privacy')}>Privacy Policy</T>, including Celeste processing my health data.
        </T>
      </CheckRow>
    </FormShell>
  );
}
