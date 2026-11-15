import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Button } from '@/kit/ui';
import { api } from '@/api';
import { cameraAvailable, cameraHelp } from '@/data/cameraSupport';
import { loadObjects, loadPose } from '@/data/poseLoader';
import { loadFace, seeFaces } from '@/data/face';
import { HD_VIDEO, publish, pubQuery, rtcSupported } from '@/data/rtcClient';
import { createDetector, detect } from '@/data/incident';
import type { DetectorState, IncidentKind } from '@/data/incident';
import { buildReport, classify, createTimeline, observe, segments } from '@/data/activity';
import type { ActState, Timeline } from '@/data/activity';
import { createEating, eatStep } from '@/data/eating';
import type { EatState } from '@/data/eating';
import { createCounter, update } from '@/data/pose';
import type { Counter, Lm } from '@/data/pose';

type Person = { id: number; name: string; mission: string };
type Track = { key: string; id: number | null; name: string; det: DetectorState; tl: Timeline; eat: EatState; push: Counter; pull: Counter; lastSeen: number; hip: { x: number; t: number } | null; vx: number; exUntil: number; started: number; lastReport: number; incidents: string[]; act: ActState; alert: boolean; bites: number; x: number; y: number };
type FaceId = { box: { x: number; y: number; w: number; h: number }; id: number | null; name: string; at: number; checked: number };
type Pending = { uid: number; key: string; name: string; kind: IncidentKind; confidence: number; evidence: string; sendAt: number };
type Channel = { stop: () => void; lastSeen: number };
const KIND_WORD: Record<IncidentKind, string> = { collapse: 'a collapse', seizure: 'a possible seizure', unresponsive: 'no movement after a fall' };
const iou = (a: FaceId['box'], b: FaceId['box']) => { const x = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), y = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const i = x * y; return i / (a.w * a.h + b.w * b.h - i || 1); };
const GRACE_MS = 8000;

/**
 * Camera station, version 2. One camera, several people:
 *  - recognises each face (open-source face-api models, matched on the server against enrolled crew) and labels the person;
 *  - streams live HD video to the flight surgeon of every recognised astronaut (WebRTC), with a JPEG fallback;
 *  - watches each person's pose with a local model: collapse, shaking and stillness raise an alert after a short confirm window
 *    that every flight surgeon and crew mate receives at once;
 *  - writes an activity report (posture, exercise, meals, objects) made on this device, no cloud AI, no video upload.
 * Nothing is recorded. Needs CAMERA_STATION=on (demo). Not a medical device.
 */
