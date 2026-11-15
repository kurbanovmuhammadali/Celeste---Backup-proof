import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Circle, Line } from 'react-native-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Watch } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt, useLayout } from '@/kit/core';
import { Button, Card, Chip, IconBubble, Notice, Tag, toast } from '@/kit/ui';
import { uid, dayKey, setStore, useStore } from '@/data/store';
import { CONNECTIONS, EXERCISES, createCounter, cycle, syntheticPose, update } from '@/data/pose';
import type { Counter, ExerciseKey, Lm } from '@/data/pose';
import { useApi } from '@/useApi';
import { loadPose } from '@/data/poseLoader';
import { cameraAvailable, cameraHelp } from '@/data/cameraSupport';

type Mode = 'idle' | 'live' | 'demo';
const LABEL = Object.fromEntries(EXERCISES.map(e => [e.key, e.label])) as Record<ExerciseKey, string>;
const web = Platform.OS === 'web';

function Skeleton({ lm }: { lm: Lm[] | null }) {
  if (!lm) return null;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {CONNECTIONS.map(([a, b], i) => <Line key={i} x1={lm[a].x} y1={lm[a].y} x2={lm[b].x} y2={lm[b].y} stroke="#FFD2B8" strokeWidth={0.012} strokeLinecap="round" />)}
      {[0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map(i => <Circle key={i} cx={lm[i].x} cy={lm[i].y} r={0.014} fill="#B8693F" stroke="#fff" strokeWidth={0.004} />)}
    </Svg>
  );
}

