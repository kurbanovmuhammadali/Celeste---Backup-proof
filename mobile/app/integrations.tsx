/**
 * WHOOP connection — a clear step-by-step flow instead of a grid of cards:
 *   1 Have the WHOOP app set up · 2 Tap "Connect WHOOP" · 3 Sign in on WHOOP's own page · 4 Approve read-only access
 *   · 5 Back in Celeste the first sync runs. The current step lights up; when connected: Sync now / Disconnect.
 * Other sources (demo dataset, Apple Health, dosimeter, labs) are listed compactly underneath with their status.
 */
import React, { useEffect, useState } from 'react';
import { setStore } from '@/data/store';
import { Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Check, Watch, Database, Smartphone, FlaskConical, Radiation, Shirt, ShieldCheck } from 'lucide-react-native';
import { api } from '@/api';
import { useApi } from '@/useApi';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Dot, IconBubble, Notice, PageHead, Skeleton, TopBar } from '@/kit/ui';
import { Cols, Page } from '@/kit/page';

type P = { key: string; name: string; kind: string; status: string; lastSync: string | null; available: boolean; metrics: string[]; note?: string };
const ICON: Record<string, any> = { whoop: Watch, demo: Database, healthkit: Smartphone, 'nasa-lab': FlaskConical, dosimeter: Radiation, astroskin: Shirt };
const STATUS: Record<string, [string, string]> = { connected: ['Connected', 'ok'], disconnected: ['Not connected', 'none'], planned: ['Planned', 'none'], ready: ['API ready', 'watch'] };

const STEPS = [
  ['Have WHOOP ready', 'Your strap is paired in the WHOOP app and has at least one night of data.'],
  ['Tap “Connect WHOOP”', 'Celeste opens WHOOP’s own sign-in page — never a copy of it.'],
  ['Sign in on WHOOP', 'Use your WHOOP email and password there. Celeste never sees your password.'],
  ['Approve read-only access', 'Recovery, sleep, cycles, workouts and body measurements. Nothing is written back.'],
  ['Back in Celeste', 'The first sync runs automatically; every value is labelled “WHOOP” with its time.'],
];

function Step({ n, title, sub, state, last }: { n: number; title: string; sub: string; state: 'done' | 'now' | 'next'; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'done' ? K.ok : state === 'now' ? K.copper : K.cardSunk, borderWidth: state === 'next' ? 1 : 0, borderColor: K.hair2 }}>
          {state === 'done' ? <Check size={14} color="#fff" strokeWidth={3} /> : <Txt v="subM" color={state === 'now' ? '#fff' : K.ink2}>{n}</Txt>}
        </View>
        {!last ? <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: state === 'done' ? K.ok : K.hair2, marginVertical: 4, borderRadius: 1 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
        <Txt v="subM" color={state === 'next' ? K.ink2 : K.ink}>{title}</Txt>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 2 }}>{sub}</Txt>
      </View>
    </View>
  );
}