export default function StationView({ crew, onExit }: { crew: Person[]; onExit: () => void }) {
  const video = useRef<any>(null), canvas = useRef<any>(null), stream = useRef<MediaStream | null>(null), wake = useRef<any>(null);
  const tracks = useRef(new Map<string, Track>()), faces = useRef<FaceId[]>([]), channels = useRef(new Map<number, Channel>()), pending = useRef<Pending[]>([]);
  const objects = useRef<Record<string, number>>({}), timers = useRef<any[]>([]), busyFace = useRef(false), busyPose = useRef(false), manual = useRef<number | null>(null);
  const pose = useRef<any>(null), objDet = useRef<any>(null), startedAt = useRef(0);
  const [status, setStatus] = useState('Press start to open the camera.'), [running, setRunning] = useState(false), [err, setErr] = useState<string | null>(null);
  const [ui, setUi] = useState<{ people: { key: string; name: string; state: string; x: number; y: number; alert: boolean }[]; pending: { name: string; what: string; left: number; i: number }[]; viewers: number }>({ people: [], pending: [], viewers: 0 });
  const [pick, setPick] = useState<number | null>(null), [log, setLog] = useState<string[]>([]);
  const note = (t: string) => setLog(l => [`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ${t}`, ...l].slice(0, 6));

  const post = (uid: number, path: string, body: object) => api(`/api/station/${uid}/${path}`, { body }).catch(() => {});
  const channel = (uid: number) => { // make sure the surgeon of this astronaut can watch
    let c = channels.current.get(uid);
    if (!c) { c = { stop: rtcSupported() ? publish(pubQuery(`/api/station/${uid}`), () => stream.current, () => {}) : () => {}, lastSeen: Date.now() }; channels.current.set(uid, c); note(`Live video to ${crew.find(p => p.id === uid)?.name ?? uid}`); }
    c.lastSeen = Date.now();
  };

  const flushReport = useCallback((t: Track, final: boolean) => {
    if (t.id == null) return;
    const now = Date.now(), segs = segments(t.tl, now); if (!segs.length || now - t.started < 20_000) return;
    const r = buildReport({ name: t.name, from: t.started, to: now, segs, reps: { 'push-up': t.push.reps, 'pull-up': t.pull.reps }, bites: t.bites, objects: objects.current, incidents: t.incidents });
    post(t.id, 'activity', { from: t.started, to: now, segments: r.segments.slice(-40), summary: r.summary }); t.lastReport = now;
    if (final) { t.started = now; t.tl = createTimeline(); }
  }, []);

  // ---- face: who is in view?
  const faceTick = useCallback(async () => {
    const v = video.current; if (busyFace.current || !v || v.readyState < 2) return; busyFace.current = true;
    try {
      const seen = await seeFaces(v, 4, 320), now = Date.now(), next: FaceId[] = [];
      for (const f of seen) {
        const old = faces.current.find(o => iou(o.box, f.box) > 0.35);
        let id = old?.id ?? null, name = old?.name ?? 'Unknown', checked = old?.checked ?? 0;
        if (!old || now - checked > (old.id ? 8000 : 2500)) { // ask the server who this is (it compares with the enrolled faces)
          const r = await api<{ id: number | null; name?: string }>('/api/station/identify', { body: { descriptor: f.descriptor } }).catch(() => null);
          if (r) { id = r.id; name = r.name ?? 'Unknown'; checked = now; if (id && !old?.id) note(`Recognised ${name}`); }
        }
        next.push({ box: f.box, id, name, at: now, checked });
      }
      faces.current = next;
    } catch { /* model hiccup */ } finally { busyFace.current = false; }
  }, []);

  // ---- pose: what is each person doing?
  const poseTick = useCallback(() => {
    const v = video.current, P = pose.current; if (busyPose.current || !v || v.readyState < 2 || !P) return; busyPose.current = true;
    try {
      const now = Date.now(), res = P.detectForVideo(v, performance.now()), aspect = v.videoWidth / (v.videoHeight || 1);
      const seenKeys = new Set<string>(); let unk = 0;
      (res.landmarks as Lm[][]).forEach((lm, pi) => {
        const nose = lm[0]; if (!nose) return;
        const face = faces.current.filter(f => now - f.at < 5000).map(f => ({ f, d: Math.hypot(nose.x - (f.box.x + f.box.w / 2), nose.y - (f.box.y + f.box.h / 2)) / f.box.w })).filter(x => x.d < 1.4).sort((a, b) => a.d - b.d)[0]?.f;
        let id = face?.id ?? null, name = face?.name ?? 'Unknown';
        if (id == null && manual.current != null) { id = manual.current; name = crew.find(p => p.id === id)?.name ?? name; }
        const key = id != null ? `a${id}` : `u${unk++}`; seenKeys.add(key);
        let t = tracks.current.get(key);
        if (!t) { t = { key, id, name, det: createDetector(), tl: createTimeline(), eat: createEating(), push: createCounter('pushup'), pull: createCounter('pullup'), lastSeen: now, hip: null, vx: 0, exUntil: 0, started: now, lastReport: now, incidents: [], act: 'standing', alert: false, bites: 0, x: nose.x, y: nose.y }; tracks.current.set(key, t); }
        t.id = id; t.name = name; t.lastSeen = now; t.x = nose.x; t.y = nose.y;
        if (id != null) channel(id);
        const world = (res.worldLandmarks as Lm[][] | undefined)?.[pi] ?? null;
        const hipX = (lm[23].x + lm[24].x) / 2 * aspect; if (t.hip && now - t.hip.t > 0) { const torso = 0.3; t.vx = t.vx * 0.8 + (Math.abs(hipX - t.hip.x) / ((now - t.hip.t) / 1000) / torso) * 0.2; } t.hip = { x: hipX, t: now };
        const a = update(t.push, lm, performance.now(), world, aspect), b = update(t.pull, lm, performance.now(), world, aspect);
        if (a.reps > t.push.reps || b.reps > t.pull.reps) t.exUntil = now + 20_000; t.push = a; t.pull = b;
        const exercising = now < t.exUntil;
        const eat = eatStep(t.eat, lm, now); t.eat = eat.state; t.bites = Math.max(t.bites, eat.state.bites);
        if (eat.event && id != null) post(id, 'meal', { kind: eat.event.kind, bites: eat.event.bites, start: eat.event.start, end: eat.event.end, localMinutes: new Date(eat.event.start).getHours() * 60 + new Date(eat.event.start).getMinutes() });
        t.act = classify(lm, { exercise: exercising ? 'x' : null, eating: eat.state.sessionStart != null && now - eat.state.lastBite < 20_000, hipVx: t.vx, aspect });
        t.tl = observe(t.tl, t.act, now);
        const d = detect(t.det, lm, now, { exercising, aspect }); t.det = d.state;
        for (const e of d.events) {
          if (id == null) { note(`Possible ${KIND_WORD[e.kind]} but the person is not recognised: pick who it is below.`); continue; }
          t.incidents.push(`${e.kind} at ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
          pending.current.push({ uid: id, key, name, kind: e.kind, confidence: e.confidence, evidence: e.evidence, sendAt: now + (e.kind === 'unresponsive' ? 0 : 6000) });
        }
      });
      tracks.current.forEach((t, k) => { if (!seenKeys.has(k)) { t.act = 'absent'; t.tl = observe(t.tl, 'absent', now); } });
    } catch { /* a bad frame */ } finally { busyPose.current = false; }
  }, [crew]);

  // ---- housekeeping: alerts, channels, reports, UI
  const slowTick = useCallback(() => {
    const now = Date.now();
    for (const p of [...pending.current]) if (now >= p.sendAt) { // confirm window over: tell everybody
      pending.current = pending.current.filter(x => x !== p);
      post(p.uid, 'incident', { kind: p.kind, confidence: p.confidence, evidence: p.evidence }); note(`ALERT sent for ${p.name}: ${KIND_WORD[p.kind]}`);
    }
    channels.current.forEach((c, uid) => { if (now - c.lastSeen > 30_000) { c.stop(); post(uid, 'stop', {}); channels.current.delete(uid); } });
    tracks.current.forEach((t, k) => {
      t.alert = pending.current.some(p => p.key === k);
      if (now - t.lastReport > 300_000) flushReport(t, false);
      if (now - t.lastSeen > 600_000) tracks.current.delete(k);
    });
    setUi({
      people: [...tracks.current.values()].filter(t => now - t.lastSeen < GRACE_MS).map(t => ({ key: t.key, name: t.name, state: t.act === 'exercising' ? 'exercising' : t.act, x: t.x, y: t.y, alert: t.alert })),
      pending: pending.current.map((p, i) => ({ name: p.name, what: KIND_WORD[p.kind], left: Math.max(0, Math.ceil((p.sendAt - now) / 1000)), i })), viewers: channels.current.size,
    });
  }, [flushReport]);

  const sendFrames = useCallback(() => {
    const v = video.current, c = canvas.current; if (!v || !c || !v.videoWidth || !channels.current.size) return;
    const w = Math.min(480, v.videoWidth), h = Math.round((w * v.videoHeight) / v.videoWidth); c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h);
    const img = c.toDataURL('image/jpeg', 0.6); channels.current.forEach((_, uid) => post(uid, 'frame', { image: img }));
  }, []);

  const objTick = useCallback(() => {
    const v = video.current; if (!v || v.readyState < 2 || !objDet.current) return;
    try { for (const d of objDet.current.detectForVideo(v, performance.now()).detections ?? []) { const c = d.categories?.[0]; if (c && c.categoryName !== 'person' && c.score > 0.5) objects.current[c.categoryName] = (objects.current[c.categoryName] ?? 0) + 1; } } catch { /* ignore */ }
  }, []);

  const stop = useCallback(() => {
    timers.current.forEach(clearInterval); timers.current = [];
    tracks.current.forEach(t => flushReport(t, true));
    channels.current.forEach((c, uid) => { c.stop(); post(uid, 'stop', {}); }); channels.current.clear();
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; wake.current?.release?.().catch?.(() => {}); wake.current = null;
    if (video.current) video.current.srcObject = null; tracks.current.clear(); faces.current = []; pending.current = []; setRunning(false); setUi({ people: [], pending: [], viewers: 0 });
  }, [flushReport]);
  useEffect(() => () => stop(), [stop]);

  const start = async () => {
    setErr(null);
    if (Platform.OS !== 'web' || !cameraAvailable()) { setErr(cameraHelp()); return; }
    try {
      setStatus('Opening the camera…');
      const s = await navigator.mediaDevices.getUserMedia({ video: HD_VIDEO('user'), audio: false }); stream.current = s; video.current.srcObject = s; await video.current.play();
      try { wake.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* optional */ }
      setStatus('Loading the on-device SI (face, pose, objects)…');
      const [, P, O] = await Promise.all([loadFace(), loadPose('full', 3), loadObjects().catch(() => null)]); pose.current = P; objDet.current = O;
      startedAt.current = Date.now(); setRunning(true); setStatus('Watching');
      timers.current = [setInterval(poseTick, 100), setInterval(faceTick, 700), setInterval(slowTick, 500), setInterval(sendFrames, 2500), setInterval(objTick, 5000)];
    } catch (e: any) { stop(); setErr(e?.name === 'NotAllowedError' ? 'Camera permission was denied.' : `Could not start: ${e?.message ?? e}`); }
  };

  const drill = (uid: number, name: string) => { pending.current.push({ uid, key: `a${uid}`, name, kind: 'collapse', confidence: 0.5, evidence: 'DRILL: test alert sent by hand from the camera station.', sendAt: Date.now() + 3000 }); note(`Drill alert for ${name} in 3 s`); };
  const box = { flex: 1, backgroundColor: '#1C120D', alignItems: 'center' as const, padding: 16, paddingTop: 28 };
  const known = ui.people.filter(p => p.name !== 'Unknown');

  return (
    <View style={box}>
      <Txt v="mono" color="#E3B79E" upper>✦ Celeste · camera station · SI on this device</Txt>
      <View style={{ width: '100%', maxWidth: 760, aspectRatio: 4 / 3, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000', marginTop: 14 }}>
        {React.createElement('video', { ref: video, playsInline: true, muted: true, autoPlay: true, style: { width: '100%', height: '100%', objectFit: 'cover', display: running || stream.current ? 'block' : 'none' } })}
        {React.createElement('canvas', { ref: canvas, style: { display: 'none' } })}
        {ui.people.map(p => (
          <View key={p.key} style={{ position: 'absolute', left: `${Math.max(2, Math.min(70, p.x * 100 - 8))}%`, top: `${Math.max(1, p.y * 100 - 14)}%` } as any}>
            <View style={{ backgroundColor: p.alert ? '#B3261E' : p.name === 'Unknown' ? 'rgba(0,0,0,0.65)' : K.copper, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}><Txt v="caption" color="#fff">{p.name} · {p.state}</Txt></View>
          </View>
        ))}
        {!running ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 20 }}><Txt v="sub" color="#A8958B" center>{err ?? status}</Txt></View> : null}
      </View>
      {ui.pending.map(p => (
        <View key={p.i} style={{ width: '100%', maxWidth: 760, marginTop: 10, backgroundColor: '#B3261E', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}><Txt v="subM" color="#fff">Possible {p.what}: {p.name}</Txt><Txt v="caption" color="#FFD2C8">Alerting flight surgeons and crew in {p.left} s unless cancelled.</Txt></View>
          <Button small kind="secondary" title="It's fine" onPress={() => { pending.current = pending.current.filter((_, j) => j !== p.i); note('Alert cancelled by the operator'); }} />
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, width: '100%', maxWidth: 760 }}>
        <View style={{ flex: 1 }}>{running ? <Button kind="secondary" title="Stop camera" onPress={stop} /> : <Button title="Start camera" onPress={start} />}</View>
        <Button kind="light" title="← Back" onPress={() => { stop(); onExit(); }} />
      </View>
      {running ? (
        <View style={{ width: '100%', maxWidth: 760, marginTop: 12 }}>
          <Txt v="mono" color="#9FD6A8" upper>{known.length ? `Recognised: ${known.map(p => p.name).join(', ')}` : 'Nobody recognised yet'} · live video to {ui.viewers} astronaut room{ui.viewers === 1 ? '' : 's'}</Txt>
          {ui.people.some(p => p.name === 'Unknown') ? (
            <View style={{ marginTop: 8 }}>
              <Txt v="caption" color="#E3B79E">Someone is not recognised (no face enrolled?). Tell the station who it is:</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>{crew.map(p => <Button key={p.id} small kind={pick === p.id ? 'primary' : 'secondary'} title={p.name.split(' ')[0]} onPress={() => { manual.current = pick === p.id ? null : p.id; setPick(manual.current); }} />)}</View>
            </View>
          ) : null}
          {known.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>{crew.filter(c => known.some(k => k.name === c.name)).map(c => <Button key={c.id} small kind="ghost" title={`Test alert: ${c.name.split(' ')[0]}`} onPress={() => drill(c.id, c.name)} />)}</View> : null}
          {log.map((l, i) => <Txt key={i} v="caption" color="#A8958B">{l}</Txt>)}
        </View>
      ) : null}
      <Txt v="caption" color="#A8958B" center style={{ marginTop: 14, maxWidth: 560 }}>Nothing is recorded. The SI runs on this device. Alerts are decision support, not diagnosis: it can miss events and raise false alarms. In an emergency, call for help directly.</Txt>
    </View>
  );
}
