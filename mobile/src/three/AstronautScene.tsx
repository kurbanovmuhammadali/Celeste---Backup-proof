import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from './fiber';
import { StudioEnv } from './Env';
import { Safe3D } from './Safe3D';
import { loadGlb } from './loadGlb';
import { toneColor } from '../kit/tokens';
import type { Risk, RiskId } from '../data/risk';

/**
 * Real NASA astronaut (NASA 3D Resources "Astronaut", credit: NASA). Textures were baked out so it loads on web and iOS.
 * The heart marker beats at the crew member's resting heart rate; flagged risk areas glow on the body.
 */
const MODEL = require('../../assets/models/astronaut.glb');

// Marker anchors in normalized model space (height 2.2, centered). Tune here if the model changes.
const ANCHORS: Partial<Record<RiskId, [number, number, number][]>> = {
  mind: [[0, 0.62, 0.22]],
  immune: [[0, 0.02, 0.3]],
  bone: [[-0.75, 0.37, 0.05], [0.75, 0.37, 0.05], [-0.2, -0.62, 0.15], [0.2, -0.62, 0.15]],
};
const HEART: [number, number, number] = [0.13, 0.24, 0.38];

function Marker({ position, color, pulse, bpm = 60 }: { position: [number, number, number]; color: string; pulse?: boolean; bpm?: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const s = pulse ? 1 + Math.pow(Math.max(0, Math.sin(t * (bpm / 60) * Math.PI * 2)), 6) * 0.6 : 1 + Math.sin(t * 2.5) * 0.12;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.075, 20, 20]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.3} transparent opacity={0.92} />
    </mesh>
  );
}

function Astronaut({ risks, bpm }: { risks: Risk[]; bpm: number }) {
  const sway = useRef<THREE.Group>(null!);
  const [model, setModel] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let alive = true;
    loadGlb(MODEL).then(g => { if (alive) setModel(g); }).catch(e => console.warn('Astronaut model failed to load', e));
    return () => { alive = false; };
  }, []);

  const prepared = useMemo(() => {
    if (!model) return null;
    const s = model.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    return { s, k: 2.2 / (size.y || 1), c };
  }, [model]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    sway.current.rotation.y = Math.sin(t * 0.5) * 0.7; // slow turn so the markers stay in view
    sway.current.position.y = Math.sin(t * 1.1) * 0.04; // zero-g float
  });

  const byId = (id: RiskId) => risks.find(r => r.id === id)?.tone ?? 'ok';
  const cardio = byId('cardio');
  return (
    <group ref={sway}>
      {prepared ? (
        <>
          <group scale={prepared.k}><primitive object={prepared.s} position={[-prepared.c.x, -prepared.c.y, -prepared.c.z]} /></group>
          <Marker position={HEART} pulse bpm={bpm} color={toneColor(cardio === 'ok' || cardio === 'none' ? 'flag' : cardio)} />
          {(Object.keys(ANCHORS) as RiskId[]).map(id => {
            const t = byId(id);
            return t === 'ok' || t === 'none' ? null : ANCHORS[id]!.map((p, i) => <Marker key={id + i} position={p} color={toneColor(t)} />);
          })}
        </>
      ) : null}
    </group>
  );
}

export default function AstronautScene({ risks, bpm = 60, height = 260, fallback }: { risks: Risk[]; bpm?: number; height?: number; fallback?: React.ReactNode }) {
  return (
    <Safe3D style={{ height, width: '100%' }} fallback={fallback}>
      <Canvas camera={{ position: [0, 0, 3.7], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={1.0} />
        <directionalLight position={[2, 3, 4]} intensity={2.2} />
        <pointLight position={[-3, 1, -2]} intensity={1.4} color="#ffb792" />
        <StudioEnv intensity={0.8} />
        <Astronaut risks={risks} bpm={bpm} />
      </Canvas>
    </Safe3D>
  );
}
