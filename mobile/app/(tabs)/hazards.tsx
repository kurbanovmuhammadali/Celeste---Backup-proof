/**
 * Mission tab — two segments: Hazards (NASA's five spaceflight hazards, RIDGE) and Training (countermeasures).
 * The segment switch sits in the fixed header so it never scrolls away; ?tab=training opens the second one.
 * Each hazard expands into the exact signals that feed it (with source + freshness). The risk timeline
 * replays the mission day by day: drag across it to see when each hazard started changing.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Line, Rect } from 'react-native-svg';
import { ChevronDown, Radiation, Footprints, Dumbbell, FileText, ChevronRight, Orbit } from 'lucide-react-native';
import { K, MOTION, native, toneColor } from '@/kit/tokens';
import { Appear, Count, Kicker, Pressy, Swap, Txt, haptic, useLayout } from '@/kit/core';
import { Card, IconBubble, PageHead, Segmented, Tag } from '@/kit/ui';
import { TrainingPanel } from '@/kit/missionTraining';
import { Cols, Page } from '@/kit/page';
import { DemoBadge, ReadingRow, ReadingSheet, WhoopStatus } from '@/kit/mission';
import { DEST_NAME, useMission, type Hazard, type Reading } from '@/data/mission';
import { useTeam } from '@/data/team';
import { Button } from '@/kit/ui';

const LANES: Hazard['key'][] = ['R', 'I', 'D', 'G', 'E'];
const LANE_C = ['#E4F0E6', '#D69A3F', '#C9553B'];

function HazardCard({ h, open, onToggle, readings, onReading, i }: { h: Hazard; open: boolean; onToggle: () => void; readings: Record<string, Reading>; onReading: (r: Reading) => void; i: number }) {
  const a = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.spring(a, { toValue: open ? 1 : 0, useNativeDriver: false, speed: 14, bounciness: open ? 4 : 0 }).start(); }, [open]);
  const rows = h.signals.map(k => readings[k]).filter(Boolean);
  const { crew } = useTeam();
  const extra = h.key === 'I' ? 96 : 0;
  return (
    <Card pad={0} style={{ overflow: 'hidden', borderColor: h.tone === 'flag' ? 'rgba(201,85,59,0.28)' : K.hair }}>
      <Pressy label={`${h.long}. ${h.line}`} onPress={() => { haptic.tap(); onToggle(); }} to={0.985}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: toneColor(h.tone), alignItems: 'center', justifyContent: 'center' }}>
            <Txt v="headline" style={{ fontSize: 14 }}>{h.key}</Txt>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt v="subM">{h.long}</Txt>
            <Txt v="caption" color={K.ink2} numberOfLines={open ? 3 : 1}>{h.line}</Txt>
          </View>
          <Animated.View style={{ transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><ChevronDown size={17} color={K.ink3} /></Animated.View>
        </View>
      </Pressy>
      <Animated.View style={{ height: a.interpolate({ inputRange: [0, 1], outputRange: [0, rows.length * 58 + 10 + extra] }), opacity: a, paddingHorizontal: 14 }}>
        {rows.map((r, j) => <ReadingRow key={r.key} r={r} first={j === 0} onPress={() => onReading(r)} />)}
        {h.key === 'I' ? (
          <View style={{ paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair, gap: 6 }}>
            <Txt v="caption" color={K.ink2}>{crew ? (crew.pulse.enough ? `Crew pulse today: mood ${crew.pulse.mood}/5 · stress ${crew.pulse.stress}/5 (${crew.pulse.todayCount} people, anonymous)` : `Crew pulse shows from 3 answers (${crew.pulse.todayCount} today)`) : 'Join a crew to see the anonymous crew pulse.'}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Button small kind="secondary" title={crew ? 'Crew pulse and concerns' : 'Join a crew'} onPress={() => router.push('/crew')} /></View>
              <View style={{ flex: 1 }}><Button small kind="secondary" title="Private check" onPress={() => router.navigate('/check')} /></View>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </Card>
  );
}

function RiskTimeline({ tl, n, day }: { tl: Record<string, number[]>; n: number; day: number }) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState(n - 1);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(reveal, { toValue: 1, duration: 1100, delay: 200, easing: MOTION.out, useNativeDriver: false }).start(); }, []);
  const last = useRef(sel);
  const pick = (x: number) => { const i = Math.max(0, Math.min(n - 1, Math.round((x / Math.max(1, w)) * (n - 1)))); if (i !== last.current) { last.current = i; haptic.tap(); setSel(i); } };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: e => pick(e.nativeEvent.locationX), onPanResponderMove: e => pick(e.nativeEvent.locationX),
  })).current;
  const laneH = 9, gap = 7, H = LANES.length * (laneH + gap);
  const cw = w / n;
  // what changed most recently on or before the selected day
  let note = 'All hazards steady so far';
  for (let i = sel; i > 0 && note.startsWith('All'); i--) for (const k of LANES) if (tl[k][i] > tl[k][i - 1] && tl[k][i] > 0) { note = `Day ${day - (n - 1 - i)} · ${({ R: 'radiation', I: 'isolation', D: 'distance', G: 'gravity', E: 'environment' } as any)[k]} turned ${tl[k][i] === 2 ? 'red' : 'amber'}`; break; }
  const selDay = day - (n - 1 - sel);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Txt v="subM">Risk timeline</Txt>
        <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9.5 }}>Day {day - n + 1} → {day}</Txt>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
        <View style={{ gap, paddingTop: 0 }}>{LANES.map(k => <Txt key={k} v="mono" color={K.ink3} style={{ height: laneH, lineHeight: laneH + 1, fontSize: 9 }}>{k}</Txt>)}</View>
        <View style={{ flex: 1, height: H }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`Risk timeline, day ${selDay}`}>
          {w ? (
            <Animated.View style={{ width: reveal.interpolate({ inputRange: [0, 1], outputRange: [0, w] }), height: H, overflow: 'hidden' }}>
              <Svg width={w} height={H}>
                {LANES.map((k, li) => tl[k].map((v, i) => <Rect key={`${k}${i}`} x={i * cw + 0.5} y={li * (laneH + gap)} width={Math.max(1, cw - 1)} height={laneH} rx={2} fill={v < 0 ? '#EFE4DC' : LANE_C[v]} />))}
              </Svg>
            </Animated.View>
          ) : null}
          {w ? <Svg width={w} height={H + 6} style={{ position: 'absolute', top: -3 }} pointerEvents="none"><Line x1={(sel + 0.5) * cw} y1={0} x2={(sel + 0.5) * cw} y2={H + 6} stroke={K.copper} strokeWidth={2} /></Svg> : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <View style={{ paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: K.copper, justifyContent: 'center' }}><Txt v="mono" color="#fff" style={{ fontSize: 9.5 }}>DAY {selDay}</Txt></View>
        <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>{note}</Txt>
      </View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>Drag across to replay the mission.</Txt>
    </Card>
  );
}

function Tool({ icon, title, sub, to, tone, children }: { icon: any; title: string; sub: string; to: string; tone?: string; children?: React.ReactNode }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}><Card onPress={() => router.push(to as any)} label={title} pad={12} style={{ height: 148 }}>
      <IconBubble icon={icon} size={32} color={tone ?? K.copper} bg={tone ? 'rgba(201,85,59,0.12)' : K.copperTint} />
      <Txt v="subM" style={{ marginTop: 10 }}>{title}</Txt>
      {children}
      <Txt v="caption" color={K.ink2} numberOfLines={2}>{sub}</Txt>
    </Card></View>
  );
}

type Seg = 'hazards' | 'training';

export default function Mission() {
  const m = useMission();
  const { focus, tab: tabParam } = useLocalSearchParams<{ focus?: string; tab?: string }>();
  const { wide } = useLayout();
  const [tab, setTab] = useState<Seg>(tabParam === 'training' ? 'training' : 'hazards');
  useEffect(() => { if (tabParam === 'training' || tabParam === 'hazards') setTab(tabParam); }, [tabParam]);
  useEffect(() => { if (focus) setTab('hazards'); }, [focus]);
  const [open, setOpen] = useState<string | null>(focus ?? m.hazards.find(h => h.tone === 'flag')?.key ?? null);
  useEffect(() => { if (focus) setOpen(focus); }, [focus]);
  const [sheet, setSheet] = useState<Reading | null>(null);
  const next = m.gates.every(g => g.ok);
  const switchTo = (k: Seg) => { setTab(k); router.setParams({ tab: k, focus: undefined } as any); };

  const header = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="headline">Mission</Txt>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Tag label={`${DEST_NAME[m.dest]} · ${m.delay >= 1 ? `${m.delay} min delay` : 'live link'}`} onPress={() => router.push('/profile/briefing')} />
          <WhoopStatus />
        </View>
      </View>
      <View style={{ marginTop: 10, maxWidth: wide ? 420 : undefined }}>
        <Segmented<Seg> value={tab} onChange={switchTo} options={[{ key: 'hazards', label: 'Hazards & health', icon: Orbit }, { key: 'training', label: 'Training', icon: Dumbbell }]} />
      </View>
    </View>
  );

  const hazards = (
    <View>
      <PageHead kicker="NASA RIDGE · five hazards" title="Mission hazards" sub="Each hazard shows only the signals that feed it, and where they came from." style={{ marginTop: 6 }} />
      {m.demo ? <View style={{ marginTop: 10, alignSelf: 'flex-start' }}><DemoBadge /></View> : null}
      <Cols ratio={[1.1, 1]} gap={28} style={{ marginTop: 14 }}>
        <View style={{ gap: 8 }}>
          {m.hazards.map((h, i) => <Appear key={h.key} i={i}><HazardCard i={i} h={h} open={open === h.key} onToggle={() => setOpen(o => (o === h.key ? null : h.key))} readings={m.readings} onReading={setSheet} /></Appear>)}
        </View>
        <View style={{ marginTop: wide ? 0 : 14, gap: 10 }}>
          <Appear>
            {m.timeline ? <RiskTimeline tl={m.timeline} n={m.n} day={m.day} /> : (
              <Card><Txt v="subM">Risk timeline</Txt><Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Builds up as real data arrives. Turn on the synthetic Mars demo in Profile to see a full replay.</Txt></Card>
            )}
          </Appear>
          <Appear>
            <Card onPress={() => router.push('/eva')} label="EVA readiness" pad={14}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBubble icon={Footprints} color={next ? K.ok : K.flag} bg={next ? K.okTint : K.flagTint} />
                <View style={{ flex: 1 }}>
                  <Kicker color={K.ink2}>{m.nextEva ? `Next EVA · ${new Date(m.nextEva + 'T08:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : 'No EVA scheduled'}</Kicker>
                  <Txt v="subM" style={{ marginTop: 2 }}>{next ? 'Ready for the spacewalk' : `Not ready yet · ${m.gates.filter(g => !g.ok).length} of 4 checks`}</Txt>
                </View>
                <ChevronRight size={17} color={K.ink3} />
              </View>
            </Card>
          </Appear>
          <Appear>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Tool icon={Radiation} title="Radiation" sub="Mission dose · space weather" to="/radiation">
                <Count value={m.radiation.total} format={x => x.toFixed(1)} v="title" style={{ marginTop: 2 }}><Txt v="caption" color={K.ink2}> mSv</Txt></Count>
              </Tool>
              <Tool icon={FileText} title="Flight surgeon" sub="Reports & handoff queue" to="/report">
                <Count value={m.queued} v="title" style={{ marginTop: 2 }}><Txt v="caption" color={K.ink2}> waiting</Txt></Count>
              </Tool>
            </View>
          </Appear>
        </View>
      </Cols>
    </View>
  );

  return (
    <Page tabs title="Mission" header={header}>
      <Swap k={tab} dir={tab === 'training' ? 1 : -1}>
        {tab === 'hazards' ? hazards : <TrainingPanel />}
      </Swap>
      <ReadingSheet r={sheet} onClose={() => setSheet(null)} />
    </Page>
  );
}
