import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Phone } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button } from '@/kit/ui';
import { Field } from '@/kit/fields';
import { api } from '@/api';
import CallPanel from '@/live/CallPanel';
import { useCalls } from '@/live/calls';

type Msg = { id: number; fromFamily: number; text: string; at: string };
/** Public page for a family member (no account): call the astronaut or leave a message. The link is the credential. */
export default function FamilyGuest() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<{ name: string; astronaut: string; available: boolean } | 'bad' | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]), [draft, setDraft] = useState('');
  const c = useCalls(typeof token === 'string' ? `role=family&token=${token}` : null);
  const load = () => { api<{ name: string; astronaut: string; available: boolean }>(`/api/family/${token}/info`).then(setInfo).catch(() => setInfo('bad')); api<{ messages: Msg[] }>(`/api/family/${token}/messages`).then(r => setMsgs(r.messages)).catch(() => {}); };
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [token]);
  const send = async () => { if (!draft.trim()) return; await api(`/api/family/${token}/messages`, { body: { text: draft } }).catch(() => {}); setDraft(''); load(); };
  const box = { flex: 1, backgroundColor: '#1C120D', alignItems: 'center' as const, padding: 22, paddingTop: 48 };
  if (info === 'bad') return <View style={box}><Txt v="title" color="#fff" center>This link is not valid</Txt><Txt v="sub" color="#E3B79E" center style={{ marginTop: 8 }}>Ask for a new link.</Txt></View>;
  if (!info) return <View style={box} />;
  return (
    <View style={box}>
      <Txt v="mono" color="#E3B79E" upper>✦ HMSC · family line</Txt>
      <Txt v="hero" color="#fff" center style={{ marginTop: 14, fontSize: 32 }}>Hi {info.name}</Txt>
      <Txt v="sub" color="#E3B79E" center style={{ marginTop: 6 }}>{info.astronaut} {info.available ? 'is online now.' : 'is not online right now. Leave a message, or ring and they will see it.'}</Txt>
      <View style={{ marginTop: 22, width: '100%', maxWidth: 380 }}><Button icon={Phone} title={`Call ${info.astronaut}`} disabled={c.call.phase !== 'idle' && c.call.phase !== 'ended'} onPress={() => c.startCall('owner', 'family', info.astronaut)} /></View>
      <View style={{ width: '100%', maxWidth: 380, marginTop: 22, gap: 8 }}>
        <Kicker color="#E3B79E">Messages</Kicker>
        {msgs.length ? msgs.slice(-8).map(m => <View key={m.id} style={{ alignSelf: m.fromFamily ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: m.fromFamily ? K.copper : 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 10 }}><Txt v="sub" color="#fff">{m.text}</Txt></View>) : <Txt v="sub" color="#A8958B">No messages yet.</Txt>}
        <Field label="Write to them" value={draft} onChange={setDraft} keyboard="default" placeholder="We love you" />
        <Button small kind="secondary" title="Send" disabled={!draft.trim()} onPress={send} />
      </View>
      <Txt v="caption" color="#A8958B" center style={{ marginTop: 20, maxWidth: 340 }}>Private link: only share it with people you trust. Calls use your microphone and camera and go straight to {info.astronaut}.</Txt>
      <CallPanel {...c} />
    </View>
  );
}
