/**
 * Radiation monitor. Personal dosimeter = the dose (cumulative, 14-day interval bars, coverage gaps).
 * NASA DONKI solar particle events and CMEs are shown as space-weather CONTEXT only — never as personal dose.
 * During a solar particle event the shelter countdown + checklist take over the top of the screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Check, ShieldCheck } from 'lucide-react-native';
import { K, MOTION, native } from '@/kit/tokens';
import { Kicker, Pressy, Txt, haptic, useTween } from '@/kit/core';
import { Button, Card, Dot, PageHead, TopBar } from '@/kit/ui';
import { router } from 'expo-router';
import { Page } from '@/kit/page';
import { ShelterBanner, SourceChip } from '@/kit/mission';
import { useMission } from '@/data/mission';
import { setStore } from '@/data/store';

type Ev = { id: string; kind: 'SEP' | 'CME'; at: string; text: string };
let cache: { at: number; events: Ev[]; live: boolean } | null = null;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** NASA DONKI (public API, DEMO_KEY, cached for an hour). Falls back to an offline note — never invented events. */
function useDonki() {
  const [s, setS] = useState(cache);
  useEffect(() => {
    if (cache && Date.now() - cache.at < 3600e3) return;
    const end = new Date(), start = new Date(Date.now() - 30 * 864e5);
    const q = `startDate=${iso(start)}&endDate=${iso(end)}&api_key=DEMO_KEY`;
    Promise.all([
      fetch(`https://api.nasa.gov/DONKI/SEP?${q}`).then(r => (r.ok ? r.json() : [])),
      fetch(`https://api.nasa.gov/DONKI/CME?${q}`).then(r => (r.ok ? r.json() : [])),
    ]).then(([sep, cme]) => {
      const events: Ev[] = [
        ...(Array.isArray(sep) ? sep : []).map((e: any) => ({ id: e.sepID, kind: 'SEP' as const, at: e.eventTime, text: `Solar particle event${e.instruments?.[0]?.displayName ? ' · ' + e.instruments[0].displayName : ''}` })),
        ...(Array.isArray(cme) ? cme : []).map((e: any) => { const a = (e.cmeAnalyses || []).find((x: any) => x.isMostAccurate) || e.cmeAnalyses?.[0]; return { id: e.activityID, kind: 'CME' as const, at: e.startTime, text: `Coronal mass ejection${a?.speed ? ` · ${Math.round(a.speed)} km/s` : ''}` }; }),
      ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
      cache = { at: Date.now(), events, live: true }; setS(cache);
    }).catch(() => { cache = { at: Date.now(), events: [], live: false }; setS(cache); });
  }, []);
  return s;
}

function Bar({ v, max, i, gap, today }: { v: number | null; max: number; i: number; gap: boolean; today: boolean }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 700, delay: 150 + i * 40, easing: MOTION.out, useNativeDriver: false }).start(); }, []);
  const h = v == null ? 0 : Math.max(4, (v / max) * 70);
  return (
    <View style={{ flex: 1, height: 74, justifyContent: 'flex-end', alignItems: 'center' }}>
      {gap ? <View style={{ width: '70%', height: 50, borderRadius: 4, borderWidth: 1.2, borderStyle: 'dashed', borderColor: K.flag }} /> : (
        <Animated.View style={{ width: '70%', borderRadius: 4, backgroundColor: today ? K.copper : K.copperSoft, height: a.interpolate({ inputRange: [0, 1], outputRange: [0, h] }) }} />
      )}
    </View>
  );
}

const SHELTER = ['Move to the shielded crew quarters', 'Take your personal dosimeter', 'Close the hatch behind you', 'Log the start time', 'Stay until the all-clear'];

