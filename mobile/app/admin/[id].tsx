import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Download, Phone } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Dot, Notice, PageHead, Segmented, Skeleton, Tag, TopBar, toast } from '@/kit/ui';
import { useLive } from '@/live/Live';
import type { Incident } from '@/live/Live';
import { LineChart, Progress, Spark } from '@/kit/charts';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { api, API_URL } from '@/api';
import { useApi } from '@/useApi';
import { DAYS } from '@/data/override';
import type { DayKey, Override } from '@/data/override';
import { SESSIONS } from '@/data/training';
import { pct } from './index';
import { CamViewer } from '@/kit/CamViewer';

type Metric = { key: string; label: string; unit: string; value: number | null; value2: number | null; status: string; spark: (number | null)[]; source: string | null; stale: boolean };
type Detail = {
  user: { id: number; name: string; email: string; mission: string; missionYears: number | null; dob: string }; readiness: number; checkedInToday: boolean;
  alerts: { level: 'red' | 'amber'; title: string; body: string }[]; metrics: Record<string, Metric>;
  plan: { source: string; progress: number; items: { key: string; title: string; done: boolean }[]; adaptations: { key: string; title: string; done: boolean; reason?: string }[] };
  override: (Override & { updatedAt?: string }) | null;
  snapshot: any | null;
  background: { cvText?: string; characteristics?: string; allergies?: string; medications?: string; conditions?: { name: string; notes: string }[]; sharedConsent?: boolean; updatedAt?: string } | null;
  handoffs?: { id: string; title: string; reason: string; missionDay: number | null; lines: { h: string; t: string }[]; queuedAt: number | null; receivedAt: string; ackAt: string | null; ackNote: string | null }[];
  mealEvents?: { day: string; slot: string; bites: number; startedAt: number }[];
  adminNotes: string; files: { id: number; name: string; size: number }[];
};
const tone = (s: string) => (s === 'green' ? 'ok' : s === 'amber' ? 'watch' : s === 'red' ? 'flag' : 'none');

const WEEK_TEMPLATES: { name: string; week: Partial<Record<DayKey, string[]>> }[] = [
  { name: 'Balanced week', week: { mon: ['lower-strength'], tue: ['station-cycle'], wed: ['mobility'], thu: ['lower-strength'], fri: ['harness-run'], sat: ['station-cycle'], sun: [] } },
  { name: 'Light recovery week', week: { mon: ['mobility'], tue: ['station-cycle'], wed: [], thu: ['mobility'], fri: ['station-cycle'], sat: ['mobility'], sun: [] } },
  { name: 'Bone-loading focus', week: { mon: ['lower-strength'], tue: ['harness-run'], wed: ['station-cycle'], thu: ['lower-strength'], fri: ['harness-run'], sat: ['lower-strength'], sun: ['mobility'] } },
];

