/**
 * Home, laid out from the user's iPad sketch (2026-11-14):
 *   header (logo · Day N) → date stepper → mission trajectory (ship on its route to the destination)
 *   → Health statistic (sleep, heart rate, radiation, recovery) → Walk ring + Activity dots
 *   → (scroll) Need attention → today's session and check-in.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { TrendingDown, TrendingUp, ArrowRight, ChevronRight, Flame, Footprints, HeartPulse, Moon, NotebookPen, Play, Radiation, Activity, ShieldCheck, Sparkles, ClipboardCheck } from 'lucide-react-native';
import { useAuth } from '@/auth';
import { AstraLogo, Floaty, SPACE } from '@/astra';
import Planet from '@/Planet';
import { ELEV, K, RAD, native, toneColor, toneTint } from '@/kit/tokens';
import { Appear, Count, Kicker, Pressy, Swap, Txt, useInView, useLayout, useLoop, useTween, useFocusTick } from '@/kit/core';
import { Spark } from '@/kit/charts';
import { Card, Dot, IconBubble, SectionHead, Skeleton, Stepper, Tag } from '@/kit/ui';
import { Cols, Page } from '@/kit/page';
import { TRAINING_HREF } from '@/kit/missionTraining';
import { ACTIVITY_28, fmtSleep, useCrew } from '@/data/crew';
import { TODAY_SESSION, doneToday, sessionById } from '@/data/training';
import { useStore } from '@/data/store';
import { DEST_NAME, fmtH, useMission, type Reading } from '@/data/mission';
import { AttentionCard, DemoBadge, HazardRings, ReadingSheet, ShelterBanner, SourceChip, WhoopStatus } from '@/kit/mission';
import { destinationFor, GOAL_DEST_NAME, type GoalDest } from '@/onboarding';
import { CamLiveBanner } from '@/kit/hmsc';
import { CrewPresence, ConfidenceRow } from '@/kit/tools';
import { useSources } from '@/data/freshness';
import { sensorConfidence } from '@/data/confidence';
import { useLive } from '@/live/Live';

type Pt = [number, number];

/** Dashed route ahead of the ship; the dashes flow toward the destination. (Plain state tick: animated SVG
 *  components leak `collapsable` to the DOM on web.) */
