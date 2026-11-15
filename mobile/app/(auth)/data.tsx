import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { nav } from '@/motion';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell } from '@/astra';
import { api } from '@/api';
import { GOAL_TASK, destinationFor, draft, useDraft } from '@/onboarding';
import { COMM_DELAY } from '@/data/mission';
import { dayKey, setStore, useStore } from '@/data/store';
import { Opt } from '@/OnboardingBits';

type Choice = 'whoop' | 'demo' | 'manual';

/**
 * Data source: required. HMSC reads health data from WHOOP only: connect it, or enter your numbers by hand.
 * On a server without WHOOP credentials (hackathon demo) a clearly labelled demo WHOOP dataset is offered instead.
 */
export default function DataSource() {
  const [d] = useDraft();
  const saved = useStore(s => s.dataMode);
  const fromSignup = !!d.firstName;
  const [whoopReady, setWhoopReady] = useState<boolean | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<{ whoop: boolean }>('/api/health').then(h => setWhoopReady(!!h.whoop)).catch(() => setWhoopReady(false)); }, []);
  if (!fromSignup && saved) return <Redirect href="/today" />;

  const save = (mode: 'whoop' | 'manual') => {
    const y = draft.get();
    setStore(s => {
      const next = { ...s, dataMode: mode };
      if (!fromSignup) return next;
      const dest: 'iss' | 'moon' | 'mars' | 'jupiter' | 'deep' = y.goalDest ?? ({ orbit: 'iss', moon: 'moon', mars: 'mars', jupiter: 'jupiter' } as const)[destinationFor(y.missionYears)];
      const days = Math.round(y.missionYears * 365);
      const evaTask = y.goalTasks.includes('eva');
      const objective = y.goalTasks.length ? y.goalTasks.map(t => GOAL_TASK.find(g => g.key === t)!.label).join(', ') : 'Science & research';
      return {
        ...next,
        profile: { ...s.profile, age: String(y.age), gender: y.sex || 'Prefer not to say', height: String(Math.round(y.heightCm)), weight: String(Math.round(y.weightKg)), duration: String(days), missionStart: dayKey(0) },
        briefing: {
          dest, commDelayMin: COMM_DELAY[dest], evaDates: evaTask ? [dayKey(2), dayKey(9), dayKey(16)] : [dayKey(9)], crewSize: 4, objective, custom: !!y.goalDest,
          durationDays: days, eva: y.goalTasks.length ? (evaTask ? 'weekly' : 'none') : 'weekly', sensors: mode === 'whoop' ? ['WHOOP', 'Personal dosimeter'] : ['Manual entry only'], at: Date.now(),
        },
      };
    });
  };
  const finish = () => nav.replace(fromSignup ? '/face' : '/today');

  const go = async () => {
    if (!choice) return;
    setErr(null);
    if (choice === 'manual') { save('manual'); return finish(); }
    if (choice === 'demo') { save('whoop'); return finish(); }
    setBusy(true);
    try {
      save('whoop'); // settings first: the OAuth round trip can reload the app
      const { url } = await api<{ url: string }>('/api/integrations/whoop/start', { body: { platform: Platform.OS === 'web' ? 'web' : 'native' } });
      if (Platform.OS === 'web') { window.location.href = url; return; }
      await WebBrowser.openAuthSessionAsync(url, Linking.createURL('integrations'));
      finish();
    } catch (e: any) { setErr(e.message ?? 'Could not start the WHOOP connection.'); } finally { setBusy(false); }
  };

  return (
    <FormShell step={fromSignup ? 8 : undefined} title="Where does your health data come from?" sub="HMSC works with WHOOP only. Connect it, or enter your numbers by hand each day. One of the two is required."
      onBack={fromSignup ? undefined : () => nav.back('/today')} onNext={go} nextDisabled={!choice} nextLoading={busy} nextLabel={choice === 'whoop' ? 'Connect WHOOP' : 'Continue'}>
      <View style={{ gap: 10, marginTop: 10 }}>
        {whoopReady ? <Opt wide label="Connect WHOOP" sub="Recovery, sleep, HRV, resting heart rate and strain sync automatically." on={choice === 'whoop'} onPress={() => setChoice('whoop')} />
          : <Opt wide label="Use demo WHOOP data" sub="WHOOP is not set up on this server yet. A clearly labelled demo dataset stands in until it is." on={choice === 'demo'} onPress={() => setChoice('demo')} />}
        <Opt wide label="Enter data by hand" sub="Sleep, resting heart rate, HRV, stress and exercise, typed in daily. HMSC will not show sensor data you did not provide." on={choice === 'manual'} onPress={() => setChoice('manual')} />
      </View>
      {err ? <T size={13.5} color="#D9583F" style={{ marginTop: 14 }}>{err}</T> : null}
      <T size={12.5} color={A.ink3} style={{ marginTop: 14, lineHeight: 17 }}>You can switch later in Profile. {fromSignup ? ` Your route has a comms delay of about ${COMM_DELAY[draft.get().goalDest ?? ({ orbit: 'iss', moon: 'moon', mars: 'mars', jupiter: 'jupiter' } as const)[destinationFor(d.missionYears)]]} min one-way.` : ''}</T>
    </FormShell>
  );
}
