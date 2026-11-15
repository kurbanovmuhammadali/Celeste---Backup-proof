/**
 * Mission › Training — the countermeasure plan as the second Mission tab (was the separate /plan screen).
 * Order of attention: today's session (the one action) → this week (progress) → tools → why it matters.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, ChevronDown, Dumbbell, ScanLine, SlidersHorizontal, Target, Utensils } from 'lucide-react-native';
import { K, MOTION } from './tokens';
import { Appear, Count, Kicker, Rise, Txt, useInView, useLayout } from './core';
import { Button, Card, IconBubble } from './ui';
import { Pressy } from './core';
import { HeatGrid } from './charts';
import { Cols } from './page';
import { SessionHero } from './training';
import { doneToday, frequency, sessionById, week } from '../data/training';
import { dayKey, useStore } from '../data/store';
import { todaySessionId, useOverride } from '../data/override';
import { SurgeonPlan } from './SurgeonPlan';
import { bodyNumbers } from '../data/plan';

/** Where "Training" lives now: Mission tab, second segment. */
export const TRAINING_HREF = { pathname: '/hazards', params: { tab: 'training' } } as const;

const WEEK_GOAL = 6;

function DayBox({ d, i }: { d: ReturnType<typeof week>[number]; i: number }) {
  return (
    <Rise i={i} from={10} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', paddingVertical: 8, borderRadius: 14, backgroundColor: d.today ? K.copper : d.count ? K.copperTint : 'rgba(246,231,222,0.5)' }}>
        <Txt v="caption" color={d.today ? 'rgba(255,255,255,0.8)' : K.ink2} style={{ fontSize: 10.5 }}>{d.label}</Txt>
        <Txt v="headline" tabular color={d.today ? '#fff' : d.count ? K.ink : K.ink3} style={{ marginTop: 2 }}>{d.count}</Txt>
      </View>
    </Rise>
  );
}

