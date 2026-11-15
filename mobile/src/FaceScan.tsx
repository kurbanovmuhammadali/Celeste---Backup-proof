/**
 * Face scan — enrols the crew member's face so camera tools (form check) can tell crewmates apart on a busy
 * spacecraft. Three guided poses (straight · slightly left · slightly right): an oval guide, a ring that fills
 * while you hold still, a pop when each pose is captured. Samples are small grey thumbnails kept only on this
 * device; the face itself is turned into 128 numbers by the bundled face-api models (server: face.js). Web uses the browser camera; the iPhone build needs expo-camera (not installed yet) → "do it later".
 * Matching runs on the device in the camera tools; nothing is uploaded.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { Check, ScanFace } from 'lucide-react-native';
import { A } from './theme';
import { T } from './ui';
import { native } from './motion';
import { setStore, useStore } from './data/store';
import { seeFaces } from './data/face';
import { api } from './api';

const POSES = ['Look straight at the camera', 'Turn your head slightly to one side', 'Now slightly to the other side'];
const web = Platform.OS === 'web';

export function useFaceEnrolled() { return useStore(s => !!s.face); }

export default function FaceScan({ onDone, dark }: { onDone: () => void; dark?: boolean }) {
  const enrolled = useStore(s => s.face);
  const [on, setOn] = useState(false);
  const [pose, setPose] = useState(0);
  const [hold, setHold] = useState(0); // 0..1 while holding still
  const [err, setErr] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [done, setDone] = useState(false);
  const video = useRef<any>(null);
  const samples = useRef<string[]>([]);
  const pop = useRef(new Animated.Value(1)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const ink = dark ? '#fff' : A.ink, ink2 = dark ? 'rgba(255,255,255,0.75)' : A.ink2;

  useEffect(() => { const l = Animated.loop(Animated.timing(scan, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: native })); l.start(); return () => l.stop(); }, []);

  useEffect(() => {
    if (!on || !web) return;
    let stream: MediaStream | null = null, timer: any, busy = false, p = 0, caps = 0, hold = 0, side = 0, stopped = false;
    const descs: number[][] = [];
    const cv = document.createElement('canvas'); cv.width = 48; cv.height = 48;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 480, height: 480 }, audio: false }).then(async s => {
      stream = s; const v = video.current; if (!v) return; v.srcObject = s; await v.play();
      await seeFaces(v, 1).catch(() => []); // warm up the bundled face models
      timer = setInterval(async () => {
        if (busy || stopped || v.readyState < 2) return; busy = true;
        try {
          const f = (await seeFaces(v, 1))[0];
          const okPose = !!f && f.score > 0.6 && f.size > 0.2 && (p === 0 ? Math.abs(f.yaw) < 0.09 : p === 1 ? Math.abs(f.yaw) > 0.1 && (side = Math.sign(f.yaw)) !== 0 : Math.abs(f.yaw) > 0.1 && Math.sign(f.yaw) === -side);
          hold = okPose ? Math.min(1, hold + 0.34) : Math.max(0, hold - 0.2); setHold(hold);
          if (okPose && hold >= 1) { // pose captured: face descriptor + grey thumbnail (preview)
            descs.push(f!.descriptor);
            const g = cv.getContext('2d')!; g.filter = 'grayscale(1)'; const sz = Math.min(v.videoWidth, v.videoHeight); g.drawImage(v, (v.videoWidth - sz) / 2, (v.videoHeight - sz) / 2, sz, sz, 0, 0, 48, 48);
            samples.current.push(cv.toDataURL('image/jpeg', 0.6));
            caps += 1; hold = 0.4;
            pop.setValue(1.25); Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 16, bounciness: 14 }).start();
            if (caps >= 2) { caps = 0; p += 1; setPose(p); hold = 0; }
            if (p >= POSES.length) {
              stopped = true; clearInterval(timer); stream?.getTracks().forEach(t => t.stop());
              try { await api('/api/me/face', { method: 'PUT', body: { descriptors: descs.slice(0, 10), consent: true } }); }
              catch (e: any) { setErr(e?.message ?? 'Could not save the face on the server.'); }
              setStore(st => ({ ...st, face: { enrolledAt: Date.now(), samples: samples.current } }));
              setDone(true);
            }
          }
        } catch { /* a bad frame */ } finally { busy = false; }
      }, 350);
    }).catch(() => setErr('Camera permission was not given. You can do this later in Profile.'));
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, [on]);

  const size = 230, r = size / 2 - 6, C = 2 * Math.PI * r;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
        <View style={{ position: 'absolute', width: size - 26, height: size - 26, borderRadius: size, overflow: 'hidden', backgroundColor: dark ? 'rgba(255,255,255,0.08)' : '#EFE2D9', alignItems: 'center', justifyContent: 'center' }}>
          {on && web && !done ? React.createElement('video', { ref: video, muted: true, playsInline: true, style: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' } } as any)
            : done || enrolled ? <Animated.View style={{ transform: [{ scale: pop }] }}><View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: A.copper, alignItems: 'center', justifyContent: 'center' }}><Check size={40} color="#fff" strokeWidth={3} /></View></Animated.View>
            : <ScanFace size={70} color={dark ? 'rgba(255,255,255,0.6)' : A.copperSoft} strokeWidth={1.2} />}
          {on && !done ? (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: 'rgba(243,180,141,0.9)', transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-(size - 26) / 2.4, (size - 26) / 2.4] }) }] }} />
          ) : null}
        </View>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? 'rgba(255,255,255,0.15)' : A.sand2} strokeWidth={6} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={A.copper} strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray={`${C} ${C}`}
            strokeDashoffset={C * (1 - Math.min(1, (pose + (done ? 0 : hold)) / POSES.length))} />
        </Svg>
        {on && !done ? <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none"><Ellipse cx={size / 2} cy={size / 2} rx={size * 0.27} ry={size * 0.35} stroke="rgba(255,255,255,0.85)" strokeWidth={2} strokeDasharray="6 6" fill="none" /></Svg> : null}
      </View>
      <T size={18} weight="sb" color={ink} center style={{ marginTop: 18 }}>
        {done ? 'Face saved' : enrolled && !on ? 'Face already enrolled' : on ? POSES[Math.min(pose, POSES.length - 1)] : 'Recognise you among the crew'}
      </T>
      <T size={13.5} color={ink2} center style={{ marginTop: 6, paddingHorizontal: 20, lineHeight: 19 }}>
        {done ? 'You can now sign in with your face, and the camera station will recognise you.' : on ? `Hold still · pose ${Math.min(pose + 1, POSES.length)} of ${POSES.length}` : 'On a crowded spacecraft the camera form check needs to know whose reps it is counting. Three quick poses — stored only on this device.'}
      </T>
      {!done && web && !on ? <T size={13} color={ink2} center style={{ marginTop: 14, paddingHorizontal: 12, lineHeight: 18 }} onPress={() => setAgree(a => !a)}>{agree ? '☑' : '☐'} I agree that my face is used to recognise me. Only 128 numbers describing it are stored (no photo) and I can delete them any time in Profile.</T> : null}
      {err ? <T size={13} color="#C0472F" center style={{ marginTop: 10 }}>{err}</T> : null}
      {!web && !done ? <T size={12.5} color={ink2} center style={{ marginTop: 10 }}>Face scan runs in the web demo for now — the iPhone build needs the camera module. You can do it later in Profile.</T> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        {!done && web && !on ? <Btn title={enrolled ? 'Scan again' : 'Start face scan'} onPress={() => { if (!agree) { setErr('Please tick the agreement first.'); return; } samples.current = []; setPose(0); setErr(null); setOn(true); }} /> : null}
        {done ? <Btn title="Continue" onPress={onDone} /> : <Btn title={enrolled ? 'Done' : 'Do it later'} ghost onPress={onDone} />}
      </View>
    </View>
  );
}

function Btn({ title, onPress, ghost }: { title: string; onPress: () => void; ghost?: boolean }) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <T onPress={onPress} onPressIn={() => Animated.spring(s, { toValue: 0.95, useNativeDriver: native, speed: 40, bounciness: 0 }).start()}
        onPressOut={() => Animated.spring(s, { toValue: 1, useNativeDriver: native, speed: 18, bounciness: 10 }).start()}
        size={15} weight="m" color={ghost ? A.copper : '#fff'} accessibilityRole="button"
        style={{ paddingHorizontal: 22, paddingVertical: 14, borderRadius: 26, overflow: 'hidden', backgroundColor: ghost ? 'transparent' : A.copper, borderWidth: ghost ? 1.2 : 0, borderColor: A.copperSoft }}>{title}</T>
    </Animated.View>
  );
}
