import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Orbit, Home, Database, Radiation, Send } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, ListGroup, ListRow, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { enableJudge, disableJudge } from '@/data/judge';
import { SCENARIO_NAME } from '@/data/scenario';
import { useStore } from '@/data/store';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { createDraft, queueHandoff } from '@/data/handoff';

/** Clean judge demo: one synthetic Mars case → one real NASA dataset → one DONKI event → one action → one handoff. */
export default function Judge() {
  const on = useStore(s => !!s.judge);
  const crew = useCrew();
  const sources = useSources(crew);

  const handoff = () => {
    const h = createDraft(crew, computeAttention(crew, sources), 'Sleep below normal range for 3 nights, HRV 14% below baseline, headache reported', ['Repeated resting-heart-rate check', 'Reduced optional training']);
    queueHandoff(h.id);
    toast('Handoff queued (simulated)');
    router.navigate('/handoff');
  };

  return (
    <Page title="Judge demo" maxWidth={680} header={<TopBar title="Judge demo" />}>
      <PageHead kicker="HMSC · Health Monitoring System Cometa" title="Five-minute walkthrough" sub="Detect a change, understand it in mission context, act safely, and prepare a medical handoff when Earth is far away." style={{ marginTop: 6 }} />

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Kicker>Data mode</Kicker><Tag label={on ? 'Synthetic scenario ON' : 'Your own data'} tone={on ? 'watch' : 'ok'} />
        </View>
        <Txt v="sub" color={K.ink2} style={{ marginTop: 8 }}>{on ? `${SCENARIO_NAME}. Numbers are invented; the Inspiration4 data and DONKI events below are real.` : 'Switch to the synthetic Mars scenario: a 4-person crew, mission day 74 of 900, three short nights and a headache. Your own settings are restored when you exit.'}</Txt>
        <View style={{ marginTop: 12 }}>
          {on ? <Button kind="secondary" title="Exit demo and restore my data" onPress={() => { disableJudge(); toast('Restored your own data'); }} />
              : <Button icon={Orbit} title="Start synthetic Mars case" onPress={() => { enableJudge(); toast('Synthetic Mars scenario on'); }} />}
        </View>
      </Card>

      <ListGroup kicker="Walkthrough" style={{ marginTop: 16 }}>
        <ListRow icon={Home} title="1 · Home: one signal, one action" sub="Attention card: sleep, HRV, radiation sensor, data sources" onPress={() => router.navigate('/today')} />
        <ListRow icon={Database} title="2 · Real NASA dataset" sub="Inspiration4 blood counts (OSDR OSD-569)" onPress={() => router.push('/research')} />
        <ListRow icon={Radiation} title="3 · Real space weather" sub="Radiation module with NASA DONKI events" onPress={() => router.push('/radiation')} />
        <ListRow icon={Send} title="4 · Act: queue the medical handoff" sub={on ? 'Creates a report and queues it (simulated)' : 'Start the synthetic case first'} onPress={on ? handoff : () => toast('Start the synthetic Mars case first')} />
      </ListGroup>
      <View style={{ marginTop: 14 }}><Notice tone="watch" title="Honest labels" body="Synthetic scenario = invented. Inspiration4 = real research data. DONKI = real space-weather context, not anyone's personal dose. Handoff queue = simulated." /></View>
    </Page>
  );
}
