import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import { Phone, Siren } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Pressy, Txt } from '@/kit/core';
import { Button } from '@/kit/ui';
import { useAuth } from '@/auth';
import { api } from '@/api';
import CallPanel from './CallPanel';
import { tone, useCalls } from './calls';
import type { CallKind } from './calls';

export type Incident = { id: number; userId: number; name: string; kind: string; label: string; severity: string; confidence: number | null; evidence: string | null; status: string; escalated: boolean; at: string; responding?: string[] };
type LiveCtx = { connected: boolean; incidents: Incident[]; call: (to: string, kind: CallKind, name: string) => void; busy: boolean; unreadFamily: number };
const Ctx = createContext<LiveCtx>({ connected: false, incidents: [], call: () => {}, busy: false, unreadFamily: 0 });
export const useLive = () => useContext(Ctx);

/**
 * Live layer for signed-in users: emergency alerts (flight surgeons and crew mates hear about an incident within a second, with an
 * alarm that escalates if nobody takes it) and voice/video calls. Web only; the app also polls once on load.
 */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const web = Platform.OS === 'web';
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selfAlert, setSelfAlert] = useState<{ id: number; label: string } | null>(null);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [unreadFamily, setUnread] = useState(0);
  const alarm = useRef<null | (() => void)>(null);
  const isAdmin = !!user?.admin || user?.role === 'surgeon';

  const onEvent = useCallback((m: any) => {
    if (m.type === 'incident') setIncidents(a => [m.incident, ...a.filter(x => x.id !== m.incident.id)]);
    else if (m.type === 'incident-update') setIncidents(a => a.map(x => (x.id === m.id ? { ...x, responding: m.responding } : x)));
    else if (m.type === 'incident-closed') { setIncidents(a => a.filter(x => x.id !== m.id)); setSelfAlert(s => (s?.id === m.id ? null : s)); }
    else if (m.type === 'incident-self') setSelfAlert(m.incident);
    else if (m.type === 'family-message') setUnread(n => n + 1);
  }, []);
  const { call, local, remote, connected, startCall, accept, decline, hangup, mute, video } = useCalls(web && user ? 'role=inbox' : null, onEvent);

  useEffect(() => { if (web && user) api<{ incidents: Incident[] }>('/api/alerts').then(r => setIncidents(r.incidents)).catch(() => {}); }, [user?.id]);
  const open = incidents.filter(i => i.status === 'active' && i.userId !== user?.id && !dismissed.includes(i.id));
  useEffect(() => { // the alarm sounds while an unacknowledged incident is open
    if (open.length && !alarm.current) { alarm.current = tone('alarm'); try { navigator.vibrate?.([300, 150, 300]); } catch { /* ignore */ } }
    if (!open.length && alarm.current) { alarm.current(); alarm.current = null; }
  }, [open.length]);
  useEffect(() => () => { alarm.current?.(); }, []);

  const respond = (i: Incident, kind: 'seen' | 'responding') => api(`/api/alerts/${i.id}/ack`, { body: { kind } }).catch(() => {});
  const resolve = (i: Incident, status: 'resolved' | 'false_alarm') => api(`/api/admin/alerts/${i.id}/resolve`, { body: { status } }).catch(() => {});
  const top = open[0];

  return (
    <Ctx.Provider value={{ connected, incidents, call: (to, kind, name) => startCall(to, kind, name), busy: call.phase !== 'idle', unreadFamily }}>
      {children}
      {web && user && top && call.phase === 'idle' ? (
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 8000, backgroundColor: 'rgba(120,10,10,0.94)', alignItems: 'center', justifyContent: 'center', padding: 24 } as any}>
          <Siren size={54} color="#fff" />
          <Txt v="mono" color="#FFD2C8" upper style={{ marginTop: 14 }}>{top.escalated ? 'Nobody has responded yet · escalated' : 'Emergency alert'}{open.length > 1 ? ` · ${open.length} open` : ''}</Txt>
          <Txt v="hero" color="#fff" center style={{ marginTop: 8, fontSize: 36 }}>{top.name}</Txt>
          <Txt v="title" color="#fff" center style={{ marginTop: 6 }}>{top.label}</Txt>
          {top.evidence ? <Txt v="sub" color="#FFD2C8" center style={{ marginTop: 8, maxWidth: 420 }}>{top.evidence}{top.confidence != null ? ` · confidence ${Math.round(top.confidence * 100)}%` : ''}</Txt> : null}
          <Txt v="caption" color="#FFD2C8" center style={{ marginTop: 8, maxWidth: 420 }}>Detected automatically by the camera's local SI. It can be wrong: check on the person and use the call button.</Txt>
          {top.responding?.length ? <Txt v="subM" color="#fff" center style={{ marginTop: 10 }}>Responding: {top.responding.join(', ')}</Txt> : null}
          <View style={{ gap: 10, marginTop: 22, width: '100%', maxWidth: 360 }}>
            <Button title="I am responding" onPress={() => respond(top, 'responding')} />
            <Button kind="secondary" icon={Phone} title={`Call ${top.name.split(' ')[0]}`} onPress={() => startCall(`u:${top.userId}`, isAdmin ? 'doctor' : 'crew', top.name)} />
            {isAdmin ? <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Button small kind="secondary" title="False alarm" onPress={() => resolve(top, 'false_alarm')} /></View>
              <View style={{ flex: 1 }}><Button small kind="secondary" title="Resolved" onPress={() => resolve(top, 'resolved')} /></View>
            </View> : null}
            <Button small kind="ghost" title="Hide for now" onPress={() => { respond(top, 'seen'); setDismissed(d => [...d, top.id]); }} />
          </View>
        </View>
      ) : null}
      {web && user && selfAlert ? (
        <Pressy label="Help has been alerted" onPress={() => setSelfAlert(null)}>
          <View style={{ position: 'absolute', left: 12, right: 12, top: 12, zIndex: 7000, backgroundColor: '#B3261E', borderRadius: 16, padding: 14 } as any}>
            <Txt v="subM" color="#fff">Help has been alerted: {selfAlert.label}</Txt>
            <Txt v="caption" color="#FFD2C8">Your flight surgeon and crew have been told. Stay where you are if you can. Tap to close.</Txt>
          </View>
        </Pressy>
      ) : null}
      <CallPanel call={call} local={local} remote={remote} accept={accept} decline={decline} hangup={hangup} mute={mute} video={video} />
    </Ctx.Provider>
  );
}
