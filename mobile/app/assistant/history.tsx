import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Search, Plus, MessageCircle, FileText, Moon, Dumbbell } from 'lucide-react-native';
import { K, web } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, ListGroup, ListRow, PageHead, Tag, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import { useStore } from '@/data/store';

const iconFor = (t: string) => (/dose|report|radiat/i.test(t) ? FileText : /sleep/i.test(t) ? Moon : /train|workout/i.test(t) ? Dumbbell : MessageCircle);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export default function History() {
  const chats = useStore(s => s.chats);
  const [q, setQ] = useState('');
  const list = [...chats].sort((a, b) => b.at - a.at).filter(c => !q || (c.title + ' ' + c.messages.map(m => m.text).join(' ')).toLowerCase().includes(q.toLowerCase()));
  const today = list.filter(c => c.at >= startOfToday());
  const earlier = list.filter(c => c.at < startOfToday());
  const open = (id: string) => router.navigate({ pathname: '/assistant', params: { chat: id, t: String(Date.now()) } });
  const fresh = () => router.navigate({ pathname: '/assistant', params: { chat: 'new', t: String(Date.now()) } });
  const row = (c: (typeof list)[number]) => (
    <ListRow key={c.id} icon={iconFor(c.title)} title={c.title} sub={c.sub} onPress={() => open(c.id)}
      right={<Txt v="mono" color={K.ink3}>{c.at >= startOfToday() ? new Date(c.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Txt>} />
  );
  return (
    <Page title="Chat history" maxWidth={720} header={<TopBar title="Celeste Assistant" right={<Tag label="New chat" icon={Plus} onPress={fresh} />} />} footer={<Button title="New conversation" icon={Plus} onPress={fresh} />}>
      <PageHead kicker="Conversations" title="Chat history" style={{ marginTop: 6 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, height: 46, borderRadius: 23, paddingHorizontal: 16, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair2 }}>
        <Search size={17} color={K.ink3} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search chats" placeholderTextColor={K.ink3} style={[{ flex: 1, fontFamily: 'Geist_400Regular', fontSize: 15, color: K.ink }, web ? ({ outlineStyle: 'none' } as any) : null]} />
      </View>
      {today.length ? <ListGroup kicker="Today" style={{ marginTop: 16 }}>{today.map(row)}</ListGroup> : null}
      {earlier.length ? <ListGroup kicker="Earlier" style={{ marginTop: 12 }}>{earlier.map(row)}</ListGroup> : null}
      {!list.length ? (
        <Card sunk style={{ marginTop: 16, alignItems: 'center', paddingVertical: 28 }}>
          <Kicker color={K.ink2}>No matches</Kicker>
          <Txt v="sub" color={K.ink2} style={{ marginTop: 6 }}>Try another word, or start a new conversation.</Txt>
        </Card>
      ) : null}
    </Page>
  );
}