export default function RadiationScreen() {
  const m = useMission();
  const rad = m.radiation;
  const total = useTween(rad.total, 1100);
  const donki = useDonki();
  const [done, setDone] = useState<number[]>([]);
  const last14 = m.readings.dose.series.slice(-14);
  const max = Math.max(0.6, ...last14.filter((v): v is number => v != null));
  const startSpe = () => { haptic.firm(); setDone([]); setStore(s => ({ ...s, spe: { startedAt: Date.now(), shelterBy: Date.now() + 15 * 60e3 } })); };
  const endSpe = () => { haptic.success(); setStore(s => ({ ...s, spe: null })); };

  return (
    <Page title="Radiation" maxWidth={720} header={<TopBar title="Radiation" />}>
      <PageHead kicker="Personal dosimeter" title="Radiation monitor" sub="Your dosimeter is your dose. Space weather is shown as context only." style={{ marginTop: 6 }} />
      {rad.spe ? (
        <View style={{ marginTop: 14, gap: 10 }}>
          <ShelterBanner shelterBy={rad.spe.shelterBy} />
          <Card>
            <Kicker>Shelter checklist · works offline</Kicker>
            {SHELTER.map((s, i) => {
              const on = done.includes(i);
              return (
                <Pressy key={s} label={s} role="checkbox" checked={on} onPress={() => { haptic.tap(); setDone(d => (on ? d.filter(x => x !== i) : [...d, i])); }} to={0.98}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? K.ok : 'transparent', borderWidth: 1.5, borderColor: on ? K.ok : K.hair2 }}>{on ? <Check size={15} color="#fff" strokeWidth={3} /> : null}</View>
                    <Txt v="bodyM" color={on ? K.ink3 : K.ink} style={{ flex: 1, textDecorationLine: on ? 'line-through' : 'none' }}>{s}</Txt>
                  </View>
                </Pressy>
              );
            })}
            <Button title="All-clear received · end alert" kind="secondary" onPress={endSpe} style={{ marginTop: 10 }} />
          </Card>
        </View>
      ) : null}

      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="subM">Mission dose</Txt>
          <SourceChip r={m.readings.dose} compact />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Txt v="hero" tabular style={{ fontSize: 40 }}>{total.toFixed(1)}</Txt>
          <Txt v="sub" color={K.ink2}>mSv of {rad.limit} mSv career limit</Txt>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: K.copperTint, marginTop: 8, overflow: 'hidden' }}>
          <View style={{ height: 8, width: `${Math.max(1, (total / rad.limit) * 100)}%`, backgroundColor: K.copper, borderRadius: 4 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 3, marginTop: 16 }}>
          {last14.map((v, i) => <Bar key={i} v={v} max={max} i={i} gap={v == null} today={i === last14.length - 1} />)}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Txt v="caption" color={K.ink2}>14 days · interval 7 d {rad.interval} mSv</Txt>
          <Txt v="caption" color={rad.gaps.length ? K.flag : K.ok}>{rad.gaps.length ? `${rad.gaps.length} coverage gap${rad.gaps.length > 1 ? 's' : ''} (${rad.gaps.map(g => (g === 0 ? 'today' : `${g} d ago`)).join(', ')})` : 'No coverage gaps'}</Txt>
        </View>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Txt v="subM">Space weather</Txt>
          <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: K.watchTint, justifyContent: 'center' }}><Txt v="caption" color="#93621F">Context, not your dose</Txt></View>
        </View>
        <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5, marginTop: 4 }}>{donki == null ? 'NASA DONKI · loading…' : donki.live ? 'NASA DONKI · last 30 days' : 'NASA DONKI · offline — will refresh when the link is up'}</Txt>
        {donki?.events.length ? donki.events.map((e, i) => (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 6 }}>
            <Dot tone={e.kind === 'SEP' ? 'watch' : 'none'} />
            <Txt v="sub" style={{ flex: 1 }} numberOfLines={1}>{e.text}</Txt>
            <Txt v="mono" color={K.ink3} style={{ fontSize: 9.5 }}>{new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Txt>
          </View>
        )) : donki ? <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>{donki.live ? 'No solar particle events or CMEs reported in the last 30 days.' : 'No connection to NASA right now.'}</Txt> : null}
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Txt v="subM">Log your dosimeter</Txt>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Enter what the personal dosimeter shows (interval dose, device, place). The mission total only counts days that have a reading, so gaps stay visible.</Txt>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <View style={{ flex: 1 }}><Button small title="Add a reading" onPress={() => router.push('/radiation-log')} /></View>
          <View style={{ flex: 1 }}><Button small kind="secondary" title="Practice drill" onPress={() => router.push('/shelter')} /></View>
        </View>
      </Card>
      {m.demo && !rad.spe ? (
        <Card sunk style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={18} color={K.copper} />
            <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Demo: rehearse the shelter flow with a simulated solar particle event (15-minute countdown).</Txt>
          </View>
          <Button title="Simulate solar particle event" kind="secondary" small onPress={startSpe} style={{ marginTop: 10 }} />
        </Card>
      ) : null}
    </Page>
  );
}
