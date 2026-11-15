import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button } from '@/kit/ui';
import { cameraAvailable, cameraHelp } from '@/data/cameraSupport';
import { faceDistance, seeFaces } from '@/data/face';
import type { Seen } from '@/data/face';

/**
 * Guided face scan.
 *  mode "enroll": 6 samples while you look straight, then slightly left, then slightly right (a richer template matches better).
 *  mode "login":  look at the camera, then turn your head one way and back (a flat photo cannot do that), then one descriptor is returned.
 * Video never leaves the device.
 */
export default function FaceScan({ mode, onDone, onCancel }: { mode: 'enroll' | 'login'; onDone: (descriptors: number[][]) => void; onCancel?: () => void }) {
  const video = useRef<any>(null), stream = useRef<MediaStream | null>(null), timer = useRef<any>(null);
  const [msg, setMsg] = useState('Starting the camera…');
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const st = useRef({ phase: 0, got: [] as number[][], turned: false, ok: 0, started: Date.now(), done: false });

  const stop = useCallback(() => { clearInterval(timer.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; }, []);
  useEffect(() => stop, [stop]);

  const PHASES = mode === 'enroll'
    ? [{ say: 'Look straight at the camera', ok: (s: Seen) => Math.abs(s.yaw) < 0.09 }, { say: 'Turn your head a little to one side', ok: (s: Seen) => s.yaw < -0.1 }, { say: 'Now a little to the other side', ok: (s: Seen) => s.yaw > 0.1 }]
    : [];
  const need = mode === 'enroll' ? 6 : 1;

  const tick = useCallback(async () => {
    const v = video.current, S = st.current; if (!v || v.readyState < 2 || S.done) return;
    const faces = await seeFaces(v, 1).catch(() => []); const f = faces[0];
    if (!f || f.score < 0.6 || f.size < 0.18) { S.ok = 0; setMsg(!f ? 'I cannot see your face. Move into the light.' : f.size < 0.18 ? 'Come a little closer.' : 'Hold still…'); return; }
    if (mode === 'login') {
      if (!S.turned) {
        setMsg('Now slowly turn your head to one side and back'); setProg(0.4);
        if (Math.abs(f.yaw) > 0.16) S.turned = true;
        if (Date.now() - S.started > 12000) { S.started = Date.now(); setMsg('Try again: slowly turn your head and back'); }
      } else if (Math.abs(f.yaw) < 0.07) { S.done = true; setProg(1); setMsg('Got it'); stop(); onDone([f.descriptor]); }
      return;
    }
    const P = PHASES[S.phase]; if (!P) return;
    setMsg(P.say);
    if (!P.ok(f)) return;
    if (S.got.length && S.got.every(d => faceDistance(d, f.descriptor) < 0.02)) return; // an identical frame adds nothing
    S.got.push(f.descriptor); setProg(S.got.length / need);
    if (S.got.length % 2 === 0) S.phase++;
    if (S.got.length >= need) { S.done = true; setMsg('Done'); stop(); onDone(S.got); }
  }, [mode, onDone, stop]);

  const start = useCallback(async () => {
    setErr(null);
    if (Platform.OS !== 'web' || !cameraAvailable()) { setErr(cameraHelp()); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      stream.current = s; video.current.srcObject = s; await video.current.play();
      setMsg('Loading the face models (first time only)…');
      await seeFaces(video.current, 1).catch(() => []);
      st.current = { phase: 0, got: [], turned: false, ok: 0, started: Date.now(), done: false };
      timer.current = setInterval(tick, 350);
    } catch (e: any) { stop(); setErr(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow it and try again.' : `Could not start the camera: ${e?.message ?? e}`); }
  }, [tick, stop]);
  useEffect(() => { start(); }, []);

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: 420, aspectRatio: 4 / 3, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1C120D', borderWidth: 3, borderColor: prog >= 1 ? K.ok : K.copper }}>
        {Platform.OS === 'web' ? React.createElement('video', { ref: video, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' } }) : null}
      </View>
      <View style={{ width: '100%', maxWidth: 420, height: 6, borderRadius: 3, backgroundColor: 'rgba(184,105,63,0.18)', marginTop: 12, overflow: 'hidden' }}><View style={{ width: `${Math.round(prog * 100)}%`, height: 6, backgroundColor: K.copper }} /></View>
      <Txt v="subM" center style={{ marginTop: 12 }}>{err ?? msg}</Txt>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 6, maxWidth: 360 }}>The video stays on this device. Only 128 numbers describing your face are sent, never a photo.</Txt>
      {err ? <View style={{ marginTop: 12 }}><Button small title="Try again" onPress={start} /></View> : null}
      {onCancel ? <View style={{ marginTop: 8 }}><Button small kind="ghost" title="Cancel" onPress={() => { stop(); onCancel(); }} /></View> : null}
    </View>
  );
}
