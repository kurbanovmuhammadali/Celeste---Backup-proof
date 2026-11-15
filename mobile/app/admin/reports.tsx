import React from 'react';
import { View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button, Card, Notice, PageHead, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { api } from '@/api';
import { useApi } from '@/useApi';

type R = { id: number; category: string; message: string; status: string; at: string; aboutId: number; about: string; crew: string; voices: number };
/** Anonymous concerns raised by crew mates. The author is never stored in a readable form; "voices" counts different people. */
export default function Reports() {
  const { data, reload } = useApi<{ reports: R[]; open: number }>('/api/admin/reports');
  return (
    <Page title="Crew concerns" maxWidth={760} onRefresh={reload} header={<TopBar title="Crew concerns" />}>
      <PageHead kicker="Anonymous" title="What the crew noticed" sub="Concerns about a crew mate, written without a name. Several different people raising the same person is a stronger signal. Check on the person; do not reveal the source." style={{ marginTop: 6 }} />
      {(data?.reports ?? []).map(r => (
        <Card key={r.id} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="headline" style={{ flex: 1 }}>{r.about}</Txt><Tag label={r.category} /><Tag label={r.status === 'new' ? 'New' : 'Seen'} tone={r.status === 'new' ? 'flag' : 'none'} /></View>
          <Txt v="caption" color={K.ink2}>{r.crew} · {r.at} UTC · {r.voices} different {r.voices === 1 ? 'person' : 'people'} in the last 14 days</Txt>
          <Txt v="sub" style={{ marginTop: 8 }}>{r.message}</Txt>
          {r.status === 'new' ? <View style={{ marginTop: 10 }}><Button small kind="secondary" title="Mark as seen" onPress={async () => { await api(`/api/admin/reports/${r.id}/seen`, { body: {} }); reload(); }} /></View> : null}
        </Card>
      ))}
      {data && !data.reports.length ? <View style={{ marginTop: 16 }}><Notice tone="ok" title="No concerns" body="Nobody has raised anything." /></View> : null}
    </Page>
  );
}
