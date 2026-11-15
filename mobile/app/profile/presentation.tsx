/** Profile › Drills & camera: emergency drill and the camera station. */
import React from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { Camera, Siren } from 'lucide-react-native';
import { ListGroup, ListRow, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { api } from '@/api';

export default function PresentationScreen() {
  const drill = async () => { try { await api('/api/alerts/test', { body: {} }); toast('Test alert sent to flight surgeons and crew'); } catch (e: any) { toast(e.message ?? 'Could not send'); } };
  return (
    <Page title="Drills & camera" maxWidth={640} header={<TopBar title="Drills & camera" />}>
      <PageHead kicker="Presentation" title="Drills & camera" sub="Synthetic data is always labelled SYNTHETIC." style={{ marginTop: 6 }} />
      <ListGroup kicker="Tools" style={{ marginTop: 14 }}>
        <ListRow icon={Siren} title="Send a test emergency alert" sub="A labelled drill to every flight surgeon and crew mate" onPress={drill} />
        {Platform.OS === 'web' ? <ListRow icon={Camera} title="Open the camera station" sub="Scan the room: faces, live video, emergency detection (laptop, demo only)" onPress={() => { try { window.open('/camera', '_blank'); } catch { router.push('/camera'); } }} /> : null}
      </ListGroup>
    </Page>
  );
}