function Handoffs({ list, uid, onDone }: { list: NonNullable<Detail['handoffs']>; uid: number; onDone: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const ack = async (id: string) => { try { await api(`/api/admin/handoffs/${uid}/${id}/ack`, { body: { note } }); setNote(''); setOpen(null); toast('Acknowledged. The astronaut sees it.'); onDone(); } catch (e: any) { toast(e?.message ?? 'Could not acknowledge'); } };
  return (
    <Card style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Kicker>Medical handoff reports</Kicker><Tag label={list.some(h => !h.ackAt) ? `${list.filter(h => !h.ackAt).length} waiting` : 'All acknowledged'} tone={list.some(h => !h.ackAt) ? 'flag' : 'ok'} /></View>
      {list.length === 0 ? <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>No handoff reports from this astronaut yet.</Txt> : list.map(h => (
        <View key={h.id} style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
          <Pressy label={h.title} onPress={() => setOpen(open === h.id ? null : h.id)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="subM" style={{ flex: 1 }}>{h.title}</Txt><Tag label={h.ackAt ? 'Acknowledged' : 'New'} tone={h.ackAt ? 'ok' : 'flag'} /></View>
            <Txt v="caption" color={K.ink2}>{h.missionDay ? `Day ${h.missionDay} · ` : ''}received {h.receivedAt} UTC</Txt>
          </Pressy>
          {open === h.id ? (
            <View style={{ marginTop: 10, gap: 8 }}>
              {h.lines.map(l => <View key={l.h}><Kicker color={K.ink2}>{l.h}</Kicker><Txt v="sub">{l.t}</Txt></View>)}
              {h.ackAt ? <Txt v="caption" color={K.ink3}>Acknowledged {h.ackAt} UTC{h.ackNote ? `: ${h.ackNote}` : ''}</Txt> : (
                <View>
                  <Field label="Reply to the astronaut (optional)" value={note} onChange={setNote} keyboard="default" placeholder="Rest today, retest HRV tomorrow" />
                  <View style={{ marginTop: 10 }}><Button small title="Acknowledge" onPress={() => ack(h.id)} /></View>
                </View>
              )}
            </View>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

/** One astronaut: progress, app report, server plan, background file, and the plan editor (send a ready plan). */
export default function CrewDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useApi<Detail>(`/api/admin/crew/${id}`);
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<number | undefined>();
  const [z2, setZ2] = useState<number | undefined>();
  const [inten, setInten] = useState<'light' | 'normal' | 'push' | undefined>();
  const [week, setWeek] = useState<Partial<Record<DayKey, string[]>>>({});
  const [tasks, setTasks] = useState<{ title: string; detail: string }[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [init, setInit] = useState(false);
  const [tab, setTab] = useState<'overview' | 'live' | 'plan' | 'file'>('overview');
  const [chart, setChart] = useState<'sleep' | 'hrv' | 'rhr' | 'recovery'>('sleep');
  const live = useLive();
  const { data: activity } = useApi<{ reports: { id: number; at: string; summary: string; segments: { state: string; from: number; to: number }[] }[] }>(`/api/admin/crew/${id}/activity`);
  const { data: inc } = useApi<{ incidents: Incident[] }>('/api/admin/incidents');
  const incidents = (inc?.incidents ?? []).filter(i => String(i.userId) === String(id)).slice(0, 8);

  useEffect(() => {
    if (!data || init) return;
    const o = data.override;
    setMsg(o?.message ?? ''); setRes(o?.resistancePerWeek); setZ2(o?.zone2Minutes); setInten(o?.intensity); setWeek(o?.week ?? {}); setTasks(o?.tasks ?? []); setNotes(data.adminNotes ?? '');
    setInit(true);
  }, [data, init]);

  const toggleSession = (d: DayKey, sid: string) => setWeek(w => { const l = w[d] ?? []; return { ...w, [d]: l.includes(sid) ? l.filter(x => x !== sid) : [...l, sid].slice(0, 3) }; });
  const send = async () => {
    setBusy(true);
    try {
      const body: Override = { message: msg, resistancePerWeek: res, zone2Minutes: z2, intensity: inten, week: Object.fromEntries(DAYS.map(d => [d.key, week[d.key] ?? []])), tasks: tasks.filter(t => t.title.trim()) };
      await api(`/api/admin/crew/${id}/override`, { method: 'PUT', body });
      toast('Plan sent to the astronaut'); setInit(false); reload();
    } catch (e: any) { toast(e.message ?? 'Could not send the plan'); } finally { setBusy(false); }
  };
  const withdraw = async () => { try { await api(`/api/admin/crew/${id}/override`, { method: 'DELETE' }); toast('Plan withdrawn'); setInit(false); setMsg(''); setRes(undefined); setZ2(undefined); setInten(undefined); setWeek({}); setTasks([]); reload(); } catch (e: any) { toast(e.message ?? 'Failed'); } };
  const saveNotes = async () => { try { await api(`/api/admin/crew/${id}/notes`, { method: 'PUT', body: { notes } }); toast('Private notes saved'); } catch (e: any) { toast(e.message ?? 'Failed'); } };

  if (error) return <Page title="Astronaut" maxWidth={820} header={<TopBar title="Astronaut" />}><View style={{ marginTop: 16 }}><Notice tone="flag" title="Could not load" body={String((error as any)?.message ?? error)} /></View></Page>;
  if (!data) return <Page title="Astronaut" maxWidth={820} header={<TopBar title="Astronaut" />}><View style={{ gap: 10, marginTop: 16 }}>{[0, 1, 2].map(i => <Skeleton key={i} h={110} r={22} />)}</View></Page>;
  const u = data.user, snap = data.snapshot, bg = data.background;

  return (
    <Page title={u.name} maxWidth={820} onRefresh={reload} header={<TopBar title={u.name} right={<Tag label={`${data.readiness ? 'Readiness ' + data.readiness : 'No data yet'}`} tone={!data.readiness ? 'none' : data.readiness >= 67 ? 'ok' : data.readiness >= 34 ? 'watch' : 'flag'} />} />}>
      <PageHead kicker={`${u.mission}${u.missionYears ? ` · ${u.missionYears} y` : ''}`} title={u.name} sub={u.email} style={{ marginTop: 6 }} />

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button small icon={Phone} title={`Call ${u.name.split(' ')[0]}`} disabled={live.busy} onPress={() => live.call(`u:${u.id}`, 'doctor', u.name)} />
        <Button small kind="secondary" title="Watch camera" onPress={() => setTab('live')} />
      </View>
      <View style={{ marginTop: 12 }}><Segmented value={tab} onChange={setTab} options={[{ key: 'overview', label: 'Overview' }, { key: 'live', label: 'Live' }, { key: 'plan', label: 'Plan' }, { key: 'file', label: 'File' }]} /></View>

      {tab === 'overview' ? <>
      {data.alerts.length ? <View style={{ gap: 8, marginTop: 14 }}>{data.alerts.map((a, i) => <Notice key={i} tone={a.level === 'red' ? 'flag' : 'watch'} title={a.title} body={a.body} />)}</View> : null}
      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Kicker>Trends · last 14 days</Kicker><View style={{ flexDirection: 'row', gap: 6 }}>{(['sleep', 'hrv', 'rhr', 'recovery'] as const).filter(k => data.metrics[k]).map(k => <Chip key={k} label={data.metrics[k].label} on={chart === k} onPress={() => setChart(k)} />)}</View></View>
        {data.metrics[chart] ? <View style={{ marginTop: 8 }}><LineChart values={data.metrics[chart].spark.slice(-14)} height={150} fmt={v => String(Math.round(v * 10) / 10)} /></View> : <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>No data for this signal.</Txt>}
        <Txt v="caption" color={K.ink3} style={{ marginTop: 4 }}>Drag across the chart to read each day. {data.metrics[chart]?.source ? `Source: ${data.metrics[chart].source}${data.metrics[chart].stale ? ' (stale)' : ''}` : ''}</Txt>
      </Card>
      <Handoffs list={data.handoffs ?? []} uid={u.id} onDone={reload} />
      <Card style={{ marginTop: 14 }}>
        <Kicker>Progress</Kicker>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {Object.values(data.metrics).map(m => (
            <View key={m.key} style={{ width: '48%', minWidth: 140, padding: 10, borderRadius: 14, backgroundColor: K.cardSunk }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot tone={tone(m.status)} size={6} /><Txt v="caption" color={K.ink2}>{m.label}</Txt></View>
              <Txt v="headline" tabular style={{ marginTop: 2 }}>{m.value == null ? '—' : `${m.value}${m.value2 != null ? '/' + m.value2 : ''} ${m.unit}`}</Txt>
              <View style={{ marginTop: 4 }}><Spark values={m.spark} w={110} h={20} /></View>
              {m.source ? <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9, marginTop: 2 }}>{m.source}{m.stale ? ' · stale' : ''}</Txt> : null}
            </View>
          ))}
        </View>
        <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>{data.checkedInToday ? 'Checked in today.' : 'No check-in today.'}</Txt>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Today's plan on the server · {Math.round(pct(data.plan.progress) * 100)}% done</Kicker>
        <View style={{ marginTop: 8 }}><Progress value={pct(data.plan.progress)} height={5} /></View>
        {[...data.plan.items, ...data.plan.adaptations].map(t => (
          <View key={t.key} style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Dot tone={t.done ? 'ok' : 'none'} size={7} /><Txt v="sub" color={t.done ? K.ink3 : K.ink} style={{ flex: 1 }}>{t.title}{'reason' in t && t.reason ? ` · ${t.reason}` : ''}</Txt>
          </View>
        ))}
      </Card>
      </> : null}
      {tab === 'live' ? <>
      <CamViewer id={id} name={u.name} />
      <Card style={{ marginTop: 12 }}>
        <Kicker>Camera activity reports</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Written on the camera device by a local SI from what it saw (posture, exercise, meals, objects). No video is stored.</Txt>
        {(activity?.reports ?? []).length ? activity!.reports.map(r => (
          <View key={r.id} style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Txt v="mono" color={K.ink3} upper>{r.at} UTC</Txt>
            <Txt v="sub" style={{ marginTop: 4 }}>{r.summary}</Txt>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8, backgroundColor: K.cardSunk }}>
              {r.segments.map((g, i) => <View key={i} style={{ flex: Math.max(1, g.to - g.from), backgroundColor: ({ sitting: '#D9A27E', standing: '#B8693F', lying: '#7A5C8E', walking: '#5E8F6B', exercising: '#2E7D6B', eating: '#C98A3B', absent: '#D8CFC9' } as Record<string, string>)[g.state] ?? K.ink4 }} />)}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>{[...new Set(r.segments.map(g => g.state))].map(st => <Txt key={st} v="caption" color={K.ink3}>{st}</Txt>)}</View>
          </View>
        )) : <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>No activity report yet. Start the camera station (/camera) and scan the room.</Txt>}
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Emergency alerts</Kicker>
        {incidents.length ? incidents.map(i => (
          <View key={i.id} style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: K.hair }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Txt v="subM" style={{ flex: 1 }}>{i.label}</Txt><Tag label={i.status === 'active' ? 'Active' : i.status === 'false_alarm' ? 'False alarm' : 'Resolved'} tone={i.status === 'active' ? 'flag' : 'none'} /></View>
            <Txt v="caption" color={K.ink2}>{i.at} UTC{i.confidence != null ? ` · confidence ${Math.round(i.confidence * 100)}%` : ''}{i.evidence ? ` · ${i.evidence}` : ''}</Txt>
          </View>
        )) : <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>No alerts for {u.name.split(' ')[0]}.</Txt>}
      </Card>
      </> : null}
      {tab === 'plan' ? <>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Send a plan to {u.name.split(' ')[0]}</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>It appears at once on their Training tab, Home "today's session" and My mission plan. {data.override?.updatedAt ? `Last sent ${data.override.updatedAt} UTC.` : 'Nothing sent yet.'}</Txt>
        <Field label="Message to the astronaut" value={msg} onChange={setMsg} keyboard="default" multiline placeholder="Why the plan changed, what to watch for…" />
        <Kicker color={K.ink2} style={{ marginTop: 16 }}>Resistance sessions a week</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{[2, 3, 4, 5, 6].map(n => <Chip key={n} label={`${n}`} on={res === n} onPress={() => setRes(res === n ? undefined : n)} />)}</View>
        <Kicker color={K.ink2} style={{ marginTop: 16 }}>Zone 2 minutes a week</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{[90, 120, 150, 180, 210].map(n => <Chip key={n} label={`${n}`} on={z2 === n} onPress={() => setZ2(z2 === n ? undefined : n)} />)}</View>
        <Kicker color={K.ink2} style={{ marginTop: 16 }}>Intensity</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{(['light', 'normal', 'push'] as const).map(n => <Chip key={n} label={n === 'push' ? 'Push' : n[0].toUpperCase() + n.slice(1)} on={inten === n} onPress={() => setInten(inten === n ? undefined : n)} />)}</View>

        <Kicker color={K.ink2} style={{ marginTop: 18 }}>Ready-made week</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>{WEEK_TEMPLATES.map(t => <Chip key={t.name} label={t.name} onPress={() => { setWeek(t.week); toast(`Loaded: ${t.name}`); }} />)}</View>
        {DAYS.map(d => (
          <View key={d.key} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Txt v="subM">{d.label}</Txt>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {SESSIONS.map(s => <Chip key={s.id} label={s.title} on={(week[d.key] ?? []).includes(s.id)} onPress={() => toggleSession(d.key, s.id)} />)}
            </View>
          </View>
        ))}

        <Kicker color={K.ink2} style={{ marginTop: 18 }}>Extra tasks</Kicker>
        {tasks.map((t, i) => (
          <View key={i} style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Field label={`Task ${i + 1}`} value={t.title} onChange={v => setTasks(x => x.map((y, j) => (j === i ? { ...y, title: v } : y)))} keyboard="default" />
            <Field label="Detail" value={t.detail} onChange={v => setTasks(x => x.map((y, j) => (j === i ? { ...y, detail: v } : y)))} keyboard="default" />
            <View style={{ marginTop: 6, alignItems: 'flex-start' }}><Pressy label="Remove task" onPress={() => setTasks(x => x.filter((_, j) => j !== i))}><Txt v="caption" color={K.flag}>Remove</Txt></Pressy></View>
          </View>
        ))}
        <View style={{ marginTop: 10 }}><Button small kind="secondary" title="Add a task" disabled={tasks.length >= 8} onPress={() => setTasks(x => [...x, { title: '', detail: '' }])} /></View>

        <View style={{ marginTop: 18, flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Button title="Send plan" loading={busy} onPress={send} /></View>
          {data.override ? <Button kind="secondary" title="Withdraw" onPress={withdraw} /> : null}
        </View>
      </Card>
      </> : null}
      {tab === 'file' ? <>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Reported by the astronaut's app</Kicker>
        {snap ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            <Txt v="sub">{snap.body?.sex || '—'} · {snap.body?.age || '—'} y · {snap.body?.heightCm || '—'} cm · {snap.body?.weightKg || '—'} kg · mission day {snap.missionDay}</Txt>
            {snap.briefing ? <Txt v="sub">{snap.briefing.destination.toUpperCase()} · {snap.briefing.durationDays} days · goal: {snap.briefing.objective} · EVA {snap.briefing.eva} · data: {snap.dataMode ?? 'not chosen'}</Txt> : null}
            {snap.numbers ? <Txt v="caption" color={K.ink2}>Max HR {snap.numbers.hrMax} · Zone 2 {snap.numbers.zone2?.[0]}–{snap.numbers.zone2?.[1]} bpm · {snap.numbers.kcal} kcal · protein {snap.numbers.protein?.[0]}–{snap.numbers.protein?.[1]} g · squat start {snap.numbers.loads?.squat} kg</Txt> : null}
            <Txt v="sub">Stress: {snap.stress?.level} ({snap.stress?.basis}) · {snap.stress?.highDays} high days this week</Txt>
            <Txt v="sub">Radiation: {snap.radiation?.rate != null ? `${snap.radiation.rate} mSv/day` : 'no reading'}{snap.radiation?.interval != null ? ` · 7-day ${snap.radiation.interval} mSv` : ''} · cumulative {snap.radiation?.cumulative != null ? `${snap.radiation.cumulative} mSv` : 'unavailable'}</Txt>
            <Txt v="sub">Sessions completed this week: {snap.sessionsThisWeek}</Txt>
            {snap.nutritionToday ? <Txt v="sub">Food today: {snap.nutritionToday.kcal} kcal · {snap.nutritionToday.protein} g protein · {(snap.nutritionToday.waterMl / 1000).toFixed(1)} L water{snap.numbers ? ` (targets ${snap.numbers.kcal} kcal, ${snap.numbers.protein?.[0]}–${snap.numbers.protein?.[1]} g, ${(snap.body?.weightKg * 0.035).toFixed(1)} L)` : ''}</Txt> : null}
            {snap.mealsToday ? <Txt v="sub">Meals today: {['breakfast', 'lunch', 'dinner', 'snack'].map(k => `${k} ${snap.mealsToday[k] ?? 'not marked'}`).join(' · ')}</Txt> : null}
            {data.mealEvents?.length ? <Txt v="sub">Camera saw eating: {data.mealEvents.map(e => `${e.slot} ${new Date(e.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${e.bites}+ bites)`).join(' · ')}</Txt> : null}
            {snap.mealsWeek ? <Txt v="caption" color={K.ink2}>Last 7 days: ate {snap.mealsWeek.ate} · skipped {snap.mealsWeek.skipped} main meals</Txt> : null}
            {snap.camera ? <Txt v="sub">Camera reps today: {Object.keys(snap.camera.todayReps).length ? Object.entries(snap.camera.todayReps).map(([k, v]) => `${k} ${v}`).join(' · ') : 'none'}</Txt> : null}
            {snap.camera?.lastSessions?.length ? <Txt v="caption" color={K.ink2}>Last camera sessions: {snap.camera.lastSessions.map((w: any) => `${w.exercise} ${w.reps} reps (${w.source})`).join(' · ')}</Txt> : null}
            {snap.exposures?.length ? <Txt v="caption" color={K.ink2}>Logged exposures: {snap.exposures.map((e: any) => `${e.kind} ${e.hours} h (${new Date(e.at).toLocaleDateString()})`).join(' · ')}</Txt> : null}
            <Txt v="mono" color={K.ink3} upper style={{ fontSize: 9, marginTop: 4 }}>Reported {snap.updatedAt} UTC</Txt>
          </View>
        ) : <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>The astronaut's app has not reported yet.</Txt>}
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>Background file</Kicker>
        {bg ? (
          <View style={{ marginTop: 8, gap: 10 }}>
            <Tag label={bg.sharedConsent ? 'Astronaut agreed to share with the SI' : 'Not shared with the SI'} tone={bg.sharedConsent ? 'ok' : 'none'} />
            {bg.conditions?.length ? <View><Kicker color={K.ink2}>Health conditions</Kicker>{bg.conditions.map((c, i) => <View key={i} style={{ marginTop: 6 }}><Txt v="subM">{c.name}</Txt>{c.notes ? <Txt v="caption" color={K.ink2}>{c.notes}</Txt> : null}</View>)}</View> : <Txt v="sub" color={K.ink3}>No health conditions listed.</Txt>}
            {bg.allergies ? <View><Kicker color={K.ink2}>Allergies</Kicker><Txt v="sub">{bg.allergies}</Txt></View> : null}
            {bg.medications ? <View><Kicker color={K.ink2}>Medications</Kicker><Txt v="sub">{bg.medications}</Txt></View> : null}
            {bg.characteristics ? <View><Kicker color={K.ink2}>Characteristics</Kicker><Txt v="sub">{bg.characteristics}</Txt></View> : null}
            {bg.cvText ? <View><Kicker color={K.ink2}>CV</Kicker><Txt v="sub">{bg.cvText}</Txt></View> : null}
          </View>
        ) : <Txt v="sub" color={K.ink3} style={{ marginTop: 8 }}>The astronaut has not filled in a background file yet.</Txt>}
        {data.files.length ? <View style={{ marginTop: 12 }}><Kicker color={K.ink2}>Files</Kicker>{data.files.map(f => (
          <Pressy key={f.id} label={`Download ${f.name}`} onPress={() => Linking.openURL(`${API_URL}/api/admin/crew/${id}/files/${f.id}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: K.hair, marginTop: 6 }}><Download size={16} color={K.copper} /><Txt v="subM" style={{ flex: 1 }} numberOfLines={1}>{f.name}</Txt><Txt v="caption" color={K.ink3}>{Math.max(1, Math.round(f.size / 1024))} KB</Txt></View>
          </Pressy>))}<Txt v="caption" color={K.ink3} style={{ marginTop: 4 }}>Downloads open in the browser console.</Txt></View> : null}
        <Field label="Private surgeon notes (the astronaut cannot see these)" value={notes} onChange={setNotes} keyboard="default" multiline placeholder="Clinical observations, follow-ups…" />
        <View style={{ marginTop: 10 }}><Button small kind="secondary" title="Save private notes" onPress={saveNotes} /></View>
      </Card>
      </> : null}
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 16 }}>Not a medical device. The astronaut's flight surgeon remains responsible for medical decisions.</Txt>
    </Page>
  );
}