function FlowPath({ d, w, h }: { d: string; w: number; h: number }) {
  const [off, setOff] = useState(0);
  useEffect(() => {
    let raf = 0, last = 0;
    const step = (t: number) => { if (t - last > 33) { last = t; setOff(13 - ((t / 1400) % 1) * 13); } raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <Svg width={w} height={h} style={{ position: 'absolute' }} pointerEvents="none">
      <Path d={d} stroke={K.copper} strokeOpacity={0.55} strokeWidth={1.8} strokeLinecap="round" strokeDasharray="5 8" strokeDashoffset={off} fill="none" />
    </Svg>
  );
}

// ----------------------------------------------------------------------------- mission trajectory
const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 140): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
});
const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** Ship on its route: solid trail behind (already travelled), dashed line ahead flowing toward the destination. */
function MissionTrack({ w, h, progress, dest, day, left }: { w: number; h: number; progress: number; dest: GoalDest; day: number; left: number }) {
  const { pts, cum, total } = useMemo(() => {
    const pts = bez([w * 0.07, h * 0.16], [w * 0.14, h * 1.08], [w * 0.6, h * 1.04], [w * 0.83, h * 0.3]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, total: cum[cum.length - 1] };
  }, [w, h]);
  const u = useTween(Math.max(0.03, Math.min(0.97, progress)), 1900);
  // point at arc-length fraction u
  const target = u * total;
  let i = 1; while (i < cum.length - 1 && cum[i] < target) i++;
  const f = (target - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
  const at: Pt = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) * 180 / Math.PI;
  const flown = [...pts.slice(0, i), at], ahead = [at, ...pts.slice(i)];

  const pulse = useLoop(2400);
  const shipW = Math.min(70, w * 0.18), shipH = shipW / SPACE.shipRatio;
  const end = pts[pts.length - 1], start = pts[0];
  const pr = 22;
  const name = GOAL_DEST_NAME[dest];

  return (
    <Pressy label={`Mission route to ${name}, day ${day}`} onPress={() => router.push('/profile/briefing')} to={0.985}>
      <View style={{ height: h, marginTop: 10 }}>
        <FlowPath d={toD(ahead)} w={w} h={h} />
        <Svg width={w} height={h} style={{ position: 'absolute' }}>
          <Path d={toD(flown)} stroke={K.copperSoft} strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.35} />
          <Path d={toD(flown)} stroke={K.copper} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        </Svg>
        <View pointerEvents="none" style={{ position: 'absolute', left: start[0] - 13, top: start[1] - 13 }}>
          <Floaty amp={1.5} dur={3600} rotate={0}><Image source={SPACE.earth} style={{ width: 26, height: 26 }} /></Floaty>
        </View>
        <View style={{ position: 'absolute', left: start[0] + 17, top: start[1] - 8 }}>
          <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>Earth</Txt>
        </View>

        {/* destination */}
        <View style={{ position: 'absolute', left: end[0] - pr * 1.6, top: end[1] - pr * 1.6, width: pr * 3.2, height: pr * 3.2, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ position: 'absolute', width: pr * 2.2, height: pr * 2.2, borderRadius: pr * 2, borderWidth: 1, borderColor: K.copper,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.45] }) }] }} />
          <Floaty amp={2} dur={3000} rotate={4}>
            {dest === 'mars' || dest === 'jupiter' || dest === 'iss'
              ? <Image source={dest === 'iss' ? SPACE.earth : SPACE[dest]} style={{ width: pr * 2.2, height: pr * 2.2 }} accessibilityIgnoresInvertColors />
              : <Planet k={dest} size={pr * 2.4} />}
          </Floaty>
        </View>
        <View style={{ position: 'absolute', right: Math.max(0, w - end[0] - 60), width: 120, top: end[1] + pr * 1.25, alignItems: 'center' }}>
          <Txt v="subM">{name}</Txt>
          <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>{left > 0 ? `Destination · ${left} d` : 'Destination'}</Txt>
        </View>

        {/* ship */}
        <View pointerEvents="none" style={{ position: 'absolute', left: at[0] - shipW / 2, top: at[1] - shipH / 2, width: shipW }}>
          <Floaty amp={2.5} dur={2600} rotate={2}>
            <Image source={SPACE.ship} style={{ width: shipW, height: shipH, transform: [{ rotate: `${ang - SPACE.shipNose}deg` }] }} resizeMode="contain" />
          </Floaty>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: at[0] - 50, width: 100, top: at[1] + shipH / 2 + 6, alignItems: 'center' }}>
          <View style={[{ paddingHorizontal: 9, height: 22, borderRadius: 11, backgroundColor: K.cardSolid, borderWidth: 1, borderColor: K.hair2, justifyContent: 'center' }, ELEV.card]}>
            <Txt v="mono" color={K.copperInk} style={{ fontSize: 10 }}>{`DAY ${day} · ${Math.round(progress * 100)}%`}</Txt>
          </View>
        </View>
      </View>
    </Pressy>
  );
}

// ----------------------------------------------------------------------------- health statistic
const FMT: Record<string, (v: number) => string> = { dose: v => v.toFixed(2), sleep: fmtH, rhr: v => `${Math.round(v)}`, recovery: v => `${Math.round(v)}%`, hrv: v => `${Math.round(v)}` };
/** Lower is healthier for these; everything else is better when it rises. */
const LOWER_BETTER = new Set(['rhr', 'dose']);
/** Worse-than-yesterday is shown in a calm amber, not alarm red — red stays reserved for real flags. */
const WORSE = '#A8691C';
const DELTA: Record<string, (d: number) => string> = { sleep: d => `${Math.round(d * 60)}m`, rhr: d => `${Math.round(d)}`, recovery: d => `${Math.round(d)}%`, dose: d => d.toFixed(2), hrv: d => `${Math.round(d)}` };

/**
 * One value with its week trend and source chip. The number counts up when the tile scrolls into view,
 * the sparkline draws itself, and the pill says how it moved since the day before (green = healthier).
 * `back` = days before today (date stepper).
 */