/** Camera tab: showcase of camera-based exercise tracking (demo), with a no-camera demo mode and the wearable status. */
export default function CameraTracker() {
  const { wide } = useLayout();
  const workouts = useStore(s => s.workouts);
  const { data: integ } = useApi<{ providers: { key: string; status: string; lastSync: string | null }[] }>('/api/integrations');
  const [ex, setEx] = useState<ExerciseKey>('pushup');
  const [mode, setMode] = useState<Mode>('idle');
  const [counter, setCounter] = useState<Counter>(createCounter('pushup'));
  const [pose, setPose] = useState<Lm[] | null>(null);
  const [secs, setSecs] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [perm, askPerm] = useCameraPermissions();
  const videoRef = useRef<any>(null);
  const streamRef = useRef<any>(null);
  const lmkRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const secRef = useRef<any>(null);
  const demoRef = useRef<any>(null);
  const cRef = useRef<Counter>(counter);
  const frame = useRef(0);
  const t0 = useRef(0);

  const stopLoops = useCallback(() => {
    cancelAnimationFrame(rafRef.current); clearInterval(secRef.current); clearInterval(demoRef.current);
    streamRef.current?.getTracks?.().forEach((t: any) => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(() => stopLoops, [stopLoops]);

  const reset = (e: ExerciseKey) => { cRef.current = createCounter(e); setCounter(cRef.current); setPose(null); setSecs(0); frame.current = 0; };
  const begin = (m: Mode) => {
    reset(ex); setMode(m); t0.current = performance.now();
    secRef.current = setInterval(() => setSecs(Math.round((performance.now() - t0.current) / 1000)), 1000);
  };
  const push = (lm: Lm[] | null, world?: Lm[] | null) => { cRef.current = update(cRef.current, lm, performance.now(), world); if (++frame.current % 2 === 0) { setPose(lm); setCounter(cRef.current); } };

  const startDemo = () => {
    stopLoops(); begin('demo');
    demoRef.current = setInterval(() => push(syntheticPose(ex, cycle((performance.now() - t0.current) / 1000))), 33);
  };
  const startLive = async () => {
    stopLoops();
    if (!cameraAvailable()) { setStatus(cameraHelp()); return; }
    setStatus('Starting the camera…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      streamRef.current = stream; const v = videoRef.current; v.srcObject = stream; await v.play();
      setStatus(ex === 'squat' ? 'Loading the pose model…' : 'Loading the high-accuracy pose model (a few seconds the first time)…');
      lmkRef.current = await loadPose(ex === 'squat' ? 'full' : 'heavy'); // push-ups and pull-ups use the most accurate bundled model
      setStatus(null); begin('live');
      const loop = () => {
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) { const r = lmkRef.current.detectForVideo(vid, performance.now()); push(r.landmarks?.[0] ?? null, r.worldLandmarks?.[0] ?? null); }
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e: any) {
      stopLoops(); setMode('idle');
      setStatus(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it in the browser, or try the demo.' : e?.name === 'NotFoundError' ? 'No camera was found on this device. Try the demo.' : `Could not start the camera: ${e?.message ?? e}. Try the demo.`);
    }
  };
  const startNative = async () => { if (!perm?.granted) { const r = await askPerm(); if (!r.granted) return setStatus('Camera permission was denied.'); } stopLoops(); begin('live'); };

  const stop = (save: boolean) => {
    stopLoops();
    const reps = cRef.current.reps, seconds = Math.max(1, Math.round((performance.now() - t0.current) / 1000));
    if (save && reps > 0) {
      setStore(s => ({ ...s, workouts: [{ id: uid(), at: Date.now(), exercise: ex, reps, seconds, source: (mode === 'demo' ? 'demo' : web ? 'camera' : 'manual') as 'camera' | 'demo' | 'manual' }, ...s.workouts].slice(0, 200) }));
      toast(`Saved ${reps} ${LABEL[ex].toLowerCase()}`);
    }
    setMode('idle'); reset(ex);
  };
  const adjust = (d: number) => { cRef.current = { ...cRef.current, reps: Math.max(0, cRef.current.reps + d) }; setCounter(cRef.current); };
  const pick = (e: ExerciseKey) => { if (mode !== 'idle') return; setEx(e); reset(e); };

  const today = workouts.filter(w => dayKey(0) === new Date(w.at).toISOString().slice(0, 10));
  const total = (k: ExerciseKey) => today.filter(w => w.exercise === k).reduce((a, w) => a + w.reps, 0);
  const whoop = integ?.providers.find(p => p.key === 'whoop'), demoP = integ?.providers.find(p => p.key === 'demo');
  const wState = whoop?.status === 'connected' ? 'connected' : demoP?.status === 'connected' ? 'demo' : 'missing';
  const running = mode !== 'idle';

  return (
    <View>
      <Kicker>Camera tracker (demo)</Kicker>
      <Txt v="sub" color={K.ink2} style={{ marginTop: 4 }}>A phone camera stands in for the exercise devices in this prototype. Count push-ups, pull-ups and squats.</Txt>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        {EXERCISES.map(e => <Chip key={e.key} label={e.label} on={ex === e.key} onPress={() => pick(e.key)} />)}
      </View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>{EXERCISES.find(e => e.key === ex)?.hint}</Txt>

      <View style={{ marginTop: 12, flexDirection: wide ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1.3 }}>
          <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 22, overflow: 'hidden', backgroundColor: '#1C120D' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: [{ scaleX: mode === 'live' && web ? -1 : 1 }] }}>
              {web ? React.createElement('video', { ref: videoRef, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', display: mode === 'live' ? 'block' : 'none' } }) : null}
              {!web && mode === 'live' ? <CameraView style={{ flex: 1 }} facing="front" /> : null}
              <Skeleton lm={pose} />
            </View>
            {mode === 'idle' ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><Txt v="sub" color="#F3D9C6" center>{status ?? 'Start the camera, or try the demo figure.'}</Txt></View> : null}
            {mode === 'demo' ? <View style={{ position: 'absolute', top: 10, left: 10 }}><Tag label="Demo figure" dark /></View> : null}
          </View>
          {status && mode !== 'idle' ? <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>{status}</Txt> : null}
        </View>

        <View style={{ flex: 1 }}>
          <Card>
            <Kicker>{LABEL[ex]}</Kicker>
            <Txt v="hero" tabular style={{ fontSize: 64, lineHeight: 68, marginTop: 4 }}>{counter.reps}</Txt>
            <Txt v="sub" color={K.ink2}>{running ? counter.hint : 'reps'}</Txt>
            <Txt v="mono" color={K.ink3} upper style={{ marginTop: 6 }}>{running ? `${secs}s · ${counter.phase}${counter.value != null ? ` · ${Math.round(counter.value * 100) / 100}` : ''}` : 'Ready'}</Txt>
            {mode === 'live' && !web ? <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>Pose counting runs in the web version. Here the camera is a preview: count with the buttons.</Txt> : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              {!running ? <>
                <View style={{ flex: 1 }}><Button small title="Start camera" onPress={web ? startLive : startNative} /></View>
                <View style={{ flex: 1 }}><Button small kind="secondary" title="Demo" onPress={startDemo} /></View>
              </> : <>
                <View style={{ flex: 1 }}><Button small title="Finish & save" onPress={() => stop(true)} /></View>
                <Button small kind="secondary" title="Cancel" onPress={() => stop(false)} />
              </>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}><Button small kind="ghost" title="− 1" onPress={() => adjust(-1)} disabled={!running} /></View>
              <View style={{ flex: 1 }}><Button small kind="ghost" title="+ 1" onPress={() => adjust(1)} disabled={!running} /></View>
            </View>
          </Card>
        </View>
      </View>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Today</Kicker>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          {EXERCISES.map(e => <View key={e.key}><Txt v="caption" color={K.ink2}>{e.label}</Txt><Txt v="headline" tabular>{total(e.key)}</Txt></View>)}
        </View>
        {workouts.slice(0, 5).map(w => (
          <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Txt v="sub">{LABEL[w.exercise]} · {w.reps} reps · {w.seconds}s</Txt>
            <Txt v="mono" color={K.ink3} upper>{w.source} · {new Date(w.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Txt>
          </View>
        ))}
      </Card>

      <Card style={{ marginTop: 12 }} onPress={() => router.push('/integrations')} label="Wearable connection">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBubble icon={Watch} size={36} />
          <View style={{ flex: 1 }}>
            <Txt v="subM">WHOOP band</Txt>
            <Txt v="caption" color={K.ink2}>{wState === 'connected' ? `Connected${whoop?.lastSync ? ` · last sync ${whoop.lastSync} UTC` : ''}` : wState === 'demo' ? 'Demo dataset (WHOOP is not connected)' : 'Not connected'}</Txt>
          </View>
          <Tag label={wState === 'connected' ? 'Connected' : wState === 'demo' ? 'Demo' : 'Connect'} tone={wState === 'connected' ? 'ok' : wState === 'demo' ? 'watch' : 'none'} />
        </View>
        <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>WHOOP shares recovery, sleep, HRV and strain after your session. It does not stream live heart rate to apps, so rep counts come from the camera and strain arrives later from WHOOP.</Txt>
      </Card>
      <View style={{ marginTop: 12 }}><Notice tone="watch" title="Video stays on your device" body="Camera frames are analysed in the browser and are never uploaded. Only the rep counts you save are kept." /></View>
    </View>
  );
}
