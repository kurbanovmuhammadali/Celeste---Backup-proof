/** Profile › Account: privacy, flight surgeon, research, assistant, intro replay, sign out. */
import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ShieldCheck, FileHeart, FileUser, Microscope, Sparkles, Clapperboard, LogOut } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button, ListGroup, ListRow, PageHead, Sheet, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useAuth } from '@/auth';
import { useStore } from '@/data/store';

export default function Account() {
  const { logout } = useAuth();
  const judge = useStore(s => s.settings.judge);
  const [out, setOut] = useState(false);
  const signOut = async () => { setOut(false); await logout(); router.replace('/welcome'); };
  return (
    <Page title="Account" maxWidth={640} header={<TopBar title="Account" />}>
      <PageHead kicker="Account" title="Account & data" style={{ marginTop: 6 }} />
      <ListGroup style={{ marginTop: 16 }}>
        <ListRow icon={ShieldCheck} title="Privacy & account controls" sub="Data permissions and account deletion" onPress={() => router.push('/profile/privacy')} />
        <ListRow icon={FileUser} title="Medical file" sub="CV, health conditions, allergies and files for your surgeon" onPress={() => router.push('/background')} />
        <ListRow icon={FileHeart} title="Flight surgeon" sub="Report and offline handoff queue" onPress={() => router.push('/report')} />
        <ListRow icon={Microscope} title="NASA research layer" sub="Inspiration4 blood counts · research only" onPress={() => router.push('/research')} />
        {!judge ? <ListRow icon={Sparkles} title="Assistant" sub="Ask Celeste about your data" onPress={() => router.push('/assistant')} /> : null}
        <ListRow icon={Clapperboard} title="Replay intro" sub="Watch the Celeste film again" onPress={() => router.push('/intro?replay=1')} />
        <ListRow icon={LogOut} title="Sign out" sub="End this session" onPress={() => setOut(true)} />
      </ListGroup>
      <Sheet open={out} onClose={() => setOut(false)} kicker="Account" title="Sign out of Celeste?">
        <Txt v="sub" color={K.ink2}>Your data stays on the server. You can sign in again with your crew email.</Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <Button title="Cancel" kind="secondary" style={{ flex: 1 }} onPress={() => setOut(false)} />
          <Button title="Sign out" style={{ flex: 1 }} onPress={signOut} />
        </View>
      </Sheet>
    </Page>
  );
}
