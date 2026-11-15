/** Profile › Connected data: WHOOP (the only wearable) and the choice between WHOOP and data by hand. */
import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Activity } from 'lucide-react-native';
import { ListGroup, ListRow, PageHead, TopBar } from '@/kit/ui';
import { SourceSwitch } from '@/kit/SourceSwitch';
import { Page } from '@/kit/page';
import { Status } from '@/kit/settings';
import { useApi } from '@/useApi';

export default function Connected() {
  const { data, reload } = useApi<{ providers: { key: string; status: string; name?: string }[] }>('/api/integrations');
  const whoop = data?.providers.some(p => (p.key === 'whoop' || p.key === 'demo') && p.status === 'connected') ?? false;
  return (
    <Page title="Connected data" maxWidth={640} header={<TopBar title="Connected data" />}>
      <PageHead kicker="Sources" title="Connected data" sub="WHOOP is the only wearable. Connect it, or enter your numbers by hand. Every value shows which source it came from." style={{ marginTop: 6 }} />
      <ListGroup style={{ marginTop: 16 }}>
        <ListRow icon={Activity} title="WHOOP" sub="Recovery, sleep, HRV, strain · syncs every 20 minutes" right={<Status on={whoop} />} onPress={() => router.push('/integrations')} />
      </ListGroup>
      <View style={{ marginTop: 12 }}><SourceSwitch providers={data?.providers} onChanged={reload} /></View>
    </Page>
  );
}
