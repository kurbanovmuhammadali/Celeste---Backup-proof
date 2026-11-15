import React from 'react';
import { View } from 'react-native';
import { Button, Notice, PageHead, Tag, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import FaceScan from '@/FaceScan';
import { goBack } from '@/kit/transition';
import { api } from '@/api';
import { useApi } from '@/useApi';
import { setStore } from '@/data/store';

/** Profile › Face scan: enrol the face (real recognition, 128 numbers on the server), sign in with it, camera station labels you. */
export default function ProfileFace() {
  const { data, reload } = useApi<{ enrolled: boolean; samples: number }>('/api/me/face');
  return (
    <Page title="Face scan" maxWidth={560} header={<TopBar title="Face scan" right={<Tag label={data?.enrolled ? 'On' : 'Off'} tone={data?.enrolled ? 'ok' : 'none'} />} />}>
      <PageHead kicker="Crew recognition" title="Face scan" sub="Sign in with your face (after your email), and let the camera station recognise you among the crew." style={{ marginTop: 6 }} />
      <FaceScan onDone={() => { reload(); goBack('/profile'); }} />
      {data?.enrolled ? (
        <View style={{ marginTop: 16 }}>
          <Button small kind="ghost" title="Delete my face data" onPress={async () => { await api('/api/me/face', { method: 'DELETE' }).catch(() => {}); setStore(s => ({ ...s, face: null })); toast('Face data deleted'); reload(); }} />
        </View>
      ) : null}
      <View style={{ marginTop: 14 }}><Notice tone="watch" title="Convenience, not a vault" body="Face sign-in needs your email too and asks for a head turn, but it is not bank-grade. The email code always works." /></View>
    </Page>
  );
}
