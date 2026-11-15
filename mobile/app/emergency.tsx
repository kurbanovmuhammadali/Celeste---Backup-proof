/**
 * Emergency protocols — one tap from the SOS button anywhere. Dark, high-contrast, big tap targets,
 * bundled with the app so they work with no connection. Opening a checklist walks it step by step.
 * Training content for the demo — not an operational NASA procedure.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronLeft, X } from 'lucide-react-native';
import { K, MOTION, native } from '@/kit/tokens';
import { Pressy, Txt, haptic } from '@/kit/core';
import { api } from '@/api';
import { toast } from '@/kit/ui';
import { useLive } from '@/live/Live';

const LISTS: { id: string; title: string; urgent?: boolean; steps: string[] }[] = [
  { id: 'chest', title: 'Medical: chest pain', urgent: true, steps: ['Stop all activity and sit upright', 'Tell the crew medical officer now', 'Note the time symptoms started', 'Check heart rate and SpO₂', 'Open the medical kit · cardiac pack', 'Contact the flight surgeon on the priority loop', 'Stay with the crew member until advised'] },
  { id: 'depress', title: 'Rapid depressurisation', steps: ['Call out "Depress" on the crew loop', 'Don masks if pressure is falling fast', 'Move to the designated safe module', 'Close hatches behind you', 'Check the pressure trend', 'Report to Mission Control', 'Prepare the leak-check kit', 'Account for every crew member', 'Wait for instructions'] },
  { id: 'fire', title: 'Fire / smoke', steps: ['Call out "Fire" on the crew loop', 'Don masks', 'Cut power to the affected rack', 'Use the CO₂ extinguisher if flames are seen', 'Close the module hatch', 'Monitor the atmosphere', 'Report to Mission Control', 'Account for every crew member'] },
  { id: 'toxic', title: 'Toxic atmosphere', steps: ['Don masks', 'Move upwind of the source', 'Close the affected module', 'Check the atmosphere monitor', 'Report to Mission Control', 'Account for every crew member'] },
  { id: 'spe', title: 'Solar particle event', steps: ['Move to the shielded crew quarters', 'Take your personal dosimeter', 'Close the hatch behind you', 'Log the start time', 'Stay until the all-clear'] },
];

function Steps({ list, onClose }: { list: typeof LISTS[number]; onClose: () => void }) {
  const [done, setDone] = useState<number[]>([]);
  const cur = list.steps.findIndex((_, i) => !done.includes(i));
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(p, { toValue: done.length / list.steps.length, duration: 380, easing: MOTION.out, useNativeDriver: false }).start(); }, [done.length]);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginTop: 12 }}>
        <Animated.View style={{ height: 6, backgroundColor: '#F3B48D', width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
      <ScrollView style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingBottom: 30 }}>
        {list.steps.map((s, i) => {
          const on = done.includes(i), now = i === cur;
          return (
            <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => { haptic.firm(); setDone(d => (on ? d.filter(x => x !== i) : [...d, i])); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64, paddingHorizontal: 16, borderRadius: 18, backgroundColor: now ? 'rgba(243,180,141,0.18)' : 'rgba(255,255,255,0.06)', borderWidth: now ? 1.5 : 0, borderColor: '#F3B48D' }}>
              <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? K.ok : 'transparent', borderWidth: 1.5, borderColor: on ? K.ok : 'rgba(255,255,255,0.4)' }}>
                {on ? <Check size={17} color="#fff" strokeWidth={3} /> : <Txt v="subM" color="#fff">{i + 1}</Txt>}
              </View>
              <Txt v="bodyM" color={on ? 'rgba(255,255,255,0.45)' : '#fff'} style={{ flex: 1, fontSize: 17, lineHeight: 22, textDecorationLine: on ? 'line-through' : 'none' }}>{s}</Txt>
            </Pressable>
          );
        })}
        {cur === -1 ? <View style={{ padding: 16, borderRadius: 18, backgroundColor: 'rgba(92,154,110,0.25)' }}><Txt v="bodyM" color="#fff">Checklist complete. Log what happened in today’s report.</Txt></View> : null}
      </ScrollView>
      <Pressy label="Back to protocols" onPress={onClose}><Txt v="subM" color="#F3D9C6" center style={{ paddingVertical: 10 }}>All protocols</Txt></Pressy>
    </View>
  );
}

export default function Emergency() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const list = LISTS.find(l => l.id === open);
  const live = useLive();
  const [sent, setSent] = useState(false);
  const sos = async () => { haptic.firm(); try { await api('/api/alerts/sos', { body: {} }); setSent(true); toast('SOS sent. Flight surgeons and crew are alerted.'); } catch (e: any) { toast(e.message ?? 'Could not send. Call the crew loop.'); } };
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => { enter.setValue(0); Animated.timing(enter, { toValue: 1, duration: 420, easing: MOTION.out, useNativeDriver: native }).start(); }, [open]);
  return (
    <View style={{ flex: 1, backgroundColor: '#1C120D', paddingTop: insets.top + 12, paddingHorizontal: 18, paddingBottom: insets.bottom + 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Txt v="mono" color="#F3B48D" upper style={{ fontSize: 10 }}>Training checklist · works offline</Txt>
        <Pressy label="Close" onPress={() => (open ? setOpen(null) : router.back())}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>{open ? <ChevronLeft size={18} color="#fff" /> : <X size={18} color="#fff" />}</View>
        </Pressy>
      </View>
      <Txt v="display" color="#fff" style={{ marginTop: 8 }}>{list ? list.title : 'Emergency'}</Txt>
      <Animated.View style={{ flex: 1, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
        {list ? <Steps key={list.id} list={list} onClose={() => setOpen(null)} /> : (
          <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 16, paddingBottom: 20 }}>
            <Pressy label="SOS: alert flight surgeons and crew" onPress={sos} to={0.97}>
              <View style={{ borderRadius: 20, padding: 18, backgroundColor: sent ? K.ok : '#B3261E' }}>
                <Txt v="headline" color="#fff" style={{ fontSize: 20 }}>{sent ? 'Help is alerted' : 'SOS · alert everyone now'}</Txt>
                <Txt v="caption" color="rgba(255,255,255,0.85)" style={{ marginTop: 3 }}>{sent ? 'Every flight surgeon and crew mate has your name on a loud alert.' : 'Sends a loud alert with your name to every flight surgeon and crew mate. They can call you.'}</Txt>
              </View>
            </Pressy>
            <Pressy label="Call my doctor" onPress={() => live.call('doctors', 'doctor', 'Flight surgeon')} to={0.97}>
              <View style={{ borderRadius: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.14)' }}><Txt v="headline" color="#fff" style={{ fontSize: 17 }}>Call the flight surgeon</Txt></View>
            </Pressy>
            {LISTS.map(l => (
              <Pressy key={l.id} label={l.title} onPress={() => { haptic.firm(); setOpen(l.id); }} to={0.97}>
                <View style={{ borderRadius: 20, padding: 18, backgroundColor: l.urgent ? K.flag : 'rgba(255,255,255,0.08)' }}>
                  <Txt v="headline" color="#fff" style={{ fontSize: 18 }}>{l.title}</Txt>
                  <Txt v="caption" color="rgba(255,255,255,0.75)" style={{ marginTop: 3 }}>{l.steps.length} steps</Txt>
                </View>
              </Pressy>
            ))}
            <Txt v="caption" color="rgba(255,255,255,0.5)" style={{ marginTop: 6 }}>Training content for the demo — not an operational NASA procedure.</Txt>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}
