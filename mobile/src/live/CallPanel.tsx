import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Pressy, Txt } from '@/kit/core';
import type { CallState } from './calls';

const mm = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const KIND = { doctor: 'Flight surgeon', family: 'Family', crew: 'Crew mate' } as const;

function Round({ icon: Icon, label, onPress, bg = 'rgba(255,255,255,0.16)', size = 58 }: { icon: any; label: string; onPress: () => void; bg?: string; size?: number }) {
  return <Pressy label={label} onPress={onPress}><View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon size={size * 0.42} color="#fff" /></View></Pressy>;
}

/** Full-screen call UI: ringing (accept / decline), calling, connected with video, mute, camera and hang up. Web only. */
export default function CallPanel({ call, local, remote, accept, decline, hangup, mute, video }: {
  call: CallState; local: MediaStream | null; remote: MediaStream | null; accept: () => void; decline: () => void; hangup: () => void; mute: () => void; video: () => void;
}) {
  const rv = useRef<any>(null), lv = useRef<any>(null);
  useEffect(() => { if (rv.current) rv.current.srcObject = remote; }, [remote, call.phase]);
  useEffect(() => { if (lv.current) lv.current.srcObject = local; }, [local, call.phase]);
  if (Platform.OS !== 'web' || call.phase === 'idle') return null;
  const live = call.phase === 'connected' || call.phase === 'connecting';
  const status = call.phase === 'ringing' ? `Incoming ${call.kind ? KIND[call.kind].toLowerCase() : ''} call` : call.phase === 'calling' ? 'Calling…' : call.phase === 'connecting' ? 'Connecting…' : call.phase === 'connected' ? mm(call.seconds) : (call.note ?? 'Call ended');
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 9000, backgroundColor: '#1C120D', alignItems: 'center', justifyContent: 'center' } as any}>
      {remote ? React.createElement('video', { ref: rv, autoPlay: true, playsInline: true, style: { position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', opacity: live ? 1 : 0 } }) : null}
      <View style={{ position: 'absolute', top: 60, alignItems: 'center', paddingHorizontal: 20 }}>
        <Txt v="mono" color="#E3B79E" upper>{call.kind ? KIND[call.kind] : 'Call'}</Txt>
        <Txt v="title" color="#fff" center style={{ marginTop: 6, fontSize: 28 }}>{call.peerName ?? ''}</Txt>
        <Txt v="sub" color="#E3B79E" center style={{ marginTop: 6 }}>{status}</Txt>
      </View>
      {local && live ? <View style={{ position: 'absolute', right: 16, top: 16, width: 96, height: 128, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>{React.createElement('video', { ref: lv, autoPlay: true, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' } })}</View> : null}
      <View style={{ position: 'absolute', bottom: 56, flexDirection: 'row', gap: 22, alignItems: 'center' }}>
        {call.phase === 'ringing' ? <>
          <Round icon={PhoneOff} label="Decline" onPress={decline} bg="#C0392B" size={68} />
          <Round icon={Phone} label="Answer" onPress={accept} bg="#2E9E5B" size={68} />
        </> : call.phase === 'ended' ? null : <>
          {live ? <Round icon={call.muted ? MicOff : Mic} label="Mute" onPress={mute} bg={call.muted ? '#B8693F' : undefined} /> : null}
          {live ? <Round icon={call.videoOn ? Video : VideoOff} label="Camera" onPress={video} bg={!call.videoOn ? '#B8693F' : undefined} /> : null}
          <Round icon={PhoneOff} label="Hang up" onPress={hangup} bg="#C0392B" size={68} />
        </>}
      </View>
    </View>
  );
}
