/**
 * Mission-health UI pieces shared by Home, Mission, Check, Body and the report:
 * source & freshness chip, hazard rings, the attention card, reading rows + detail sheet, SOS, demo badge.
 * Everything animates: chips pop, rings fill, the attention card breathes once when it changes.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Path } from 'react-native-svg';
import { ChevronRight, RefreshCw, ShieldAlert, Siren, Watch } from 'lucide-react-native';
import { useApi } from '../useApi';
import { K, MOTION, native, toneColor, toneTint } from './tokens';
import { Pressy, Txt, haptic, useFocusTick, useTween } from './core';
import { Dot, Sheet } from './ui';
import { Spark } from './charts';
import { SOURCE, ago, freshWord, type Attention, type Fresh, type Hazard, type Reading } from '../data/mission';

export const FRESH_C: Record<Fresh, string> = { received: K.ok, stale: K.watch, missing: K.ink4, waiting: '#7FA7D9', error: K.flag };

/** "● WHOOP · 6 h" — where a value came from and how fresh it is (+ SYNTHETIC when demo telemetry). */
export function SourceChip({ r, compact }: { r: Reading; compact?: boolean }) {
  const label = r.fresh === 'missing' ? 'Missing · log it' : r.fresh === 'waiting' ? `Waiting to sync · ${SOURCE[r.source]}` : r.fresh === 'error' ? `Error · ${SOURCE[r.source]}`
    : `${r.fresh === 'stale' ? 'Stale · ' : ''}${SOURCE[r.source]}${r.at ? ' · ' + ago(r.at) : ''}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`${freshWord[r.fresh]}, ${label}`}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: FRESH_C[r.fresh] }} />
      <Txt v="mono" color={r.fresh === 'stale' ? '#93621F' : K.ink3} upper numberOfLines={1} style={{ fontSize: compact ? 8.5 : 9.5 }}>{label}</Txt>
      {r.demo && !compact ? <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(180,155,216,0.22)' }}><Txt v="mono" color="#7C62A8" style={{ fontSize: 8 }}>SYNTHETIC</Txt></View> : null}
    </View>
  );
}

export function DemoBadge() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: 'rgba(180,155,216,0.2)' }}>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#9B7FCB' }} />
      <Txt v="mono" color="#6E5598" style={{ fontSize: 9 }}>SYNTHETIC MARS DEMO</Txt>
    </View>
  );
}

/** WHOOP connection status for the header: watch icon + green (connected) / red (not connected) dot. */
export function WhoopStatus() {
  const { data } = useApi<{ providers: { key: string; status: string }[] }>('/api/integrations');
  const on = data?.providers.some(p => (p.key === 'whoop' || p.key === 'demo') && p.status === 'connected') ?? false;
  const known = !!data;
  return (
    <Pressy label={`WHOOP ${on ? 'connected' : 'not connected'}`} onPress={() => router.push('/profile/connected')} hitSlop={6}>
      <View style={{ height: 28, paddingLeft: 8, paddingRight: 10, borderRadius: 14, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Watch size={14} color={K.ink} strokeWidth={1.9} />
        <Dot tone={!known ? 'none' : on ? 'ok' : 'flag'} size={7} pulse={known && !on} />
      </View>
    </Pressy>
  );
}

/** One-tap emergency entry (kept for Profile › Emergency). */
export function Sos() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { const l = Animated.loop(Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: native })); l.start(); return () => l.stop(); }, []);
  return (
    <Pressy label="Emergency protocols" onPress={() => { haptic.firm(); router.push('/emergency'); }} hitSlop={6}>
      <View style={{ height: 28, paddingHorizontal: 11, borderRadius: 14, backgroundColor: K.flag, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, borderRadius: 14, borderWidth: 2, borderColor: K.flag, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] } as any} />
        <Siren size={13} color="#fff" strokeWidth={2.2} />
        <Txt v="caption" color="#fff" style={{ fontFamily: 'Geist_600SemiBold', letterSpacing: 0.6 }}>SOS</Txt>
      </View>
    </Pressy>
  );
}

// ----------------------------------------------------------------------------- hazard rings
function Ring({ h, i, size, onPress }: { h: Hazard; i: number; size: number; onPress?: () => void }) {
  const tick = useFocusTick();
  const fill = useRef(new Animated.Value(0)).current;
  const [f, setF] = useState(0);
  useEffect(() => {
    fill.setValue(0);
    const id = fill.addListener(({ value }) => setF(value));
    Animated.timing(fill, { toValue: 1, duration: 900, delay: 200 + i * 110, easing: MOTION.out, useNativeDriver: false }).start();
    return () => fill.removeListener(id);
  }, [tick, h.tone]);
  const c = toneColor(h.tone), r = size / 2 - 3, C = 2 * Math.PI * r;
  const amount = h.tone === 'flag' ? 1 : h.tone === 'watch' ? 0.66 : h.tone === 'ok' ? 0.33 : 0;
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
    <Pressy label={`${h.long}: ${h.tone === 'none' ? 'no data' : h.tone}. ${h.line}`} onPress={onPress} to={0.94}>
      <View style={{ alignItems: 'center', paddingVertical: 9, borderRadius: 16, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: h.tone === 'flag' ? 'rgba(201,85,59,0.3)' : K.hair }}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={toneTint(h.tone)} strokeWidth={4} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={C * (1 - amount * f)} />
          </Svg>
          <Txt v="headline" style={{ fontSize: 14 }}>{h.key}</Txt>
        </View>
        <Txt v="caption" color={K.ink2} numberOfLines={1} style={{ fontSize: 9.5, marginTop: 4 }}>{h.label}</Txt>
      </View>
    </Pressy>
    </View>
  );
}

export function HazardRings({ hazards, onPress, size = 34 }: { hazards: Hazard[]; onPress?: (h: Hazard) => void; size?: number }) {
  return <View style={{ flexDirection: 'row', gap: 6 }}>{hazards.map((h, i) => <Ring key={h.key} h={h} i={i} size={size} onPress={() => onPress?.(h)} />)}</View>;
}

// ----------------------------------------------------------------------------- attention card
export function AttentionCard({ a, onRemeasure, onCall, extra }: { a: Attention; onRemeasure?: () => void; onCall?: () => void; extra?: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [why, setWhy] = useState(false);
  useEffect(() => { // breathe once whenever the message changes
    pulse.setValue(0);
    Animated.sequence([Animated.delay(500), Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }), Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false })]).start();
  }, [a.title]);
  const c = toneColor(a.tone);
  return (
    <Animated.View style={{ borderRadius: 22, borderWidth: 1.5, backgroundColor: K.cardSolid, padding: 14,
      borderColor: pulse.interpolate({ inputRange: [0, 1], outputRange: [a.tone === 'flag' ? 'rgba(201,85,59,0.28)' : 'rgba(214,154,63,0.3)', c] }) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Dot tone={a.tone} size={7} pulse={a.tone === 'flag'} />
        <Txt v="mono" color={c} upper style={{ fontSize: 9.5 }}>Needs attention</Txt>
      </View>
      <Txt v="headline" style={{ marginTop: 6, fontSize: 17 }}>{a.title}</Txt>
      <Txt v="sub" color={K.ink2} style={{ marginTop: 4 }}>{a.body}</Txt>
      <View style={{ marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: K.cardSunk }}>
        <Txt v="sub"><Txt v="subM">Next: </Txt>{a.action}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {a.remeasure ? (
          <View style={{ flex: 1 }}><Pressy label="Re-measure" onPress={onRemeasure}>
            <View style={{ height: 42, borderRadius: 21, backgroundColor: K.copper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <RefreshCw size={14} color="#fff" /><Txt v="subM" color="#fff">Re-measure {a.remeasure.toUpperCase()}</Txt>
            </View>
          </Pressy></View>
        ) : a.to ? (
          <View style={{ flex: 1 }}><Pressy label="Open" onPress={() => router.push(a.to as any)}>
            <View style={{ height: 42, borderRadius: 21, backgroundColor: K.copper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Txt v="subM" color="#fff">Open</Txt><ChevronRight size={15} color="#fff" />
            </View>
          </Pressy></View>
        ) : null}
        {a.tone === 'flag' && onCall ? <View style={{ flex: 1 }}><Pressy label="Call my doctor" onPress={onCall}>
          <View style={{ height: 42, borderRadius: 21, backgroundColor: K.flag, alignItems: 'center', justifyContent: 'center' }}><Txt v="subM" color="#fff">Call my doctor</Txt></View>
        </Pressy></View> : null}
        <View style={{ flex: 1 }}><Pressy label="Why" onPress={() => setWhy(true)}>
          <View style={{ height: 42, borderRadius: 21, borderWidth: 1.2, borderColor: K.copperSoft, alignItems: 'center', justifyContent: 'center' }}><Txt v="subM" color={K.copperInk}>Why?</Txt></View>
        </Pressy></View>
      </View>
      <Sheet open={why} onClose={() => setWhy(false)} kicker="How Celeste decided" title={a.title}>
        <Txt v="sub" color={K.ink2}>Celeste looks at several signals together instead of alerting on each one. These fed this card:</Txt>
        <View style={{ marginTop: 10, gap: 6 }}>{a.signals.map(s => <Txt key={s} v="subM">· {s.toUpperCase()}</Txt>)}</View>
        {extra ? <View style={{ marginTop: 12 }}>{extra}</View> : null}
        <Txt v="caption" color={K.ink3} style={{ marginTop: 12 }}>Each signal is compared only with your own baseline from the same device and method. This is guidance, not a diagnosis — red items always go to the flight surgeon.</Txt>
      </Sheet>
    </Animated.View>
  );
}

// ----------------------------------------------------------------------------- readings
export function ReadingRow({ r, onPress, first }: { r: Reading; onPress?: () => void; first?: boolean }) {
  return (
    <Pressy label={`${r.label} ${r.text}`} onPress={onPress} to={0.98}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: K.hair }}>
        <Dot tone={r.tone} size={7} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt v="subM" numberOfLines={1}>{r.label}</Txt>
          <View style={{ marginTop: 2 }}><SourceChip r={r} compact /></View>
        </View>
        <Txt v="headline" tabular color={r.value == null ? K.ink3 : K.ink}>{r.text}</Txt>
        <ChevronRight size={15} color={K.ink3} />
      </View>
    </Pressy>
  );
}

/** Detail for one value: number, source, freshness, confidence, the same-source baseline and its trend. */
export function ReadingSheet({ r, onClose }: { r: Reading | null; onClose: () => void }) {
  const conf = useTween(r?.confidence ?? 0, 700);
  return (
    <Sheet open={!!r} onClose={onClose} kicker={r ? `${SOURCE[r.source]} · ${freshWord[r.fresh]}` : ''} title={r?.label ?? ''}>
      {r ? (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Txt v="display" tabular>{r.text}</Txt>
            {r.baseline ? <Txt v="sub" color={K.ink2}>baseline {r.baseline.lo}–{r.baseline.hi}</Txt> : null}
          </View>
          <View style={{ marginTop: 6 }}><SourceChip r={r} /></View>
          {r.series.some(v => v != null) ? <View style={{ marginTop: 12 }}><Spark values={r.series.slice(-21)} w={300} h={44} /></View> : null}
          {r.value != null ? (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="caption" color={K.ink2}>Sensor confidence</Txt><Txt v="subM" color={r.confidence < 85 ? K.watch : K.ok}>{Math.round(conf)}%</Txt></View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: K.copperTint, marginTop: 5, overflow: 'hidden' }}><View style={{ height: 6, width: `${conf}%`, backgroundColor: r.confidence < 85 ? K.watch : K.ok }} /></View>
              {r.note ? <Txt v="caption" color={K.ink2} style={{ marginTop: 6 }}>{r.note}</Txt> : null}
            </View>
          ) : <Txt v="sub" color={K.ink2} style={{ marginTop: 10 }}>No reading yet. Add it in today’s check.</Txt>}
          {r.baseline ? <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>Compared only with {r.baseline.label}. Other devices are never mixed in.</Txt> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {r.value != null && ['hrv', 'rhr', 'spo2'].includes(r.key) ? (
              <View style={{ flex: 1 }}><Pressy label="Re-measure" onPress={() => { onClose(); router.push({ pathname: '/remeasure', params: { metric: r.key } }); }}>
                <View style={{ height: 44, borderRadius: 22, backgroundColor: K.copper, alignItems: 'center', justifyContent: 'center' }}><Txt v="subM" color="#fff">Re-measure</Txt></View>
              </Pressy></View>
            ) : null}
            {r.value == null || r.fresh === 'stale' ? (
              <View style={{ flex: 1 }}><Pressy label="Log it" onPress={() => { onClose(); router.navigate('/check'); }}>
                <View style={{ height: 44, borderRadius: 22, borderWidth: 1.2, borderColor: K.copperSoft, alignItems: 'center', justifyContent: 'center' }}><Txt v="subM" color={K.copperInk}>Log it in today’s check</Txt></View>
              </Pressy></View>
            ) : null}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

export function ShelterBanner({ shelterBy }: { shelterBy: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const left = Math.max(0, shelterBy - now), m = Math.floor(left / 60e3), s = Math.floor((left % 60e3) / 1000);
  return (
    <Pressy label="Solar particle event, open shelter checklist" onPress={() => router.push('/radiation')}>
      <View style={{ borderRadius: 22, padding: 14, backgroundColor: '#2B1A12' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Txt v="mono" color="#F3B48D" upper style={{ fontSize: 9.5 }}>Solar particle event</Txt>
          <Txt v="mono" color="#F3D9C6" upper style={{ fontSize: 9.5 }}>NASA DONKI · context</Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Txt v="hero" tabular color="#fff" style={{ fontSize: 34 }}>{m}:{String(s).padStart(2, '0')}</Txt>
          <Txt v="sub" color="#F3D9C6">to reach the shelter</Txt>
          <View style={{ flex: 1 }} /><ShieldAlert size={20} color="#F3B48D" />
        </View>
      </View>
    </Pressy>
  );
}

/** Tiny arc icon used in section heads. */
export function Arc({ size = 14, color = K.copper }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M3 18 A10 10 0 0 1 21 18" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" /></Svg>;
}
