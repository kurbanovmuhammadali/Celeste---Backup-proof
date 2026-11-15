import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from './fiber';
import { StudioEnv, Fit } from './Env';
import { Safe3D } from './Safe3D';

/** Rounded-rectangle cross-section revolved around Y → a real ring band (like the reference photo). */
function useRingGeometry() {
  return useMemo(() => {
    const ri = 1.0, ro = 1.17, hh = 0.36, cr = 0.075;
    const pts: THREE.Vector2[] = [];
    const arc = (cx: number, cy: number, a0: number, a1: number) => {
      for (let i = 0; i <= 10; i++) { const a = a0 + ((a1 - a0) * i) / 10; pts.push(new THREE.Vector2(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr)); }
    };
    arc(ro - cr, -hh + cr, -Math.PI / 2, 0);
    arc(ro - cr, hh - cr, 0, Math.PI / 2);
    arc(ri + cr, hh - cr, Math.PI / 2, Math.PI);
    arc(ri + cr, -hh + cr, Math.PI, Math.PI * 1.5);
    pts.push(pts[0].clone());
    const g = new THREE.LatheGeometry(pts, 160);
    g.computeVertexNormals();
    return g;
  }, []);
}

function Ring({ speed = 0.35 }: { speed?: number }) {
  const group = useRef<THREE.Group>(null!);
  const geo = useRingGeometry();
  const dots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
      const a = -0.55 + col * 0.13; const y = -0.1 + row * 0.12;
      out.push([Math.sin(a) * 0.985, y, Math.cos(a) * 0.985]);
    }
    return out;
  }, []);
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    group.current.rotation.y += dt * speed;
    group.current.rotation.x = 0.42 + Math.sin(t * 0.6) * 0.06;
    group.current.rotation.z = -0.18 + Math.cos(t * 0.4) * 0.04;
    group.current.position.y = Math.sin(t * 0.9) * 0.06;
  });
  return (
    <group ref={group}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#D9967B" metalness={1} roughness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* inner black sensor liner */}
      <mesh>
        <cylinderGeometry args={[0.992, 0.992, 0.6, 96, 1, true]} />
        <meshStandardMaterial color="#17110E" metalness={0.4} roughness={0.32} side={THREE.BackSide} />
      </mesh>
      {dots.map((p, i) => (
        <mesh key={i} position={p} scale={[1, 1, 0.35]} rotation={[0, Math.atan2(p[0], p[2]), 0]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <meshStandardMaterial color="#C77A5C" emissive="#5a2a18" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
      {/* optical sensor window */}
      <mesh position={[Math.sin(2.3) * 0.975, -0.02, Math.cos(2.3) * 0.975]} rotation={[0, 2.3, 0]}>
        <boxGeometry args={[0.22, 0.17, 0.04]} />
        <meshStandardMaterial color="#2a2522" metalness={0.9} roughness={0.08} />
      </mesh>
    </group>
  );
}

export default function RingScene({ height = 340, speed }: { height?: number; speed?: number }) {
  return (
    <Safe3D style={{ height, width: '100%' }}>
      <Canvas camera={{ position: [0, 0.2, 4.1], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} color="#FFF1E6" />
        <directionalLight position={[-4, 1.5, -3]} intensity={1.8} color="#FFD3BE" />
        <directionalLight position={[0, -4, 2]} intensity={0.8} color="#8A6A58" />
        <pointLight position={[0, 0, 0]} intensity={0.6} color="#ffb08f" distance={3} />
        <StudioEnv intensity={1} />
        <Fit w={2.9} h={2.5}><Ring speed={speed} /></Fit>
      </Canvas>
    </Safe3D>
  );
}
