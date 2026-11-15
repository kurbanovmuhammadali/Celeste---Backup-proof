import React from 'react';
import { router } from 'expo-router';
import { House, Dumbbell, PersonStanding, Sparkles, User, X } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { ListGroup, ListRow, PageHead, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { goBack } from '@/kit/transition';

const ITEMS = [
  { icon: House, title: 'Dashboard', sub: 'Today’s health snapshot', to: '/today' },
  { icon: Dumbbell, title: 'Training', sub: 'Workouts and weekly summary', to: '/hazards?tab=training' },
  { icon: PersonStanding, title: 'Body', sub: '3D systems and analytics', to: '/body' },
  { icon: Sparkles, title: 'Assistant', sub: 'Voice and chat', to: null },
  { icon: User, title: 'Profile', sub: 'Settings and data sources', to: '/profile' },
];

export default function AssistantMenu() {
  return (
    <Page title="Celeste menu" maxWidth={640} header={<TopBar title="Celeste Assistant" right={<Tag label="Close" icon={X} onPress={() => goBack()} />} />}>
      <PageHead kicker="Navigation" title="CELESTE menu" sub="Jump to another part of the app." style={{ marginTop: 6 }} />
      <ListGroup style={{ marginTop: 18 }}>
        {ITEMS.map(i => (
          <ListRow key={i.title} icon={i.icon} title={i.title} sub={i.sub} current={!i.to}
            right={!i.to ? <Txt v="caption" color={K.copperInk}>Current</Txt> : undefined}
            onPress={() => (i.to ? router.navigate(i.to as any) : goBack())} />
        ))}
      </ListGroup>
    </Page>
  );
}