function Stat({ icon, r, unit, label, back, override, onPress }: { icon: any; r: Reading; unit?: string; label: string; back: number; override?: number; onPress: () => void }) {
  const end = r.series.length - back;
  const v = r.series[end - 1];
  const prev = r.series[end - 2];
  const value = override ?? v ?? null;
  const fmt = override != null ? (x: number) => x.toFixed(1) : FMT[r.key] ?? ((x: number) => String(Math.round(x)));
  const [sw, setSw] = useState(0);
  const d = v != null && prev != null ? v - prev : null;
  const moved = d != null && Math.abs(d) > 1e-6;
  const better = moved && (LOWER_BETTER.has(r.key) ? d! < 0 : d! > 0);
  const tone = !moved ? K.ink3 : better ? K.ok : WORSE;
  const week = r.series.slice(Math.max(0, end - 7), end);
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
    <Pressy label={`${label} ${value == null ? 'no data' : fmt(value)}${unit ? ' ' + unit : ''}`} onPress={onPress} to={0.96}>
      <View style={{ backgroundColor: K.cardSolid, borderRadius: 18, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 9, borderWidth: 1, borderColor: K.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBubble icon={icon} size={30} />
          <Txt v="caption" color={K.ink2} numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
          {override != null && v != null ? (
            // mission total: what today added, like a running dosimeter
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: K.copperTint }}>
              <Txt v="mono" color={K.copperInk} style={{ fontSize: 9.5 }}>+{v.toFixed(2)}</Txt>
            </View>
          ) : moved ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: better ? K.okTint : K.watchTint }}>
              {d! > 0 ? <TrendingUp size={11} color={tone} strokeWidth={2.4} /> : <TrendingDown size={11} color={tone} strokeWidth={2.4} />}
              <Txt v="mono" color={tone} style={{ fontSize: 9.5 }}>{(DELTA[r.key] ?? String)(Math.abs(d!))}</Txt>
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Count value={value} format={fmt} v="title" style={{ fontSize: 22 }} numberOfLines={1} adjust>
            {unit && value != null ? <Txt v="caption" color={K.ink2}> {unit}</Txt> : null}
          </Count>
          {override != null ? <Dot tone="ok" size={6} pulse /> : null}
        </View>
        <View onLayout={e => setSw(Math.round(e.nativeEvent.layout.width))} style={{ height: 24, marginTop: 4 }}>
          {sw ? <Spark values={week} w={sw} h={24} color={K.copper} /> : null}
        </View>
        <View style={{ marginTop: 5 }}><SourceChip r={back ? { ...r, at: r.at ? r.at - back * 864e5 : null } : r} compact /></View>
      </View>
    </Pressy>
    </View>
  );
}

/** "Since yesterday": each change is a coloured chip whose number counts up; healthier = green, worse = red. */
function ChangeChip({ c, i }: { c: { key: string; label: string; up: boolean; amount: number; unit: string; dec: number; worse: boolean }; i: number }) {
  const bob = useLoop(2200);
  const col = c.worse ? WORSE : K.ok;
  const Arrow = c.up ? TrendingUp : TrendingDown;
  return (
    <Appear i={i} from={10}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 10, height: 30, borderRadius: 15, backgroundColor: c.worse ? K.watchTint : K.okTint }}>
        <Animated.View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center',
          transform: [{ translateY: bob.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, c.up ? -1.5 : 1.5, 0] }) }] }}>
          <Arrow size={12} color={col} strokeWidth={2.4} />
        </Animated.View>
        <Txt v="caption" color={K.ink}>{c.label}</Txt>
        <Count value={c.amount} delay={200 + i * 120} duration={1000} v="subM" color={col} format={x => `${c.up ? '+' : '−'}${x.toFixed(c.dec)}${c.unit ? ' ' + c.unit : ''}`} />
      </View>
    </Appear>
  );
}

