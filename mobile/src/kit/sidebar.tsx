/** Laptop-website left rail (≥ 1024 px): the five tabs + main tools. Shared by the tab screens and every pushed page. */
import React from 'react';
import { View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { House, Orbit, ClipboardCheck, PersonStanding, User, Sparkles, Radiation, FileHeart, Siren, UsersRound, Users, Stethoscope } from 'lucide-react-native';
import { useAuth } from '../auth';
import { AstraLogo } from '../astra';
import { K } from './tokens';
import { Kicker, Pressy, Txt } from './core';
import { Dot } from './ui';
import { leaveTab } from './transition';

// Home · Mission · Check · Body · Profile  (Training lives in Mission › Countermeasures; Assistant on Home, hidden in judge mode)
export const TABS: { name: string; icon: any; label: string }[] = [
  { name: 'today', icon: House, label: 'Home' },
  { name: 'hazards', icon: Orbit, label: 'Mission' },
  { name: 'assistant', icon: Sparkles, label: 'SI' },
  { name: 'body', icon: PersonStanding, label: 'Body' },
  { name: 'profile', icon: User, label: 'Profile' },
];

const TOOLS: { to: string; icon: any; label: string; tone?: string }[] = [
  { to: '/check', icon: ClipboardCheck, label: 'Daily check' },
  { to: '/radiation', icon: Radiation, label: 'Radiation' },
  { to: '/report', icon: FileHeart, label: 'Flight surgeon' },
  { to: '/crew', icon: UsersRound, label: 'My crew' },
  { to: '/family', icon: Users, label: 'Family' },
  { to: '/emergency', icon: Siren, label: 'Emergency', tone: K.flag },
];

/** Desktop web: a calm left rail with the same five destinations plus the main tools. */
export function Sidebar() {
  const path = usePathname();
  const { user } = useAuth();
  const tools = user?.leader ? [...TOOLS, { to: '/admin/leader', icon: Stethoscope, label: 'Team overview' }, { to: '/admin', icon: Stethoscope, label: 'Doctor console' }] : user?.admin || user?.role === 'surgeon' ? [...TOOLS, { to: '/admin', icon: Stethoscope, label: 'Surgeon console' }] : TOOLS;
  const cur = TABS.find(t => path.startsWith('/' + t.name))?.name ?? (path === '/' ? 'today' : null);
  return (
    <View style={{ width: 252, paddingTop: 30, paddingHorizontal: 18, paddingBottom: 22, borderRightWidth: 1, borderRightColor: K.hair, backgroundColor: 'rgba(255,250,246,0.6)' }}>
      <View style={{ paddingHorizontal: 10 }}><AstraLogo size={17} /></View>
      <Kicker color={K.ink3} style={{ marginTop: 34, marginBottom: 10, marginLeft: 10 }}>Crew health</Kicker>
      {TABS.map(t => {
        const on = t.name === cur;
        return (
          <Pressy key={t.name} label={t.label} role="tab" selected={on} onPress={async () => { if (on) return; await leaveTab(cur ?? undefined, t.name); router.navigate(`/${t.name}` as any); }} to={0.98}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 46, borderRadius: 14, marginBottom: 4, backgroundColor: on ? K.copper : 'transparent' }}>
              <t.icon size={19} color={on ? '#fff' : K.ink2} strokeWidth={1.8} />
              <Txt v="bodyM" color={on ? '#fff' : K.ink}>{t.label}</Txt>
            </View>
          </Pressy>
        );
      })}
      <Kicker color={K.ink3} style={{ marginTop: 22, marginBottom: 10, marginLeft: 10 }}>Tools</Kicker>
      {tools.map(t => {
        const on = path.startsWith(t.to);
        return (
          <Pressy key={t.to} label={t.label} onPress={() => router.navigate(t.to as any)} to={0.98}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, height: 42, borderRadius: 14, marginBottom: 2, backgroundColor: on ? K.copperTint : 'transparent' }}>
              <t.icon size={18} color={t.tone ?? K.ink2} strokeWidth={1.8} />
              <Txt v="sub" color={K.ink}>{t.label}</Txt>
            </View>
          </Pressy>
        );
      })}
      <View style={{ flex: 1 }} />
      <View style={{ padding: 14, borderRadius: 16, backgroundColor: K.card, borderWidth: 1, borderColor: K.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Dot tone="ok" pulse /><Txt v="subM">Sync active</Txt></View>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>WHOOP · Manual entry · Dosimeter</Txt>
      </View>
    </View>
  );
}

