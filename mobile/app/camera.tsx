/**
 * DEMO-ONLY (temporary): the camera station. A hard-coded page at /camera that nothing in the app links to.
 * Pick an astronaut; the camera opens and films him; the flight surgeon watches in the console, and meals are detected.
 * Needs CAMERA_STATION=on on the server (non-production only). See ../DEMO_REMOVAL.md.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Pressy, Txt } from '@/kit/core';
import { api } from '@/api';
import CaptureView from '@/kit/CaptureView';
import StationView from '@/kit/StationView';

type Person = { id: number; name: string; mission: string };

export default function CameraStation() {
  const [crew, setCrew] = useState<Person[] | 'off' | null>(null);
  const [pick, setPick] = useState<Person | null>(null);
  const [auto, setAuto] = useState(false);
  useEffect(() => { api<{ crew: Person[] }>('/api/station/crew').then(r => setCrew(r.crew)).catch(() => setCrew('off')); }, []);
  const box = { flex: 1, backgroundColor: '#1C120D', alignItems: 'center' as const, padding: 20, paddingTop: 36 };

  if (auto && Array.isArray(crew)) return <StationView crew={crew} onExit={() => setAuto(false)} />;
  if (pick) return <CaptureView key={pick.id} base={`/api/station/${pick.id}`} autoStart onExit={() => setPick(null)} />;
  if (Platform.OS !== 'web') return <View style={box}><Txt v="headline" color="#fff" center>Open /camera in a browser</Txt></View>;
  if (crew === 'off') return <View style={box}><Txt v="title" color="#fff" center>Sign in to use the camera station</Txt><Txt v="sub" color="#E3B79E" center style={{ marginTop: 8 }}>Open Celeste in this browser, sign in as a crew member or doctor, then open /camera again. You can film yourself and your crew mates; doctors can film anyone.</Txt></View>;

  return (
    <View style={box}>
      <Txt v="mono" color="#E3B79E" upper>✦ Celeste · camera station</Txt>
      <Txt v="title" color="#fff" center style={{ marginTop: 8 }}>Who is on camera?</Txt>
      <Txt v="sub" color="#E3B79E" center style={{ marginTop: 6, maxWidth: 420 }}>Scan the room to recognise everyone, or pick one astronaut manually.</Txt>
      <View style={{ width: '100%', maxWidth: 520, marginTop: 20, gap: 10 }}>
        {crew !== null ? <Pressy label="Scan the room: recognise people automatically" onPress={() => setAuto(true)}><View style={{ backgroundColor: K.copper, borderRadius: 18, padding: 16 }}><Txt v="headline" color="#fff">Scan the room (recommended)</Txt><Txt v="caption" color="#FFE9DC">Recognises faces, labels people, watches for emergencies, writes an activity report.</Txt></View></Pressy> : null}
        {crew === null ? <Txt v="sub" color="#A8958B" center>Loading…</Txt> : crew.map(p => (
          <Pressy key={p.id} label={`Film ${p.name}`} onPress={() => setPick(p)}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <Txt v="headline" color="#fff">{p.name}</Txt>
              <Txt v="caption" color="#E3B79E">{p.mission}</Txt>
            </View>
          </Pressy>
        ))}
      </View>
    </View>
  );
}
