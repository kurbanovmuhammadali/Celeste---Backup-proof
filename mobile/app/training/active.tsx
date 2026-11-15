import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Svg, { Circle } from 'react-native-svg';
import { Check, Pause, Play, SkipForward, Square, Sparkles } from 'lucide-react-native';
import { ELEV, K, native } from '@/kit/tokens';
import { Kicker, Pressy, Swap, Txt, haptic } from '@/kit/core';
import { Button, Card, IconBubble, Tag, TopBar } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { StatPair, deviceIcon, fmtClock } from '@/kit/training';
import { completeSession, sessionById } from '@/data/training';
import { Star } from '@/astra';
import { goBack } from '@/kit/transition';

function Ring({ f, size = 132 }: { f: number; size?: number }) {
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={K.copperTint} strokeWidth={8} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={K.copper} strokeWidth={8} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - Math.min(1, f))} />
    </Svg>
  );
}

/** Copper stars burst outward when the session is complete. */
function Burst() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(a, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start(); }, []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: 1, height: 1, left: '50%', top: 70 }}>
      {Array.from({ length: 14 }, (_, i) => {
        const ang = (i / 14) * Math.PI * 2, dist = 90 + (i % 3) * 30;
        return (
          <Animated.View key={i} style={{ position: 'absolute', opacity: a.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * dist] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * dist] }) }, { scale: a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.2, 1.2, 0.6] }) }] }}>
            <Star size={10 + (i % 3) * 4} color={i % 2 ? K.copper : K.copperSoft} />
          </Animated.View>
        );
      })}
    </View>
  );
}

function Pop({ children }: { children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(a, { toValue: 1, useNativeDriver: native, speed: 8, bounciness: 16 }).start(); }, []);
  return <Animated.View style={{ opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }}>{children}</Animated.View>;
}