/** Progress bar that fills when it scrolls into view. */
function GoalBar({ value, goal }: { value: number; goal: number }) {
  const [ref, seen] = useInView();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (seen) Animated.timing(a, { toValue: Math.min(1, value / goal), duration: 1200, delay: 150, easing: MOTION.out, useNativeDriver: false }).start(); }, [seen, value]);
  return (
    <View ref={ref} collapsable={false} style={{ height: 8, borderRadius: 4, backgroundColor: K.copperTint, overflow: 'hidden', marginTop: 12 }}>
      <Animated.View style={{ height: 8, borderRadius: 4, backgroundColor: K.copper, width: a.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

function Tool({ icon, title, sub, to }: { icon: any; title: string; sub: string; to: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Card onPress={() => router.push(to as any)} label={title} pad={12} style={{ minHeight: 112 }}>
        <IconBubble icon={icon} size={32} />
        <Txt v="subM" style={{ marginTop: 10 }}>{title}</Txt>
        <Txt v="caption" color={K.ink2} numberOfLines={2}>{sub}</Txt>
      </Card>
    </View>
  );
}

/** Fuel & zones: heart-rate zones, calories, protein and water from your body numbers, plus today's intake. Collapsed by default. */
function FuelCard() {
  const p = useStore(s => s.profile);
  const meals = useStore(s => s.meals);
  const [open, setOpen] = useState(false);
  const n = bodyNumbers({ age: Number(p.age) || 32, sex: p.gender, heightCm: Number(p.height) || 175, weightKg: Number(p.weight) || 72 });
  const today = meals.filter(m => m.day === dayKey(0));
  const kc = today.reduce((a, m) => a + m.kcal, 0), wa = today.reduce((a, m) => a + m.waterMl, 0) / 1000;
  return (
    <Card pad={14}>
      <Pressy label="Fuel and zones" onPress={() => setOpen(o => !o)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBubble icon={Utensils} size={34} />
          <View style={{ flex: 1 }}><Txt v="subM">Fuel & zones</Txt><Txt v="caption" color={K.ink2}>{kc} of {n.kcal} kcal today · {wa.toFixed(1)} of {n.waterL} L water</Txt></View>
          <ChevronDown size={17} color={K.ink3} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </View>
      </Pressy>
      {open ? (
        <View style={{ marginTop: 12, gap: 6 }}>
          <Txt v="sub" color={K.ink2}>Max heart rate {n.hrMax} bpm · Zone 2 {n.zone2[0]}–{n.zone2[1]} bpm</Txt>
          <Txt v="sub" color={K.ink2}>Energy about {n.kcal} kcal · protein {n.protein[0]}–{n.protein[1]} g · water {n.waterL} L</Txt>
          <Txt v="caption" color={K.ink3}>Starting estimates from standard formulas. Your dietitian and flight surgeon set the real numbers.</Txt>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <View style={{ flex: 1 }}><Button small kind="secondary" title="Food and water log" onPress={() => router.push('/nutrition')} /></View>
            <View style={{ flex: 1 }}><Button small kind="secondary" title="My mission plan" onPress={() => router.push('/mission-plan')} /></View>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export function TrainingPanel() {
  useStore(s => s.completed);
  const override = useOverride();
  const { wide } = useLayout();
  const days = week();
  const total = days.reduce((a, d) => a + d.count, 0);
  const s = sessionById(todaySessionId(override));
  const done = doneToday(s.id);

  const today = (
    <View>
      {override ? <View style={{ marginBottom: 10 }}><SurgeonPlan o={override} /></View> : null}
      <SessionHero s={s} kicker={done ? 'Completed today' : 'Today’s session'} done={done} onPress={() => router.push(`/training/${s.id}`)} height={wide ? 280 : 200} />
      <Appear i={1}>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Tool icon={Dumbbell} title="Workout sets" sub="ARED · CEVIS · T2 sessions" to="/training/sets" />
          <Tool icon={ScanLine} title="Form check" sub="Camera counts your reps" to="/formcheck" />
          <Tool icon={SlidersHorizontal} title="Plan inputs" sub="Profile, flight length, devices" to="/profile/briefing" />
        </View>
      </Appear>
    </View>
  );

  const progress = (
    <View style={{ marginTop: wide ? 0 : 12, gap: 10 }}>
      <Appear>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Kicker color={K.ink2}>This week</Kicker>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
                <Count value={total} v="display" duration={1100} />
                <Txt v="sub" color={K.ink2}>of {WEEK_GOAL} sessions</Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, height: 24, borderRadius: 12, backgroundColor: total >= WEEK_GOAL ? K.okTint : K.copperTint }}>
              <Target size={12} color={total >= WEEK_GOAL ? K.ok : K.copperInk} />
              <Txt v="caption" color={total >= WEEK_GOAL ? K.ok : K.copperInk}>{total >= WEEK_GOAL ? 'Goal reached' : `${WEEK_GOAL - total} to go`}</Txt>
            </View>
          </View>
          <GoalBar value={total} goal={WEEK_GOAL} />
          <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>{days.map((d, i) => <DayBox key={d.key} d={d} i={i} />)}</View>
        </Card>
      </Appear>
      <Appear>
        <Card pad={12}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <Txt v="subM">Workout frequency</Txt>
            <Txt v="caption" color={K.ink3}>7 weeks</Txt>
          </View>
          <HeatGrid weeks={frequency()} compact />
        </Card>
      </Appear>
      <Appear><FuelCard /></Appear>
      <Appear>
        <Card sunk onPress={() => router.push('/training/sets')} label="Browse workout sets">
          <Kicker color={K.ink2}>Why it matters</Kicker>
          <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>In microgravity, bones can lose 1–1.5% of mass per month without loading. Daily aerobic and resistance work is the main countermeasure.</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}><Txt v="subM" color={K.copperInk}>Browse workout sets</Txt><ArrowRight size={14} color={K.copperInk} /></View>
        </Card>
      </Appear>
    </View>
  );

  return <Cols ratio={[1.1, 1]} gap={28} style={{ marginTop: 14 }}>{today}{progress}</Cols>;
}
