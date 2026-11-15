import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Tag, toast } from '@/kit/ui';
import { api, API_URL, getToken } from '@/api';
import { rtcSupported, watch } from '@/data/rtcClient';
import type { ViewStats } from '@/data/rtcClient';

type St = { live: boolean; viewing: boolean };
export const copyText = (t: string) => { try { (navigator as any).clipboard?.writeText(t); toast('Link copied'); } catch { toast(t); } };

/** Flight surgeon: live view of the astronaut, filmed by the camera station (a phone or laptop opened at /camera). */
export function CamViewer({ id, name }: { id: string | number; name: string }) {
  const [st, setSt] = useState<St | null>(null);
  const [tick, setTick] = useState(0);
  const [bearer, setBearer] = useState<string | null>(null);
  const load = useCallback(() => api<St>(`/api/admin/crew/${id}/cam`).then(setSt).catch(() => {}), [id]);
  useEffect(() => { load(); const t = setInterval(() => { load(); setTick(x => x + 1); }, 1200); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (Platform.OS !== 'web') getToken().then(setBearer); }, []);
  const [rs, setRs] = useState<'connecting' | 'live' | 'waiting' | 'failed'>('connecting');
  const [stats, setStats] = useState<ViewStats | null>(null);
  const vid = useRef<any>(null);
  const web = Platform.OS === 'web' && rtcSupported();
  useEffect(() => {
    if (!web) return;
    return watch(id, s => { if (vid.current) vid.current.srcObject = s; if (!s) setStats(null); }, setRs, setStats);
  }, [id, web]);
  const rtcLive = web && rs === 'live';
  const first = name.split(' ')[0];
  const station = Platform.OS === 'web' && typeof location !== 'undefined' ? `${location.origin}/camera` : '/camera';

  return (
    <Card style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kicker>Live camera</Kicker>
        <Tag label={rtcLive ? 'Live · HD' : st?.live ? 'Live · backup' : 'Not filming'} tone={rtcLive || st?.live ? 'ok' : 'none'} />
      </View>
      <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1C120D', marginTop: 10, alignItems: 'center', justifyContent: 'center' }}>
        {web ? React.createElement('video', { ref: vid, autoPlay: true, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', display: rtcLive ? 'block' : 'none' } }) : null}
        {rtcLive ? null : st?.live
          ? <Image source={{ uri: `${API_URL}/api/admin/crew/${id}/cam/frame.jpg?t=${tick}`, headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel={`Live camera of ${name}`} />
          : <Txt v="sub" color="#A8958B" center style={{ padding: 16 }}>Nobody is filming {first} right now.</Txt>}
      </View>
      {rtcLive ? <Txt v="mono" color={K.ink3} style={{ marginTop: 6 }}>{stats ? `${stats.width}×${stats.height} · ${stats.fps} fps · ${(stats.kbps / 1000).toFixed(1)} Mbps` : 'Connecting…'} · peer to peer</Txt> : st?.live ? <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>{rs === 'failed' ? 'Live video could not connect; showing a still frame every second or two.' : 'Starting live video… showing stills meanwhile.'}</Txt> : null}
      <Kicker color={K.ink2} style={{ marginTop: 14 }}>How to film {first}</Kicker>
      <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Open the camera station on a phone or laptop, choose {first} from the list, and the camera starts. Nothing is recorded: the video streams directly to your browser.</Txt>
      <Txt v="mono" color={K.ink} selectable style={{ marginTop: 6 }}>{station}</Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Button small kind="secondary" title="Copy station link" onPress={() => copyText(station)} /></View>
    </Card>
  );
}