export default function Integrations() {
  const q = useLocalSearchParams<{ whoop?: string; imported?: string; reason?: string }>();
  const { data, reload } = useApi<{ providers: P[] }>('/api/integrations');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'flag' | 'watch'; text: string } | null>(
    q.whoop === 'connected' ? (q.reason ? { tone: 'watch', text: `WHOOP is connected, but the first import failed: ${q.reason}. Press Sync now.` } : { tone: Number(q.imported) > 0 ? 'ok' : 'watch', text: Number(q.imported) > 0 ? `WHOOP connected. Imported ${q.imported} values.` : 'WHOOP connected, but it has no scored data yet. Press Sync now in a minute.' }) : q.whoop ? { tone: 'flag', text: 'WHOOP connection was not completed. Try again from step 2.' } : null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (q.whoop === 'connected') setStore(s => ({ ...s, dataMode: 'whoop' })); }, [q.whoop]); // connecting WHOOP switches the app from hand-entry to WHOOP data
  const run = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e: any) { setMsg({ tone: 'flag', text: e.message }); } finally { setBusy(null); reload(); } };
  const connectWhoop = () => run('whoop', async () => {
    const { url } = await api<{ url: string }>('/api/integrations/whoop/start', { body: { platform: Platform.OS === 'web' ? 'web' : 'native' } });
    if (Platform.OS === 'web') { window.location.href = url; return; }
    const r = await WebBrowser.openAuthSessionAsync(url, Linking.createURL('integrations'));
    if (r.type === 'success') setMsg({ tone: 'ok', text: 'WHOOP connected and synced.' });
  });
  const syncWhoop = () => run('whoop', async () => {
    const r = await api<{ imported: number; recoveries: number; recoveriesScored: number; calibrating: number; sleeps: number; sleepsScored: number }>('/api/integrations/whoop/sync', { method: 'POST' });
    setStore(s => ({ ...s, dataMode: 'whoop' }));
    if (r.imported > 0) setMsg({ tone: 'ok', text: `Imported ${r.imported} WHOOP values.` });
    else setMsg({ tone: 'watch', text: r.recoveries + r.sleeps === 0 ? 'WHOOP sent nothing for the last 30 days. Wear the strap and sync in the WHOOP app first.' : r.calibrating ? 'WHOOP is still calibrating your recovery (first days of wear). Sleep and recovery appear once WHOOP scores them.' : 'WHOOP has records but none are scored yet. Try again after you wake up and WHOOP syncs.' });
  });
  const disconnectWhoop = () => run('whoop', async () => { await api('/api/integrations/whoop', { method: 'DELETE' }); setMsg({ tone: 'watch', text: 'WHOOP disconnected and access revoked.' }); });
  const demo = (on: boolean) => run('demo', async () => { await api('/api/integrations/demo', { method: on ? 'POST' : 'DELETE' }); setMsg({ tone: on ? 'ok' : 'watch', text: on ? 'Demo dataset reloaded (30 days).' : 'Demo data removed. Only your real data remains.' }); });

  const whoop = data?.providers.find(p => p.key === 'whoop');
  const connected = whoop?.status === 'connected';
  const available = whoop?.available !== false;
  const others = data?.providers.filter(p => p.key !== 'whoop' && p.key !== 'healthkit') ?? []; // HMSC: WHOOP is the only wearable

  const steps = (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: K.ink, alignItems: 'center', justifyContent: 'center' }}><Watch size={20} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Txt v="headline">WHOOP</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}><Dot tone={connected ? 'ok' : 'none'} size={6} /><Txt v="caption" color={K.ink2}>{connected ? `Connected${whoop?.lastSync ? ' · last sync ' + new Date(whoop.lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : ''}` : 'Not connected'}</Txt></View>
        </View>
      </View>
      {STEPS.map(([t, s], i) => <Step key={t} n={i + 1} title={t} sub={s} last={i === STEPS.length - 1} state={connected ? 'done' : i === 0 ? 'done' : i === 1 ? 'now' : 'next'} />)}
      <View style={{ marginTop: 16, gap: 8 }}>
        {connected ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Sync now" loading={busy === 'whoop'} onPress={syncWhoop} style={{ flex: 1 }} />
            <Button title="Disconnect" kind="secondary" onPress={disconnectWhoop} style={{ flex: 1 }} />
          </View>
        ) : <Button title="Connect WHOOP" icon={Watch} loading={busy === 'whoop'} disabled={!available} onPress={connectWhoop} />}
        {!available && !connected ? <Txt v="caption" color={K.ink3} center>WHOOP sign-in isn’t configured on this server yet — the demo dataset below keeps everything working.</Txt> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, padding: 10, borderRadius: 12, backgroundColor: K.cardSunk }}>
        <ShieldCheck size={16} color={K.copper} />
        <Txt v="caption" color={K.ink2} style={{ flex: 1 }}>Read-only, revocable any time here or in the WHOOP app. Values are compared only with your own WHOOP baseline.</Txt>
      </View>
    </Card>
  );

  const list = (
    <View>
      <Kicker color={K.ink2} style={{ marginBottom: 8 }}>Other sources</Kicker>
      <Card style={{ paddingVertical: 4 }}>
        {others.map((p, i) => {
          const [label, tone] = STATUS[p.status] ?? [p.status, 'none'];
          return (
            <View key={p.key} style={{ paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: K.hair }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <IconBubble icon={ICON[p.key] ?? Database} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Txt v="subM" numberOfLines={1}>{p.name}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot tone={tone} size={6} /><Txt v="caption" color={K.ink2}>{label} · {p.kind}</Txt></View>
                </View>
                {p.key === 'demo' ? <Button small kind="secondary" title={p.status === 'connected' ? 'Reload' : 'Load'} loading={busy === 'demo'} onPress={() => demo(true)} /> : null}
              </View>
              {p.key === 'demo' && p.status === 'connected' ? <Txt v="caption" color={K.copperInk} style={{ marginTop: 6, marginLeft: 46 }} onPress={() => demo(false)}>Remove demo data</Txt> : null}
            </View>
          );
        })}
      </Card>
    </View>
  );

  return (
    <Page title="Connect WHOOP" maxWidth={980} header={<TopBar title="Connect WHOOP" />}>
      <PageHead kicker="Connected data" title="Connect WHOOP" sub="Five short steps. Sign-in happens on WHOOP, not in Celeste." style={{ marginTop: 6 }} />
      {msg ? <View style={{ marginTop: 12 }}><Notice tone={msg.tone} title={msg.text} /></View> : null}
      {!data ? <View style={{ marginTop: 14, gap: 10 }}><Skeleton h={360} r={20} /><Skeleton h={200} r={20} /></View> : (
        <Cols ratio={[1.1, 1]} gap={20} style={{ marginTop: 14 }}>{steps}<View style={{ marginTop: 14 }}>{list}</View></Cols>
      )}
    </Page>
  );
}