// ----------------------------------------------------------------------------- walk & activity
function WalkCard({ steps, goal = 10000 }: { steps: number | null; goal?: number }) {
  const [ref, seen] = useInView();
  const v = useTween(steps ?? 0, 1600, true, seen);
  const size = 112, sw = 10, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const p = Math.min(1, v / goal);
  return (
    <Card onPress={() => router.navigate(TRAINING_HREF)} label={`Walk ${steps ?? 0} steps`} pad={14} style={{ minHeight: 236 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBubble icon={Footprints} size={28} />
        <Txt v="subM">Walk</Txt>
      </View>
      <View ref={ref} collapsable={false} style={{ alignItems: 'center', justifyContent: 'center', marginTop: 12, height: size }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={K.copperTint} strokeWidth={sw} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r - sw * 0.9} stroke={K.hair} strokeWidth={1} strokeDasharray="2 4" fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={K.copper} strokeWidth={sw} strokeLinecap="round" fill="none" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} />
        </Svg>
        <Txt v="title" tabular style={{ fontSize: 21 }}>{Math.round(v).toLocaleString('en-US')}</Txt>
        <Txt v="caption" color={K.ink2}>steps</Txt>
      </View>
      <Txt v="mono" color={K.ink3} upper center style={{ fontSize: 9.5, marginTop: 10 }}>{`${Math.round(Math.min(1, v / goal) * 100)}% of ${goal.toLocaleString('en-US')}`}</Txt>
    </Card>
  );
}

function ActivityDot({ k, value, max, today }: { k: number; value: number; max: number; today: boolean }) {
  const tick = useFocusTick();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    a.setValue(0);
    Animated.spring(a, { toValue: 1, delay: 300 + k * 22, useNativeDriver: native, speed: 14, bounciness: 12 }).start();
  }, [tick]);
  const lvl = Math.max(0.12, Math.min(1, (value - 900) / (max - 900)));
  return (
    <Animated.View style={{ width: 12, height: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center', opacity: a, transform: [{ scale: a }],
      borderWidth: today ? 1.5 : 0, borderColor: K.copperDeep }}>
      <View style={{ width: today ? 7 : 10, height: today ? 7 : 10, borderRadius: 5, backgroundColor: K.copper, opacity: lvl }} />
    </Animated.View>
  );
}

function ActivityCard({ kcal, days }: { kcal: number | null; days: (number | null)[] }) {
  const max = Math.max(1, ...days.map(x => x ?? 0));
  const rows = [0, 1, 2, 3].map(r => days.slice(r * 7, r * 7 + 7));
  return (
    <Card onPress={() => router.navigate(TRAINING_HREF)} label={`Activity ${kcal ?? 0} kilocalories`} pad={14} style={{ minHeight: 236 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBubble icon={Flame} size={28} />
        <Txt v="subM">Activity</Txt>
      </View>
      <View style={{ marginTop: 12 }}>
        <Count value={kcal} v="title" style={{ fontSize: 21 }} format={x => Math.round(x).toLocaleString('en-US')}><Txt v="caption" color={K.ink2}> kcal</Txt></Count>
        <Txt v="caption" color={K.ink2}>Active energy today</Txt>
      </View>
      <View style={{ marginTop: 12, gap: 7 }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {row.map((d, c) => <ActivityDot key={c} k={r * 7 + c} value={d ?? 0} max={max} today={r === 3 && c === 6} />)}
          </View>
        ))}
      </View>
      <Txt v="mono" color={K.ink3} upper center style={{ fontSize: 9.5, marginTop: 10 }}>Last 4 weeks</Txt>
    </Card>
  );
}

