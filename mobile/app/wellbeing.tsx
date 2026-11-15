import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { dayKey, useStore } from '@/data/store';
import type { Wellbeing } from '@/data/store';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { createDraft } from '@/data/handoff';
import { QUESTIONS, SUPPORT, blankWellbeing, saveWellbeing, wellbeingInsight } from '@/data/wellbeing';
import { CARE_MESSAGE } from '@/data/safety';

/** Private wellbeing check. Stays on this device; nothing is sent unless you choose to. */
export default function WellbeingCheck() {
  const all = useStore(s => s.wellbeing);
  const crew = useCrew();
  const sources = useSources(crew);
  const saved = all?.[dayKey(0)];
  const [w, setW] = useState<Wellbeing>(saved ?? blankWellbeing());
  const [done, setDone] = useState(!!saved);
  const ins = wellbeingInsight(all);

  const toDoctor = () => {
    createDraft(crew, computeAttention(crew, sources), w.support === 2 ? 'Confidential: I need support' : 'Confidential: wellbeing concern', ['Private wellbeing check: the crew member asked for support']);
    toast('Confidential draft added to Handoff'); router.navigate('/handoff');
  };
  const save = () => { saveWellbeing(w); setDone(true); toast('Saved on this device'); };

  return (
    <Page title="Wellbeing check" maxWidth={640} header={<TopBar title="Wellbeing check" right={<Tag label="Private" tone="ok" />} />} footer={done ? undefined : <Button title="Save my check" onPress={save} />}>
      <PageHead kicker="Isolation and wellbeing" title="How are you, really?" sub="Five quick answers. This stays on this device. Nothing is shared with the crew or your flight surgeon unless you choose to." style={{ marginTop: 6 }} />
      {done ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          {saved?.support === 2 || w.support === 2 ? <Notice tone="flag" title="You deserve real support" body={CARE_MESSAGE} /> : null}
          <Card>
            <Kicker>Last three days</Kicker>
            {ins.lines.map((l, i) => <Txt key={i} v="sub" color={K.ink2} style={{ marginTop: 6 }}>• {l}</Txt>)}
          </Card>
          {w.support >= 1 || ins.level !== 'ok' ? <Button title={w.support === 2 ? 'Prepare a confidential report for my flight surgeon' : 'Prepare a report for my flight surgeon'} onPress={toDoctor} /> : null}
          <Button kind="ghost" title="Change today's answers" onPress={() => setDone(false)} />
        </View>
      ) : (
        <View>
          {QUESTIONS.map(q => (
            <Card key={q.key} style={{ marginTop: 12 }}>
              <Txt v="subM">{q.label}</Txt>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                {[1, 2, 3, 4, 5].map(n => <View key={n} style={{ flex: 1 }}><Chip label={String(n)} on={w[q.key] === n} onPress={() => setW(v => ({ ...v, [q.key]: n }))} /></View>)}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}><Txt v="caption" color={K.ink3}>1 · {q.low}</Txt><Txt v="caption" color={K.ink3}>5 · {q.high}</Txt></View>
            </Card>
          ))}
          <Card style={{ marginTop: 12 }}>
            <Txt v="subM">Do you need support?</Txt>
            <View style={{ gap: 8, marginTop: 10 }}>{SUPPORT.map((s, i) => <Chip key={s} label={s} on={w.support === i} onPress={() => setW(v => ({ ...v, support: i as 0 | 1 | 2 }))} />)}</View>
            <Field label="Anything you want to write down (optional)" value={w.note ?? ''} onChange={v => setW(x => ({ ...x, note: v.slice(0, 300) }))} keyboard="default" multiline placeholder="Only you can read this" />
          </Card>
        </View>
      )}
    </Page>
  );
}
