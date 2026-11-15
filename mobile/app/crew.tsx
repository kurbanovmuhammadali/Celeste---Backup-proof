import React, { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Copy, Phone, Share2, Users } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Dot, Notice, PageHead, Sheet, Tag, TopBar, toast } from '@/kit/ui';
import { LineChart } from '@/kit/charts';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { api } from '@/api';
import { getStore , getBriefing} from '@/data/store';
import { useTeam } from '@/data/team';
import type { Crew } from '@/data/team';
import { useLive } from '@/live/Live';

const CATS = [['health', 'Health'], ['mood', 'Mood'], ['fatigue', 'Fatigue'], ['conflict', 'Conflict'], ['safety', 'Safety'], ['other', 'Other']] as const;
const copy = (t: string) => { try { (navigator as any).clipboard?.writeText(t); toast('Copied'); } catch { toast(t); } };
const share = async (t: string) => { try { if ((navigator as any).share) await (navigator as any).share({ text: t }); else copy(t); } catch { /* cancelled */ } };

/** Create or join a crew, then: members, shared mission, anonymous pulse, kudos and anonymous concerns. */
export default function CrewHub() {
  const { crew, loading, setCrew, reload } = useTeam();
  const live = useLive();
  const [name, setName] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [mood, setMood] = useState(3), [stress, setStress] = useState(3);
  const [post, setPost] = useState(''), [sheet, setSheet] = useState<null | 'report' | 'leave'>(null);
  const [about, setAbout] = useState<number | null>(null), [cat, setCat] = useState<string>('fatigue'), [msg, setMsg] = useState('');
  const run = async (f: () => Promise<{ crew: Crew | null }>) => { setBusy(true); setErr(null); try { setCrew((await f()).crew); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };

  if (loading && !crew) return <Page title="Crew" maxWidth={640} header={<TopBar title="Crew" />}><Txt v="sub" color={K.ink3} style={{ marginTop: 20 }}>Loading…</Txt></Page>;

  if (!crew) return (
    <Page title="Crew" maxWidth={560} header={<TopBar title="Your crew" />}>
      <PageHead kicker="Team" title="Join your team" sub="Crew mates share the same mission, see each other, can call each other, and are alerted together in an emergency." style={{ marginTop: 6 }} />
      <Card style={{ marginTop: 14 }}>
        <Kicker>I have a code</Kicker>
        <Field label="Crew code" value={code} onChange={setCode} keyboard="default" placeholder="K7M-2QX" />
        <View style={{ marginTop: 12 }}><Button title="Join crew" disabled={code.trim().length < 6} loading={busy} onPress={() => run(() => api('/api/crew/join', { body: { code } }))} /></View>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Kicker>I am the commander</Kicker>
        <Field label="Name your crew" value={name} onChange={setName} keyboard="default" placeholder="Odyssey" />
        <View style={{ marginTop: 12 }}><Button kind="secondary" title="Create crew" disabled={name.trim().length < 2} loading={busy} onPress={() => run(() => api('/api/crew', { body: { name } }))} /></View>
      </Card>
      {err ? <Txt v="caption" color={K.flag} style={{ marginTop: 10 }}>{err}</Txt> : null}
    </Page>
  );

  const cmd = crew.role === 'commander';
  const mates = crew.members.filter(m => !m.you);
  const invite = `Join my HMSC crew "${crew.name}" with the code ${crew.code}`;
  return (
    <Page title="Crew" maxWidth={720} onRefresh={reload} header={<TopBar title={crew.name} right={<Tag label={cmd ? 'Commander' : 'Member'} />} />}>
      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}><Kicker>Join code</Kicker><Txt v="title" style={{ letterSpacing: 2 }}>{crew.code}</Txt></View>
          <Button small kind="secondary" icon={Copy} title="Copy" onPress={() => copy(crew.code)} />
          <Button small icon={Share2} title="Invite" onPress={() => share(invite)} />
        </View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Members · {crew.members.length}</Kicker>
        {crew.members.map((m, i) => (
          <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair, marginTop: i ? 0 : 6 }}>
            <Dot tone={m.online ? 'ok' : 'none'} size={9} />
            <View style={{ flex: 1 }}><Txt v="subM">{m.name}{m.you ? ' (you)' : ''}</Txt><Txt v="caption" color={K.ink2}>{m.role === 'commander' ? 'Commander · ' : ''}{m.online ? 'Online' : 'Offline'}</Txt></View>
            {!m.you ? <Button small kind="secondary" icon={Phone} title="Call" disabled={!m.online || live.busy} onPress={() => live.call(`u:${m.id}`, 'crew', m.name)} /> : null}
            {!m.you ? <Tag label="Concern" onPress={() => { setAbout(m.id); setSheet('report'); }} /> : null}
          </View>
        ))}
        {!mates.length ? <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>You are the first one here. Share the code above.</Txt> : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Shared mission</Kicker>
        {crew.briefing ? <Txt v="sub" style={{ marginTop: 6 }}>{crew.briefing.dest.toUpperCase()} · {crew.briefing.durationDays} days · {crew.briefing.objective}. Everyone in the crew follows this mission.</Txt>
          : <Txt v="sub" color={K.ink2} style={{ marginTop: 6 }}>{cmd ? 'Share your mission briefing so the whole crew uses the same destination, duration and plan.' : 'The commander has not shared a mission yet.'}</Txt>}
        {cmd ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button small title={crew.briefing ? 'Update from my briefing' : 'Share my mission'} onPress={() => run(() => api('/api/crew/briefing', { method: 'PUT', body: { briefing: getStore().briefing } }))} />
          {false ? <Button small kind="secondary" title="Edit my briefing" onPress={() => router.push('/profile/briefing')} /> : null}
        </View> : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Crew pulse · anonymous</Kicker>
        {crew.pulse.enough ? (
          <View style={{ marginTop: 6 }}>
            <Txt v="sub">Today the crew averages <Txt v="subM">mood {crew.pulse.mood}/5</Txt> and <Txt v="subM">stress {crew.pulse.stress}/5</Txt> ({crew.pulse.todayCount} people).</Txt>
            {crew.pulse.history.length > 1 ? <View style={{ marginTop: 8 }}><LineChart values={crew.pulse.history.map(h => h.mood)} labels={crew.pulse.history.map(h => h.day.slice(5))} height={90} fmt={v => v.toFixed(1)} /></View> : null}
          </View>
        ) : <Txt v="sub" color={K.ink2} style={{ marginTop: 6 }}>The average appears once 3 people add theirs, so nobody can be singled out ({crew.pulse.todayCount} of 3 today).</Txt>}
        {!crew.pulse.mine ? (
          <View style={{ marginTop: 10 }}>
            <Txt v="caption" color={K.ink2}>Mood</Txt><View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>{[1, 2, 3, 4, 5].map(n => <Chip key={n} label={String(n)} on={mood === n} onPress={() => setMood(n)} />)}</View>
            <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>Stress</Txt><View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>{[1, 2, 3, 4, 5].map(n => <Chip key={n} label={String(n)} on={stress === n} onPress={() => setStress(n)} />)}</View>
            <View style={{ marginTop: 10 }}><Button small title="Add my number (anonymous)" onPress={() => run(() => api('/api/crew/pulse', { body: { mood, stress } }))} /></View>
          </View>
        ) : <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>You added your number today. Thank you.</Txt>}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Crew board</Kicker>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <View style={{ flex: 1 }}><Field label={cmd ? 'Announcement or thanks' : 'Say thanks to the crew'} value={post} onChange={setPost} keyboard="default" placeholder={cmd ? 'EVA prep at 09:00' : 'Thanks Ben for the help today'} /></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button small title="Send thanks" disabled={post.trim().length < 2} onPress={() => run(async () => { const r = await api<{ crew: Crew }>('/api/crew/feed', { body: { kind: 'kudos', text: post } }); setPost(''); return r; })} />
          {cmd ? <Button small kind="secondary" title="Post announcement" disabled={post.trim().length < 2} onPress={() => run(async () => { const r = await api<{ crew: Crew }>('/api/crew/feed', { body: { kind: 'announce', text: post } }); setPost(''); return r; })} /> : null}
        </View>
        {crew.feed.map(f => (
          <View key={f.id} style={{ paddingTop: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Txt v="sub">{f.kind === 'announce' ? '📣 ' : f.kind === 'kudos' ? '💛 ' : ''}{f.kind === 'kudos' && f.name ? `${f.name}: ` : ''}{f.text}</Txt>
            <Txt v="mono" color={K.ink3} upper>{f.at} UTC</Txt>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }} onPress={() => router.push('/family')} label="Family">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Users size={18} color={K.copper} /><View style={{ flex: 1 }}><Txt v="subM">Family and friends</Txt><Txt v="caption" color={K.ink2}>Add someone, send them a link, call them</Txt></View></View>
      </Card>
      <View style={{ marginTop: 14 }}><Button small kind="ghost" title="Leave this crew" onPress={() => setSheet('leave')} /></View>

      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} kicker="Anonymous" title="Raise a concern">
        <Txt v="caption" color={K.ink2}>Only flight surgeons read this. Not your crew, not the person. Your name is never shown. With very small crews, details you write may still give you away.</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{crew.members.filter(m => !m.you).map(m => <Chip key={m.id} label={m.name.split(' ')[0]} on={about === m.id} onPress={() => setAbout(m.id)} />)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{CATS.map(([k, l]) => <Chip key={k} label={l} on={cat === k} onPress={() => setCat(k)} />)}</View>
        <Field label="What did you notice?" value={msg} onChange={setMsg} keyboard="default" multiline placeholder="Has barely slept this week and skips meals." />
        <View style={{ marginTop: 12 }}><Button title="Send anonymously" disabled={!about || msg.trim().length < 5} loading={busy} onPress={async () => { setBusy(true); try { await api('/api/crew/report', { body: { aboutId: about, category: cat, message: msg } }); toast('Sent to the flight surgeons'); setMsg(''); setSheet(null); } catch (e: any) { toast(e.message); } finally { setBusy(false); } }} /></View>
        <Notice tone="flag" title="In an emergency, do not use this" body="Call a flight surgeon or your crew mate now with the Call buttons." />
      </Sheet>
      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} kicker="Crew" title="Leave this crew?">
        <Txt v="sub" color={K.ink2}>You will stop seeing the shared mission and crew alerts.</Txt>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}><Button kind="secondary" title="Stay" style={{ flex: 1 }} onPress={() => setSheet(null)} /><Button title="Leave" style={{ flex: 1 }} onPress={async () => { await api('/api/crew/leave', { body: {} }).catch(() => {}); setSheet(null); setCrew(null); }} /></View>
      </Sheet>
      {err ? <Txt v="caption" color={K.flag} style={{ marginTop: 10 }}>{err}</Txt> : null}
    </Page>
  );
}