// ----------------------------------------------------------------------------- screen
export default function Home() {
  const { user } = useAuth();
  const crew = useCrew();
  const m = useMission();
  const judge = useStore(s => s.settings.judge);
  const { wide, w, gutter, sidebar } = useLayout();
  const [idx, setIdx] = useState(6);
  const [sheet, setSheet] = useState<Reading | null>(null);
  const dir = React.useRef(0);
  useStore(s => s.completed); // refresh when a workout is completed
  const d = crew.days[idx];
  const today = idx === 6, back = 6 - idx;
  const session = sessionById(TODAY_SESSION);
  const sessionDone = doneToday(session.id);
  const go = (n: number) => { dir.current = n; setIdx(i => Math.max(0, Math.min(6, i + n))); };
  const R = m.readings;
  const live = useLive();
  const sources = useSources(crew);
  const confidence = useMemo(() => sensorConfidence(crew, sources), [crew, sources]);

  // where the crew is heading: mission briefing first, else the sign-up goal, else mission length
  const goalDest = user?.missionGoal?.dest as GoalDest | null | undefined;
  const lenDest = user?.missionYears ? destinationFor(user.missionYears) : null;
  const dest: GoalDest = (m.dest as GoalDest) ?? goalDest ?? (lenDest === 'orbit' ? 'iss' : lenDest) ?? 'mars';
  const dayShown = crew.missionDay - back;
  const progress = Math.min(1, Math.max(0, dayShown / crew.duration));
  const left = Math.max(0, crew.duration - dayShown);

  const [colW, setColW] = useState(0); // measured: layout width can change
  const trackH = Math.round(Math.max(180, Math.min(wide ? 250 : 210, (colW || w - gutter * 2) * 0.55)));

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {sidebar ? <Txt v="headline">Home</Txt> : <AstraLogo size={16} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Tag label={`Day ${crew.missionDay} · ${DEST_NAME[dest]}`} onPress={() => router.push('/profile/briefing')} />
        <CrewPresence />
        <WhoopStatus />
        <Pressy label="Daily check" onPress={() => router.navigate('/check')} hitSlop={6}>
          <View style={{ height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: K.copper, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <ClipboardCheck size={14} color="#fff" strokeWidth={2} />
            <Txt v="caption" color="#fff" style={{ fontFamily: 'Geist_600SemiBold' }}>Check</Txt>
          </View>
        </Pressy>
      </View>
    </View>
  );

  const hazards = (
    <View>
      <CamLiveBanner />
      {m.radiation.spe ? <View style={{ marginTop: 12 }}><ShelterBanner shelterBy={m.radiation.spe.shelterBy} /></View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
        <Txt v="headline">Mission hazards</Txt>
        {m.demo ? <DemoBadge /> : <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>NASA RIDGE</Txt>}
      </View>
      <HazardRings hazards={m.hazards} onPress={h => router.navigate({ pathname: '/hazards', params: { focus: h.key } })} />
      <View style={{ marginTop: 10 }}>
        {m.attention ? <AttentionCard a={m.attention} onRemeasure={() => router.push({ pathname: '/remeasure', params: { metric: m.attention!.remeasure! } })} onCall={() => live.call('doctors', 'doctor', 'Flight surgeon')} extra={<ConfidenceRow c={confidence} full />} /> : (
          <Card pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconBubble icon={ShieldCheck} color={K.ok} bg={K.okTint} />
              <View style={{ flex: 1 }}><Txt v="subM">All clear</Txt><Txt v="caption" color={K.ink2}>No hazard needs your attention right now.</Txt></View>
            </View>
          </Card>
        )}
      </View>
      {m.changes.length ? (
        <Appear>
          <Card pad={12} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt v="subM">Since yesterday</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {m.changes.some(c => !c.worse) ? <Txt v="mono" color={K.ok} upper style={{ fontSize: 9.5 }}>{m.changes.filter(c => !c.worse).length} better</Txt> : null}
                {m.changes.some(c => c.worse) ? <Txt v="mono" color={WORSE} upper style={{ fontSize: 9.5 }}>{m.changes.filter(c => c.worse).length} worse</Txt> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
              {m.changes.map((c, i) => <ChangeChip key={c.key} c={c} i={i} />)}
            </View>
          </Card>
        </Appear>
      ) : null}
    </View>
  );

  const track = (
    <View onLayout={e => setColW(Math.round(e.nativeEvent.layout.width))} style={{ minHeight: trackH + 10 }}>
      {colW ? <MissionTrack w={colW} h={trackH} progress={progress} dest={dest} day={dayShown} left={left} /> : null}
    </View>
  );

  const stats = (
    <View>
      <Stepper label={d.label} onPrev={() => go(-1)} onNext={() => go(1)} prevDisabled={idx === 0} nextDisabled={today} style={{ marginTop: 4 }} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, marginBottom: 10 }}>
        <Txt v="headline">Health statistic</Txt>
        <Pressy label="All measurements" onPress={() => router.navigate('/check')}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}><Txt v="caption" color={K.copperInk} style={{ fontFamily: 'Geist_500Medium' }}>All measurements</Txt><ChevronRight size={13} color={K.copperInk} /></View>
        </Pressy>
      </View>
      {crew.loading ? (
        <Skeleton h={150} r={RAD.m} />
      ) : (
        <Card pad={8}>
          <Swap k={idx} dir={dir.current} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat icon={Moon} label="Sleep" r={R.sleep} back={back} onPress={() => setSheet(R.sleep)} />
              <Stat icon={HeartPulse} label="Heart rate" r={R.rhr} unit="BPM" back={back} onPress={() => setSheet(R.rhr)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Stat icon={Radiation} label="Radiation" r={R.dose} unit="mSv" back={back} override={today ? m.radiation.total : undefined} onPress={() => router.push('/radiation')} />
              <Stat icon={Activity} label="Recovery" r={R.recovery} back={back} onPress={() => setSheet(R.recovery)} />
            </View>
          </Swap>
        </Card>
      )}
    </View>
  );

  const move = judge ? null : (
    <Swap k={idx} dir={dir.current} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}><WalkCard steps={d.steps} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><ActivityCard kcal={d.kcal} days={ACTIVITY_28.slice(0, 22 + idx)} /></View>
    </Swap>
  );

  const focus = (
    <View>
      <SectionHead kicker="Mission routine" title="In focus" action="Training" onAction={() => router.navigate(TRAINING_HREF)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1.3, minWidth: 0 }}>
        <Pressy label={`Today's session ${session.title}`} onPress={() => router.push(`/training/${session.id}`)} to={0.975}>
          <View style={[{ borderRadius: RAD.m, overflow: 'hidden', height: 168 }, ELEV.card]}>
            <ImageBackground source={session.imgFocus ?? session.img} style={{ flex: 1 }} resizeMode="cover" imageStyle={{ width: '100%', height: '100%' }}>
              <LinearGradient colors={['rgba(28,18,13,0.05)', 'rgba(28,18,13,0.78)']} style={{ flex: 1, padding: 14, justifyContent: 'flex-end' }}>
                <Kicker color="#F3D9C6">{sessionDone ? 'Completed today' : 'Today’s session'}</Kicker>
                <Txt v="title" color="#fff" style={{ marginTop: 3, fontSize: 20 }}>{session.title}</Txt>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <Txt v="caption" color="rgba(255,255,255,0.8)">{session.device} · {session.minutes} min</Txt>
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Play size={13} color={K.copper} fill={K.copper} /></View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </View>
        </Pressy>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
        <Card onPress={() => router.navigate('/check')} label="Daily crew check" style={{ minHeight: 168, justifyContent: 'space-between' }}>
          <IconBubble icon={NotebookPen} />
          <View style={{ marginTop: 14 }}>
            <Txt v="headline">Daily check</Txt>
            <Txt v="caption" color={K.ink2} style={{ marginTop: 3 }}>{m.missing} values missing · about 90 s</Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 }}><Txt v="subM" color={K.copperInk}>Start check</Txt><ArrowRight size={14} color={K.copperInk} /></View>
        </Card>
        </View>
      </View>
    </View>
  );

  return (
    <Page tabs title="Home" header={header} onRefresh={crew.reload}>
      {wide ? (
        // laptop: hazards + numbers on the left, the mission route and today's routine on the right
        <Cols ratio={[1.15, 1]} gap={32}>
          <View>{hazards}<Appear>{stats}</Appear><Appear>{move}</Appear></View>
          <View style={{ marginTop: 16 }}>{track}<Appear>{focus}</Appear></View>
        </Cols>
      ) : (
        <View>{hazards}{track}<Appear>{stats}</Appear><Appear>{move}</Appear><Appear>{focus}</Appear></View>
      )}
      <ReadingSheet r={sheet} onClose={() => setSheet(null)} />
    </Page>
  );
}
