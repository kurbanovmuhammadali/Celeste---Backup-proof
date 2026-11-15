import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Card, Notice, PageHead, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useApi } from '@/useApi';

type O = {
  summary: { astronauts: number; doctors: number; reports: number; open: number; oldestOpenMinutes: number | null };
  doctors: { id: number; name: string; answered: number; avgResponseMinutes: number | null; lastAnswerAt: string | null }[];
  astronauts: { id: number; name: string; mission: string; openReports: number; lastSymptoms: { list: string[]; at: string } | null }[];
  reports: { astronaut: string; title: string; reason: string; receivedAt: string; answered: boolean; doctor: string | null; answerNote: string | null; responseMinutes: number | null }[];
};
const dur = (m: number | null) => (m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);

/** Team leader: how every astronaut is doing, whether the doctors are answering, and exactly what they told the crew. */
export default function Leader() {
  const { data, reload, error } = useApi<O>('/api/leader/overview');
  return (
    <Page title="Team overview" maxWidth={900} onRefresh={reload} header={<TopBar title="Team overview" />}>
      <PageHead kicker="Team leader" title="Crew, doctors and reports" sub="Every astronaut's state, every report they sent, and what the doctors answered." style={{ marginTop: 6 }} />
      {error ? <View style={{ marginTop: 14 }}><Notice tone="flag" title="Not available" body="This page is for the team leader account." /></View> : null}
      {data ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
            {[['Astronauts', data.summary.astronauts], ['Doctors', data.summary.doctors], ['Reports', data.summary.reports], ['Waiting for a doctor', data.summary.open]].map(([l, v]) => (
              <Card key={String(l)} style={{ flexGrow: 1, minWidth: 140 }}><Kicker>{String(l)}</Kicker><Txt v="title" style={{ marginTop: 4 }}>{String(v)}</Txt></Card>
            ))}
          </View>
          {data.summary.oldestOpenMinutes != null && data.summary.oldestOpenMinutes > 120 ? <View style={{ marginTop: 12 }}><Notice tone="watch" title="A report is waiting" body={`The oldest unanswered report has waited ${dur(data.summary.oldestOpenMinutes)}.`} /></View> : null}

          <Kicker style={{ marginTop: 22 }}>Are the doctors doing their work?</Kicker>
          {data.doctors.map(d => (
            <Card key={d.id} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="headline" style={{ flex: 1 }}>{d.name}</Txt><Tag label={`${d.answered} answered`} tone={d.answered ? 'ok' : 'watch'} /></View>
              <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Average time to answer: {dur(d.avgResponseMinutes)} · last answer {d.lastAnswerAt ? `${d.lastAnswerAt} UTC` : 'none yet'}</Txt>
            </Card>
          ))}

          <Kicker style={{ marginTop: 22 }}>Astronauts</Kicker>
          {data.astronauts.map(a => (
            <Card key={a.id} style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/admin/[id]', params: { id: String(a.id) } })} label={a.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="headline" style={{ flex: 1 }}>{a.name}</Txt>{a.openReports ? <Tag label={`${a.openReports} open`} tone="flag" /> : <Tag label="no open reports" tone="ok" />}</View>
              <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>{a.mission}{a.lastSymptoms?.list.length ? ` · last symptoms: ${a.lastSymptoms.list.join(', ')}` : ''}</Txt>
            </Card>
          ))}

          <Kicker style={{ marginTop: 22 }}>Reports and what the doctors said</Kicker>
          {data.reports.map((r, i) => (
            <Card key={i} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="headline" style={{ flex: 1 }}>{r.title}</Txt><Tag label={r.answered ? 'answered' : 'waiting'} tone={r.answered ? 'ok' : 'flag'} /></View>
              <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>{r.astronaut} · {r.receivedAt} UTC · {r.reason}</Txt>
              {r.answered ? <Txt v="sub" style={{ marginTop: 8 }}>{r.doctor} ({dur(r.responseMinutes)}): {r.answerNote || 'Acknowledged, no note.'}</Txt> : null}
            </Card>
          ))}
        </>
      ) : null}
    </Page>
  );
}
