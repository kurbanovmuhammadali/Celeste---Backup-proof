import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from './fiber';
import { StudioEnv, Fit } from './Env';
import { Safe3D } from './Safe3D';
import { statusColor } from '../theme';

export const HOTSPOTS: Record<string, [number, number, number]> = {
  brain: [0, 1.76, 0.05],
  eyes: [0.06, 1.65, 0.19],
  heart: [0.09, 1.16, 0.22],
  immune: [-0.13, 0.96, 0.2],
  metabolism: [0.11, 0.86, 0.22],
  bones: [0.14, 0.3, 0.1],
};
const FACING: Record<string, number> = { brain: 0, eyes: 0, heart: -0.25, immune: 0.35, metabolism: -0.3, bones: -0.3 };

type Part = { p: [number, number, number]; r?: [number, number, number]; s?: [number, number, number]; cap?: [number, number] ; sphere?: number };
const PARTS: Part[] = [
  { p: [0, 1.64, 0], sphere: 0.17, s: [0.9, 1.12, 0.98] },
  { p: [0, 1.42, 0], cap: [0.065, 0.1] },
  { p: [0.3, 1.3, 0], sphere: 0.1 },
  { p: [-0.3, 1.3, 0], sphere: 0.1 },
  { p: [0, 1.12, 0], cap: [0.2, 0.3], s: [1.5, 1, 0.72] },
  { p: [0, 0.9, 0], cap: [0.17, 0.12], s: [1.3, 1, 0.75] },
  { p: [0, 0.72, 0], cap: [0.21, 0.08], s: [1.25, 1, 0.8] },
  { p: [0.42, 1.12, 0], cap: [0.072, 0.3], r: [0, 0, 0.2] },
  { p: [-0.42, 1.12, 0], cap: [0.072, 0.3], r: [0, 0, -0.2] },
  { p: [0.5, 0.76, 0.02], cap: [0.062, 0.3], r: [0, 0, 0.08] },
  { p: [-0.5, 0.76, 0.02], cap: [0.062, 0.3], r: [0, 0, -0.08] },
  { p: [0.53, 0.53, 0.03], sphere: 0.066, s: [0.8, 1.2, 0.6] },
  { p: [-0.53, 0.53, 0.03], sphere: 0.066, s: [0.8, 1.2, 0.6] },
  { p: [0.135, 0.37, 0], cap: [0.1, 0.38], r: [0, 0, 0.03] },
  { p: [-0.135, 0.37, 0], cap: [0.1, 0.38], r: [0, 0, -0.03] },
  { p: [0.15, -0.13, 0], cap: [0.08, 0.4] },
  { p: [-0.15, -0.13, 0], cap: [0.08, 0.4] },
  { p: [0.15, -0.4, 0.06], cap: [0.055, 0.1], r: [Math.PI / 2, 0, 0] },
  { p: [-0.15, -0.4, 0.06], cap: [0.055, 0.1], r: [Math.PI / 2, 0, 0] },
];

function Hotspot({ id, pos, status, selected, onSelect }: { id: string; pos: [number, number, number]; status: string; selected: boolean; onSelect: (k: string) => void }) {
  const halo = useRef<THREE.Mesh>(null!);
  const color = statusColor(status);
  useFrame(state => {
    const t = state.clock.elapsedTime * (status === 'red' ? 3.2 : 1.8) + pos[1] * 3;
    const s = (selected ? 2.4 : 1.6) + Math.sin(t) * 0.35;
    halo.current.scale.setScalar(s);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.32 - Math.sin(t) * 0.12;
  });
  const click = (e: any) => { e.stopPropagation?.(); onSelect(id); };
  return (
    <group position={pos}>
      <mesh onClick={click}>
        <sphereGeometry args={[selected ? 0.05 : 0.038, 24, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} roughness={0.3} />
      </mesh>
      <mesh ref={halo} onClick={click}>
        <sphereGeometry args={[0.04, 24, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Figure({ statuses, selected, onSelect }: { statuses: Record<string, string>; selected?: string | null; onSelect: (k: string) => void }) {
  const g = useRef<THREE.Group>(null!);
  const geos = useMemo(() => PARTS.map(p => (p.sphere ? new THREE.SphereGeometry(p.sphere, 40, 28) : new THREE.CapsuleGeometry(p.cap![0], p.cap![1], 10, 28))), []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const target = selected ? FACING[selected] ?? 0 : Math.sin(t * 0.35) * 0.65;
    g.current.rotation.y += (target - g.current.rotation.y) * Math.min(1, dt * (selected ? 3 : 1.2));
    g.current.position.y = -0.62 + Math.sin(t * 0.8) * 0.025;
  });
  return (
    <group ref={g}>
      {PARTS.map((p, i) => (
        <mesh key={i} geometry={geos[i]} position={p.p} rotation={p.r ?? [0, 0, 0]} scale={p.s ?? [1, 1, 1]}>
          <meshStandardMaterial color="#F3EEE9" roughness={0.42} metalness={0.05} />
        </mesh>
      ))}
      {Object.entries(HOTSPOTS).map(([k, pos]) => (
        <Hotspot key={k} id={k} pos={pos} status={statuses[k] ?? 'none'} selected={selected === k} onSelect={onSelect} />
      ))}
    </group>
  );
}

export default function BodyScene({ statuses, selected, onSelect, height = 460 }: { statuses: Record<string, string>; selected?: string | null; onSelect: (k: string) => void; height?: number }) {
  return (
    <Safe3D style={{ height, width: '100%' }}>
      <Canvas camera={{ position: [0, 0.35, 3.3], fov: 40 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3, 4]} intensity={2} color="#FFF4EC" />
        <directionalLight position={[-3, 1, -2]} intensity={1.4} color="#FFC9B3" />
        <directionalLight position={[0, -3, 2]} intensity={0.5} color="#B89A88" />
        <StudioEnv intensity={0.5} />
        <Fit w={1.6} h={2.45}><Figure statuses={statuses} selected={selected} onSelect={onSelect} /></Fit>
      </Canvas>
    </Safe3D>
  );
}
