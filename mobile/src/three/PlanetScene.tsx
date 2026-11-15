import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from './fiber';
import { Safe3D } from './Safe3D';
import { Fit } from './Env';

const PALETTES: Record<string, { a: string; b: string; atm: string }> = {
  earth: { a: '#7FA6C2', b: '#EBDDC8', atm: '#CFE3F2' },
  moon: { a: '#9D958E', b: '#D9D2CA', atm: '#EFEAE4' },
  mars: { a: '#A9563A', b: '#E3A27F', atm: '#F6C9AF' },
};
export const planetFor = (env?: string) => (env === 'mars' ? 'mars' : env === 'lunar' ? 'moon' : 'earth');

const noise = `
vec3 hash3(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return -1.0+2.0*fract(sin(p)*43758.5453123);}
float n3(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);
return mix(mix(mix(dot(hash3(i),f),dot(hash3(i+vec3(1,0,0)),f-vec3(1,0,0)),u.x),mix(dot(hash3(i+vec3(0,1,0)),f-vec3(0,1,0)),dot(hash3(i+vec3(1,1,0)),f-vec3(1,1,0)),u.x),u.y),
mix(mix(dot(hash3(i+vec3(0,0,1)),f-vec3(0,0,1)),dot(hash3(i+vec3(1,0,1)),f-vec3(1,0,1)),u.x),mix(dot(hash3(i+vec3(0,1,1)),f-vec3(0,1,1)),dot(hash3(i+vec3(1,1,1)),f-vec3(1,1,1)),u.x),u.y),u.z);}
float fbm(vec3 p){float v=0.0;float a=0.5;for(int i=0;i<5;i++){v+=a*n3(p);p*=2.03;a*=0.5;}return v;}`;

function Planet({ kind }: { kind: string }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const pal = PALETTES[kind] ?? PALETTES.earth;
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { ca: { value: new THREE.Color(pal.a) }, cb: { value: new THREE.Color(pal.b) }, atm: { value: new THREE.Color(pal.atm) }, light: { value: new THREE.Vector3(0.6, 0.5, 0.8).normalize() } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main(){ vN = normalize(normalMatrix*normal); vP = position; vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 ca; uniform vec3 cb; uniform vec3 atm; uniform vec3 light; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${noise}
      void main(){ float n = fbm(vP*1.8); float land = smoothstep(0.02,0.09,n);
        vec3 col = mix(ca, cb, land); col = mix(col, cb*1.08, smoothstep(0.75,0.95,abs(vP.y)));
        float d = max(dot(vN, light), 0.0); float fres = pow(1.0 - max(dot(vN, vV),0.0), 2.5);
        col = col*(0.28 + 0.85*d) + atm*fres*0.75; gl_FragColor = vec4(col,1.0); }`,
  }), [kind]);
  useFrame((_, dt) => { mesh.current.rotation.y += dt * 0.08; });
  return <mesh ref={mesh} material={mat}><sphereGeometry args={[1, 96, 64]} /></mesh>;
}

function Station() {
  const g = useRef<THREE.Group>(null!);
  useFrame(state => {
    const t = state.clock.elapsedTime * 0.45;
    g.current.position.set(Math.cos(t) * 1.55, Math.sin(t) * 0.42, Math.sin(t) * 1.55 * 0.9);
    g.current.rotation.y = -t;
  });
  return (
    <group ref={g} scale={0.9}>
      <mesh><cylinderGeometry args={[0.035, 0.035, 0.2, 16]} /><meshStandardMaterial color="#F2EEE9" metalness={0.4} roughness={0.35} /></mesh>
      <mesh position={[0.17, 0, 0]}><boxGeometry args={[0.16, 0.005, 0.07]} /><meshStandardMaterial color="#C98466" metalness={0.8} roughness={0.25} /></mesh>
      <mesh position={[-0.17, 0, 0]}><boxGeometry args={[0.16, 0.005, 0.07]} /><meshStandardMaterial color="#C98466" metalness={0.8} roughness={0.25} /></mesh>
    </group>
  );
}

export default function PlanetScene({ env, height = 260 }: { env?: string; height?: number }) {
  const kind = planetFor(env);
  return (
    <Safe3D style={{ height, width: '100%' }}>
      <Canvas camera={{ position: [0, 0.4, 4.2], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 4]} intensity={2} />
        <Fit w={3.7} h={2.6}><group rotation={[0.25, 0, -0.18]}>
          <Planet kind={kind} />
          <mesh rotation={[Math.PI / 2 - 0.27, 0, 0]}>
            <torusGeometry args={[1.62, 0.0035, 8, 200]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
          </mesh>
          <Station />
        </group></Fit>
      </Canvas>
    </Safe3D>
  );
}