export default function Active() {
  useEffect(() => { // keep the screen on during a workout (iOS/Android; browsers may refuse wake locks)
    if (!native) return;
    activateKeepAwakeAsync('workout').catch(() => {});
    return () => { try { deactivateKeepAwake('workout'); } catch {} };
  }, []);
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = sessionById(id);
  const total = s.minutes * 60;
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const base = useRef({ t0: Date.now(), acc: 0 });
  useEffect(() => {
    if (!running || done) return;
    base.current.t0 = Date.now();
    const iv = setInterval(() => {
      const e = base.current.acc + (Date.now() - base.current.t0) / 1000;
      setElapsed(Math.min(total, e));
      if (e >= total) setDone(true);
    }, 250);
    return () => { clearInterval(iv); base.current.acc += (Date.now() - base.current.t0) / 1000; };
  }, [running, done]);

  const bounds = s.phases.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p.min * 60], []);
  const pi = Math.min(s.phases.length - 1, bounds.findIndex(b => elapsed < b) === -1 ? s.phases.length - 1 : bounds.findIndex(b => elapsed < b));
  const phase = s.phases[pi];
  const pStart = pi ? bounds[pi - 1] : 0;
  const left = bounds[pi] - elapsed;
  const phaseF = (elapsed - pStart) / (phase.min * 60);
  const prevPi = useRef(pi);
  useEffect(() => { if (pi !== prevPi.current) { prevPi.current = pi; haptic.firm(); } }, [pi]);
  useEffect(() => { if (done) { haptic.success(); completeSession(s.id); } }, [done]);

  const skip = () => { const target = bounds[pi]; base.current.acc = target; base.current.t0 = Date.now(); setElapsed(target); if (target >= total) setDone(true); };
  const Icon = deviceIcon(s);
  const verb = s.category === 'aerobic' ? (s.device === 'CEVIS' ? 'Now riding' : 'Now running') : s.category === 'resistance' ? 'Now lifting' : 'Now moving';

  if (done) {
    return (
      <Page title="Complete" maxWidth={560} header={<TopBar title={s.title} back={false} right={<Tag label="Complete" tone="ok" />} />}
        footer={<Button title="Back to training" onPress={() => router.dismissTo('/hazards?tab=training')} />}>
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <Burst />
          <Pop><View style={[{ width: 120, height: 120, borderRadius: 60, backgroundColor: K.copper, alignItems: 'center', justifyContent: 'center' }, ELEV.copper]}><Check size={54} color="#fff" strokeWidth={2.4} /></View></Pop>
          <Kicker style={{ marginTop: 24 }}>Session complete</Kicker>
          <Txt v="display" center style={{ marginTop: 6 }}>Strong work.</Txt>
          <Txt v="sub" color={K.ink2} center style={{ marginTop: 6, maxWidth: 300 }}>{s.title} is logged to your week. {s.category === 'aerobic' ? 'Your heart and legs thank you.' : s.category === 'resistance' ? 'Your bones and muscles thank you.' : 'Your spine and joints thank you.'}</Txt>
        </View>
        <View style={{ marginTop: 26 }}><StatPair items={[[fmtClock(elapsed), 'Active time'], [`${s.phases.length}/${s.phases.length}`, 'Phases'], ['118 bpm', 'Avg HR · sample']]} /></View>
        <Card sunk style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}><Sparkles size={16} color={K.copper} /><Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Celeste will compare tonight’s recovery with this session. Log how it felt in a crew check-in.</Txt></View>
        </Card>
      </Page>
    );
  }

  return (
    <Page title={s.title} maxWidth={620} header={<TopBar title={s.title} onBack={() => goBack()} right={<Tag label={running ? 'In progress' : 'Paused'} tone={running ? 'ok' : 'watch'} />} />}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button kind="secondary" title="End" icon={Square} style={{ flex: 0.7 }} onPress={() => goBack()} />
          <Button title={running ? 'Pause workout' : 'Resume workout'} icon={running ? Pause : Play} style={{ flex: 1.3 }} onPress={() => { haptic.firm(); setRunning(r => !r); }} />
        </View>
      }>
      <View style={{ marginTop: 8 }}><StatPair items={[[fmtClock(elapsed), 'Elapsed'], [`${pi + 1} / ${s.phases.length}`, 'Current phase']]} /></View>
      <View style={{ marginTop: 12 }}><Progress value={elapsed / total} height={5} /></View>

      <Card style={{ marginTop: 14 }} pad={0}>
        {s.phases.slice(0, pi).map((p, i) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: K.okTint, alignItems: 'center', justifyContent: 'center' }}><Check size={15} color={K.ok} strokeWidth={2.6} /></View>
            <View style={{ flex: 1 }}><Txt v="subM">{p.title}</Txt><Txt v="caption" color={K.ink2}>Completed</Txt></View>
            <Txt v="mono" color={K.ink3}>DONE</Txt>
          </View>
        ))}
        {pi === 0 ? <View style={{ padding: 12 }}><Txt v="caption" color={K.ink3}>Completed phases appear here.</Txt></View> : null}
      </Card>

      <Swap k={phase.id}>
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Ring f={phaseF} />
              <View style={{ position: 'absolute', alignItems: 'center' }}><Icon size={22} color={K.copper} /><Txt v="mono" color={K.ink2} style={{ marginTop: 4 }}>{Math.round(phaseF * 100)}%</Txt></View>
            </View>
            <View style={{ flex: 1 }}>
              <Kicker>{verb}</Kicker>
              <Txt v="title" style={{ marginTop: 4 }}>{phase.title}</Txt>
              <Txt v="caption" color={K.ink2} style={{ marginTop: 2 }}>{phase.target ?? phase.sub}</Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, backgroundColor: K.copperTint, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Txt v="subM">Time left</Txt>
            <Txt v="title" tabular>{fmtClock(left)}</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>{phase.target ? `${phase.sub}.` : `Block ${pi + 1} of ${s.phases.length}`}</Txt>
            <Pressy label="Skip to next block" onPress={skip}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 }}><Txt v="caption" color={K.copperInk} style={{ fontFamily: 'Geist_500Medium' }}>Skip block</Txt><SkipForward size={13} color={K.copperInk} /></View></Pressy>
          </View>
        </Card>
      </Swap>

      {s.phases[pi + 1] ? (
        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBubble icon={Play} size={34} />
            <View style={{ flex: 1 }}><Txt v="subM">{s.phases[pi + 1].title}</Txt><Txt v="caption" color={K.ink2}>Up next</Txt></View>
            <Txt v="mono" color={K.ink3}>{s.phases[pi + 1].min} MIN</Txt>
          </View>
        </Card>
      ) : null}
    </Page>
  );
}
