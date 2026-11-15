import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button } from '@/kit/ui';
import { api } from '@/api';
import { loadPose } from '@/data/poseLoader';
import { cameraAvailable, cameraHelp } from '@/data/cameraSupport';
import { createEating, eatStep } from '@/data/eating';
import type { EatEvent } from '@/data/eating';
import { HD_VIDEO, publish, pubQuery, rtcSupported } from '@/data/rtcClient';

/**
 * Camera capture: opens the camera and sends a still frame about every second for the chosen astronaut, and reports when
 * he has a meal (pose detection runs in this browser; only "a meal happened" is sent). `base` is the API prefix:
 * `/api/cam/<token>` for a private link or `/api/station/<id>` for the camera station. Nothing is recorded on the server.
 */
export default function CaptureView({ base, autoStart, onExit }: { base: string; autoStart?: boolean; onExit?: () => void }) {
  const token = base; // API prefix used by every call below
  const [info, setInfo] = useState<{ name: string; viewing: boolean } | 'bad' | null>(null);
  const [live, setLive] = useState(false);
  const [sent, setSent] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [det, setDet] = useState<'off' | 'loading' | 'on' | 'error'>('off');
  const [bites, setBites] = useState(0);
  const [peers, setPeers] = useState(0);
  const stopPub = useRef<null | (() => void)>(null);
  const [meal, setMeal] = useState<string | null>(null);
  const eat = useRef(createEating()), detTimer = useRef<any>(null);
  const video = useRef<any>(null), canvas = useRef<any>(null), stream = useRef<any>(null), timer = useRef<any>(null), wake = useRef<any>(null), busy = useRef(false);

  const refresh = useCallback(() => api<{ name: string; viewing: boolean }>(`${token}/info`).then(setInfo).catch(() => setInfo('bad')), [token]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!live) return; const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [live, refresh]);

  const halt = useCallback((tell: boolean) => {
    clearInterval(timer.current); clearInterval(detTimer.current); stopPub.current?.(); stopPub.current = null; setPeers(0); eat.current = createEating(); setDet('off'); setBites(0);
    stream.current?.getTracks?.().forEach((t: any) => t.stop()); stream.current = null;
    wake.current?.release?.().catch?.(() => {}); wake.current = null;
    if (video.current) video.current.srcObject = null;
    if (tell) api(`${token}/stop`, { body: {} }).catch(() => {});
    setLive(false);
  }, [token]);
  useEffect(() => () => halt(true), [halt]);

  const send = useCallback(async () => {
    const v = video.current, c = canvas.current;
    if (busy.current || !v || !c || !v.videoWidth) return;
    busy.current = true;
    try {
      const w = Math.min(480, v.videoWidth), h = Math.round((w * v.videoHeight) / v.videoWidth);
      c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h);
      await api(`${token}/frame`, { body: { image: c.toDataURL('image/jpeg', 0.6) } });
      setSent(n => n + 1);
    } catch (e: any) {
      if (e?.status === 404) { halt(false); setInfo('bad'); setErr('This camera link was replaced. Ask for the new one.'); }
    } finally { busy.current = false; }
  }, [token, halt]);

  /** Meal detection: pretrained pose model in this browser; only "a meal happened" is sent, never video. */
  const report = useCallback((ev: NonNullable<EatEvent>) => {
    const d = new Date(ev.start);
    api(`${token}/meal`, { body: { kind: ev.kind, bites: ev.bites, start: ev.start, end: ev.end, localMinutes: d.getHours() * 60 + d.getMinutes() } })
      .then(() => setMeal(ev.kind === 'meal' ? `Meal recognised (${ev.bites}+ bites)` : `Meal finished (${ev.bites} bites)`)).catch(() => {});
  }, [token]);
  const startDetect = useCallback(() => {
    setDet('loading');
    loadPose().then(lmk => {
      setDet('on');
      detTimer.current = setInterval(() => {
        const v = video.current;
        if (!v || v.readyState < 2) return;
        const lm = lmk.detectForVideo(v, performance.now()).landmarks?.[0] ?? null;
        const out = eatStep(eat.current, lm, Date.now());
        eat.current = out.state; setBites(out.state.bites);
        if (out.event) report(out.event);
      }, 220);
    }).catch(() => setDet('error'));
  }, [report]);

  const start = async (face = facing) => {
    setErr(null); halt(false);
    if (!cameraAvailable()) { setErr(cameraHelp()); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: HD_VIDEO(face), audio: false });
      stream.current = s; video.current.srcObject = s; await video.current.play();
      try { wake.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* optional */ }
      setLive(true); setSent(0);
      timer.current = setInterval(send, 2500); // slow JPEG backup + heartbeat; the real video goes over WebRTC
      if (rtcSupported()) stopPub.current = publish(pubQuery(token), () => stream.current, setPeers);
      startDetect();
    } catch (e: any) {
      halt(false);
      setErr(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow the camera for this page and try again.' : e?.name === 'NotFoundError' ? 'No camera found on this device.' : `Could not start the camera: ${e?.message ?? e}`);
    }
  };
  const flip = () => { const f = facing === 'environment' ? 'user' : 'environment'; setFacing(f); if (live) start(f); };

  const started = useRef(false);
  useEffect(() => { if (autoStart && info && info !== 'bad' && !started.current && cameraAvailable()) { started.current = true; start(); } }, [autoStart, info]);

  const secure = cameraAvailable();
  const viewing = info && info !== 'bad' && info.viewing;
  const box = { flex: 1, backgroundColor: '#1C120D', alignItems: 'center' as const, padding: 20, paddingTop: 36 };

  if (Platform.OS !== 'web') return <View style={box}><Txt v="headline" color="#fff" center>Open this link in a phone browser</Txt><Txt v="sub" color="#E3B79E" center style={{ marginTop: 8 }}>The camera page runs in Safari or Chrome.</Txt></View>;
  if (info === 'bad') return <View style={box}><Txt v="title" color="#fff" center>Camera not available</Txt><Txt v="sub" color="#E3B79E" center style={{ marginTop: 8 }}>{err ?? 'This camera link or station is not valid. Ask for the current link.'}</Txt></View>;

  return (
    <View style={box}>
      <Txt v="mono" color="#E3B79E" upper>✦ Celeste · remote camera</Txt>
      <Txt v="title" color="#fff" center style={{ marginTop: 8 }}>{info ? `Filming ${info.name}` : 'Checking the link…'}</Txt>
      <View style={{ width: '100%', maxWidth: 520, aspectRatio: 4 / 3, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000', marginTop: 16, alignItems: 'center', justifyContent: 'center' }}>
        {React.createElement('video', { ref: video, playsInline: true, muted: true, autoPlay: true, style: { width: '100%', height: '100%', objectFit: 'cover', display: live ? 'block' : 'none' } })}
        {!live ? <Txt v="sub" color="#A8958B" center style={{ padding: 16 }}>{secure ? 'Point the camera at the astronaut, then tap Start.' : cameraHelp()}</Txt> : null}
        {React.createElement('canvas', { ref: canvas, style: { display: 'none' } })}
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, width: '100%', maxWidth: 520 }}>
        <View style={{ flex: 1 }}>{live ? <Button kind="secondary" title="Stop camera" onPress={() => halt(true)} /> : <Button title="Start camera" onPress={() => start()} disabled={!info || !secure} />}</View>
        <Button kind="secondary" title="Flip" onPress={flip} />
      </View>
      {onExit ? <View style={{ marginTop: 10, width: '100%', maxWidth: 520 }}><Button kind="light" title="← Choose another astronaut" onPress={() => { halt(true); onExit(); }} /></View> : null}
      {live ? <Txt v="mono" color={viewing ? '#9FD6A8' : '#E3B79E'} upper style={{ marginTop: 12 }}>{viewing || peers ? 'A flight surgeon is watching now' : 'Live · waiting for a viewer'} · HD live video{peers ? ` · ${peers} viewer${peers > 1 ? 's' : ''}` : ''}</Txt> : null}
      {live ? <Txt v="mono" color="#E3B79E" upper style={{ marginTop: 6 }}>{det === 'on' ? `Meal detection on · ${bites} bites seen` : det === 'loading' ? 'Loading meal detection…' : det === 'error' ? 'Meal detection unavailable (needs internet once)' : ''}</Txt> : null}
      {meal ? <Txt v="sub" color="#9FD6A8" center style={{ marginTop: 8 }}>{meal}</Txt> : null}
      {err ? <Txt v="sub" color="#F2A08C" center style={{ marginTop: 10 }}>{err}</Txt> : null}
      <Txt v="caption" color="#A8958B" center style={{ marginTop: 18, maxWidth: 420 }}>Nothing is recorded. The video goes straight to the signed-in flight surgeon's browser; the server never stores it. Stop the camera or close this page any time.</Txt>
    </View>
  );
}
