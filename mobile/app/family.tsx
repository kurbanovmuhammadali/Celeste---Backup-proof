import React, { useState } from 'react';
import { View } from 'react-native';
import { Phone, Share2, Trash2 } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, PageHead, Sheet, Tag, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { api } from '@/api';
import { useApi } from '@/useApi';
import { useLive } from '@/live/Live';

type Contact = { id: number; name: string; relation: string; token: string; online: boolean; unread: number };
type Msg = { id: number; fromFamily: number; text: string; at: string };
const REL = ['Mother', 'Father', 'Wife / husband', 'Child', 'Sibling', 'Friend'];
const link = (t: string) => `${typeof location !== 'undefined' ? location.origin : ''}/f/${t}`;
const text = (c: Contact) => `Hi ${c.name}! Open this private link to call me or send me a message from space: ${link(c.token)}`;
const copy = (t: string) => { try { (navigator as any).clipboard?.writeText(t); toast('Link copied'); } catch { toast(t); } };

/** Add a family member in two taps: name, relation, then send them a private link. They need no account and no app. */
export default function Family() {
  const { data, reload } = useApi<{ family: Contact[] }>('/api/me/family');
  const live = useLive();
  const [name, setName] = useState(''), [rel, setRel] = useState(REL[0]), [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Contact | null>(null), [chat, setChat] = useState<Contact | null>(null), [msgs, setMsgs] = useState<Msg[]>([]), [draft, setDraft] = useState('');
  const family = data?.family ?? [];

  const add = async () => { setBusy(true); try { const r = await api<{ contact: Contact }>('/api/me/family', { body: { name, relation: rel } }); setName(''); setAdded(r.contact); reload(); } catch (e: any) { toast(e.message); } finally { setBusy(false); } };
  const openChat = async (c: Contact) => { setChat(c); setMsgs((await api<{ messages: Msg[] }>(`/api/me/family/${c.id}/messages`)).messages); reload(); };
  const sendMsg = async () => { if (!chat || !draft.trim()) return; await api(`/api/me/family/${chat.id}/messages`, { body: { text: draft } }); setDraft(''); setMsgs((await api<{ messages: Msg[] }>(`/api/me/family/${chat.id}/messages`)).messages); };
  const shareBtns = (c: Contact) => (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <Button small icon={Share2} title="WhatsApp" onPress={() => window.open(`https://wa.me/?text=${encodeURIComponent(text(c))}`, '_blank')} />
      <Button small kind="secondary" title="Telegram" onPress={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(link(c.token))}&text=${encodeURIComponent(`Hi ${c.name}! Call me or message me from space:`)}`, '_blank')} />
      <Button small kind="secondary" title="Copy link" onPress={() => copy(text(c))} />
    </View>
  );

  return (
    <Page title="Family" maxWidth={640} onRefresh={reload} header={<TopBar title="Family and friends" />}>
      <PageHead kicker="Stay close" title="Call home" sub="Add a family member, send them a private link. They open it on any phone or computer, no app and no account, and can call you or leave a message." style={{ marginTop: 6 }} />

      {family.map(c => (
        <Card key={c.id} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}><Txt v="headline">{c.name}</Txt><Txt v="caption" color={K.ink2}>{c.relation || 'Family'}</Txt></View>
            <Tag label={c.online ? 'Online' : 'Offline'} tone={c.online ? 'ok' : 'none'} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}><Button small icon={Phone} title={c.online ? 'Call' : 'Ring when online'} disabled={live.busy} onPress={() => live.call(`f:${c.id}`, 'family', c.name)} /></View>
            <View style={{ flex: 1 }}><Button small kind="secondary" title={c.unread ? `Messages (${c.unread})` : 'Messages'} onPress={() => openChat(c)} /></View>
            <Pressy label={`Remove ${c.name}`} onPress={async () => { await api(`/api/me/family/${c.id}`, { method: 'DELETE' }); reload(); }}><View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Trash2 size={17} color={K.flag} /></View></Pressy>
          </View>
          {shareBtns(c)}
        </Card>
      ))}

      <Card style={{ marginTop: 12 }}>
        <Kicker>Add someone</Kicker>
        <Field label="Name" value={name} onChange={setName} keyboard="default" placeholder="Mom" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{REL.map(r => <Chip key={r} label={r} on={rel === r} onPress={() => setRel(r)} />)}</View>
        <View style={{ marginTop: 14 }}><Button title="Add and get link" disabled={name.trim().length < 2} loading={busy} onPress={add} /></View>
      </Card>
      <View style={{ marginTop: 12 }}><Notice tone="watch" title="Calls need a good link" body="Calls go straight between the two devices. Over very long distances there is a delay, so messages are the reliable way to reach family; calls work on the same network or when the link is open." /></View>

      <Sheet open={!!added} onClose={() => setAdded(null)} kicker="Added" title={added ? `${added.name} is added` : ''}>
        <Txt v="sub" color={K.ink2}>Send them this private link. Whoever has it can call you, so only share it with them.</Txt>
        {added ? shareBtns(added) : null}
      </Sheet>
      <Sheet open={!!chat} onClose={() => setChat(null)} kicker="Messages" title={chat?.name ?? ''}>
        <View style={{ gap: 8, maxHeight: 320 }}>{msgs.length ? msgs.map(m => <View key={m.id} style={{ alignSelf: m.fromFamily ? 'flex-start' : 'flex-end', maxWidth: '85%', backgroundColor: m.fromFamily ? K.cardSunk : K.copper, borderRadius: 14, padding: 10 }}><Txt v="sub" color={m.fromFamily ? K.ink : '#fff'}>{m.text}</Txt></View>) : <Txt v="sub" color={K.ink3}>No messages yet.</Txt>}</View>
        <Field label="Write a message" value={draft} onChange={setDraft} keyboard="default" placeholder="I miss you all" />
        <View style={{ marginTop: 10 }}><Button small title="Send" disabled={!draft.trim()} onPress={sendMsg} /></View>
      </Sheet>
    </Page>
  );
}
