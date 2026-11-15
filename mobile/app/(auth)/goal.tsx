/**
 * Mission goal (optional). Two calm buttons — Destination and Main tasks. Tapping one slides a short
 * option list open underneath (only one open at a time); picking a destination closes it again.
 * "Skip for now" moves on with nothing set.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Check, ChevronDown, Compass, FlaskConical, Construction, Footprints, Navigation, Stethoscope, Mountain, Wrench } from 'lucide-react-native';
import { A, F } from '@/theme';
import { T } from '@/ui';
import { FormScroll, FormShell, tick } from '@/astra';
import Planet from '@/Planet';
import { EASE_OUT, native, nav } from '@/motion';
import { GOAL_DEST, GOAL_DEST_NAME, GOAL_TASK, useDraft, type GoalDest, type GoalTask } from '@/onboarding';

const TASK_ICON: Record<GoalTask, any> = { repair: Wrench, science: FlaskConical, assembly: Construction, eva: Footprints, piloting: Navigation, medical: Stethoscope, surface: Mountain };
const ROW = 52;

/** Button that expands into a list of options. */
function SelectField({ label, value, placeholder, icon, open, onToggle, rows }: {
  label: string; value: string | null; placeholder: string; icon: React.ReactNode; open: boolean; onToggle: () => void; rows: React.ReactNode[];
}) {
  const a = useRef(new Animated.Value(open ? 1 : 0)).current;
  const form = React.useContext(FormScroll);
  useEffect(() => { Animated.spring(a, { toValue: open ? 1 : 0, useNativeDriver: false, speed: 14, bounciness: open ? 4 : 0 }).start(); if (open) form.toEnd(); }, [open]);
  return (
    <View style={{ marginTop: 18 }}>
      <Animated.Text style={{ fontFamily: F.m, fontSize: 13.5, marginBottom: 8, marginLeft: 2, color: a.interpolate({ inputRange: [0, 1], outputRange: [A.ink, A.copperDeep] }) }}>{label}</Animated.Text>
      <Animated.View style={{ borderRadius: 18, borderWidth: 1.2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.94)', borderColor: a.interpolate({ inputRange: [0, 1], outputRange: ['rgba(227,183,158,0)', A.copperSoft] }) }}>
        <Pressable onPress={() => { tick(); onToggle(); }} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}: ${value ?? placeholder}`}
          style={{ height: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {icon}
          <T size={16} weight={value ? 'sb' : 'r'} color={value ? A.ink : A.ink3} style={{ flex: 1 }} numberOfLines={1}>{value ?? placeholder}</T>
          <Animated.View style={{ transform: [{ rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}><ChevronDown size={18} color={A.copper} /></Animated.View>
        </Pressable>
        <Animated.View style={{ height: a.interpolate({ inputRange: [0, 1], outputRange: [0, rows.length * ROW + 9] }), opacity: a }}>
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(184,105,63,0.12)', paddingVertical: 4 }}>{rows}</View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function OptionRow({ icon, label, sub, on, onPress, i, open }: { icon: React.ReactNode; label: string; sub?: string; on: boolean; onPress: () => void; i: number; open: boolean }) {
  const c = useRef(new Animated.Value(on ? 1 : 0)).current;
  const enter = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => { Animated.timing(c, { toValue: on ? 1 : 0, duration: 220, easing: EASE_OUT, useNativeDriver: false }).start(); }, [on]);
  useEffect(() => { // rows cascade in as the list opens
    if (!open) { enter.setValue(0); return; }
    Animated.timing(enter, { toValue: 1, duration: 360, delay: 40 + i * 35, easing: EASE_OUT, useNativeDriver: native }).start();
  }, [open]);
  return (
    <Pressable onPress={() => { tick(); onPress(); }} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <Animated.View style={{ height: ROW, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
        <Animated.View style={{ position: 'absolute', left: 6, right: 6, top: 3, bottom: 3, borderRadius: 12, backgroundColor: 'rgba(241,205,182,0.38)', opacity: c }} />
        <View style={{ width: 30, alignItems: 'center' }}>{icon}</View>
        <View style={{ flex: 1 }}>
          <T size={15} weight={on ? 'sb' : 'm'} color={A.ink}>{label}</T>
          {sub ? <T size={12} color={A.ink2}>{sub}</T> : null}
        </View>
        <Animated.View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1.2,
          borderColor: c.interpolate({ inputRange: [0, 1], outputRange: ['rgba(184,105,63,0.3)', A.copper] }), backgroundColor: c.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0)', A.copper] }) }}>
          <Animated.View style={{ opacity: c, transform: [{ scale: c }] }}><Check size={12} color="#fff" strokeWidth={3} /></Animated.View>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function Goal() {
  const [d, set] = useDraft();
  const [open, setOpen] = useState<'dest' | 'tasks' | null>(null);
  if (!d.firstName) return <Redirect href="/name" />;
  const toggle = (k: 'dest' | 'tasks') => setOpen(o => (o === k ? null : k));
  const pickDest = (k: GoalDest) => { set({ goalDest: d.goalDest === k ? null : k }); setTimeout(() => setOpen(null), 280); };
  const toggleTask = (k: GoalTask) => set({ goalTasks: d.goalTasks.includes(k) ? d.goalTasks.filter(t => t !== k) : [...d.goalTasks, k] });
  const skip = () => { set({ goalDest: null, goalTasks: [] }); nav.push('/email'); };
  const any = !!d.goalDest || d.goalTasks.length > 0;
  const first = d.goalTasks.length ? GOAL_TASK.find(t => t.key === d.goalTasks[0])!.label : null;
  const taskText = !first ? null : d.goalTasks.length === 1 ? first : `${first} +${d.goalTasks.length - 1}`;

  return (
    <FormShell step={4} title="What’s your mission goal?" sub="Optional — it helps Celeste tune training and alerts. You can change it later in Profile."
      onBack={() => nav.back('/mission')} onNext={() => nav.push('/email')}>
      <SelectField label="Destination" value={d.goalDest ? GOAL_DEST_NAME[d.goalDest] : null} placeholder="Where are you heading?"
        icon={d.goalDest ? <Planet k={d.goalDest} size={30} /> : <Compass size={20} color={A.copper} />} open={open === 'dest'} onToggle={() => toggle('dest')}
        rows={GOAL_DEST.map((g, i) => <OptionRow key={g.key} i={i} open={open === 'dest'} icon={<Planet k={g.key} size={30} />} label={g.label} sub={g.sub} on={d.goalDest === g.key} onPress={() => pickDest(g.key)} />)} />
      <SelectField label="Main tasks" value={taskText} placeholder="What will you do there?"
        icon={<Wrench size={19} color={A.copper} />} open={open === 'tasks'} onToggle={() => toggle('tasks')}
        rows={GOAL_TASK.map((g, i) => { const I = TASK_ICON[g.key]; return <OptionRow key={g.key} i={i} open={open === 'tasks'} icon={<I size={18} color={A.copper} strokeWidth={1.9} />} label={g.label} on={d.goalTasks.includes(g.key)} onPress={() => toggleTask(g.key)} />; })} />
      {!any ? <T size={14} weight="m" color={A.copper} style={{ marginTop: 26, alignSelf: 'center' }} onPress={skip}>Skip for now</T> : <View />}
    </FormShell>
  );
}
