/** Shared training visuals: session hero card, workout row, stat pair, muscle badge. */
import React from 'react';
import { Image, ImageBackground, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bike, Dumbbell, Footprints, StretchHorizontal, Check, Play } from 'lucide-react-native';
import { ELEV, K, RAD } from './tokens';
import { Kicker, Pressy, Txt } from './core';
import type { Session } from '../data/training';

export const deviceIcon = (s: Session) => (s.device === 'CEVIS' ? Bike : s.device === 'ARED' ? Dumbbell : s.device === 'T2' ? Footprints : StretchHorizontal);

export function SessionHero({ s, kicker, onPress, height = 190, done, minimal }: { s: Session; kicker: string; onPress?: () => void; height?: number; done?: boolean; minimal?: boolean }) {
  const inner = minimal ? (
    <LinearGradient colors={['rgba(28,18,13,0)', 'rgba(28,18,13,0.45)']} locations={[0.6, 1]} style={{ flex: 1, padding: 12, justifyContent: 'flex-end', alignItems: 'flex-start' }}>
      <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center' }}><Txt v="mono" color={K.ink} upper style={{ fontSize: 9.5 }}>{kicker}</Txt></View>
    </LinearGradient>
  ) : (
    <LinearGradient colors={['rgba(28,18,13,0.0)', 'rgba(28,18,13,0.25)', 'rgba(28,18,13,0.82)']} locations={[0, 0.4, 1]} style={{ flex: 1, padding: 16, justifyContent: 'flex-end' }}>
      <Kicker color="#F3D9C6">{kicker}</Kicker>
      <Txt v="display" color="#fff" style={{ marginTop: 4, fontSize: 28 }}>{s.title}</Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center' }}><Txt v="caption" color="#fff">{s.device} · {s.minutes} min</Txt></View>
          {done ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: K.ok }}><Check size={12} color="#fff" strokeWidth={3} /><Txt v="caption" color="#fff">Done</Txt></View> : null}
        </View>
        {onPress ? <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Play size={15} color={K.copper} fill={K.copper} /></View> : null}
      </View>
    </LinearGradient>
  );
  const card = (
    <View style={[{ height, borderRadius: RAD.l, overflow: 'hidden', backgroundColor: K.cocoa }, ELEV.float]}>
      {s.img ? <ImageBackground source={s.img} resizeMode="cover" style={{ flex: 1 }} imageStyle={{ width: '100%', height: '100%' }}>{inner}</ImageBackground>
        : <LinearGradient colors={['#C98257', '#8E4A2A', '#3A2A22']} style={{ flex: 1 }}>{inner}</LinearGradient>}
    </View>
  );
  return onPress ? <Pressy onPress={onPress} label={s.title} to={0.98}>{card}</Pressy> : card;
}

export function SessionRow({ s, right, onPress }: { s: Session; right?: React.ReactNode; onPress?: () => void }) {
  const Icon = deviceIcon(s);
  return (
    <Pressy onPress={onPress} label={s.title} to={0.985}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: K.copperTint, alignItems: 'center', justifyContent: 'center' }}>
          {s.img ? <Image source={s.thumb ?? s.img} style={{ width: 56, height: 56 }} resizeMode="cover" /> : <Icon size={22} color={K.copper} />}
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="bodyM">{s.title}</Txt>
          <Txt v="caption" color={K.ink2}>{s.device} · {s.kind}</Txt>
        </View>
        {right}
      </View>
    </Pressy>
  );
}

export function StatPair({ items }: { items: [string, string][] }) {
  return (
    <View style={[{ flexDirection: 'row', backgroundColor: K.card, borderRadius: RAD.m, borderWidth: 1, borderColor: K.hair, paddingVertical: 14 }, ELEV.card]}>
      {items.map(([v, l], i) => (
        <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 1 : 0, borderLeftColor: K.hair }}>
          <Txt v="title" tabular>{v}</Txt>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 2 }}>{l}</Txt>
        </View>
      ))}
    </View>
  );
}

export const fmtClock = (sec: number) => `${String(Math.floor(Math.max(0, sec) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, '0')}`;
