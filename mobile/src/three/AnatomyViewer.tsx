/**
 * Interactive anatomy reference (BodyParts3D / Z-Anatomy meshes, pre-optimised in assets/models).
 * Drag to rotate with inertia, pinch / scroll to zoom, idle sway; finding markers are projected
 * into screen space every frame so their labels stay crisp native views on top of the canvas.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from './fiber';
import { Safe3D } from './Safe3D';
import { loadGlb } from './loadGlb';
import type { Finding, LayerKey } from '../data/crew';
import { K, toneColor } from '../kit/tokens';
import { Pressy, Txt } from '../kit/core';

const MODELS: Record<string, number> = {
  circulatory: require('../../assets/models/circulatory.glb'),
  nervous: require('../../assets/models/nervous.glb'),
  skin: require('../../assets/models/skin.glb'),
  digestive: require('../../assets/models/digestive.glb'),
  muscular: require('../../assets/models/muscular.glb'),
  skeletal: require('../../assets/models/skeletal.glb'),
};
/** Which meshes make up each layer. Overview = translucent skin over the circulatory system. */
const LAYER_PARTS: Record<LayerKey, string[]> = {
  overview: ['skin', 'circulatory'], circulatory: ['circulatory'], nervous: ['nervous'], skin: ['skin'],
  digestive: ['digestive'], muscular: ['muscular'], skeletal: ['skeletal'],
};

const cache = new Map<string, Promise<THREE.Group>>();
function getModel(key: string, onProgress?: (f: number) => void) {
  if (!cache.has(key)) {
    const p = loadGlb(MODELS[key], onProgress).then(g => {
      if (key === 'skin') g.position.set(0, 0.019, -0.085), g.scale.setScalar(1.026); // BodyParts3D skin → atlas frame
      return g;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  } else onProgress?.(1);
  return cache.get(key)!;
}

function styleModel(key: string, g: THREE.Group, overview: boolean) {
  g.traverse((n: any) => {
    if (!n.isMesh) return;
    if (!n.userData.orig) n.userData.orig = n.material;
    const orig = n.userData.orig as THREE.MeshStandardMaterial;
    if (key === 'skin') {
      if (!n.userData.normals) { n.geometry.deleteAttribute('normal'); n.geometry.computeVertexNormals(); n.userData.normals = true; }
      n.material = new THREE.MeshStandardMaterial({ color: '#F4E2D6', roughness: 0.62, metalness: 0.0, emissive: '#B98A70', emissiveIntensity: 0.32, transparent: overview, opacity: overview ? 0.18 : 1, depthWrite: !overview, side: THREE.DoubleSide });
      n.renderOrder = overview ? 2 : 0;
    } else {
      const c = (orig as any)?.color ? (orig as any).color.clone() : new THREE.Color('#C98466');
      // warm the atlas colours slightly toward copper so every layer sits in the palette
      c.lerp(new THREE.Color('#C98466'), key === 'skeletal' ? 0.15 : 0.12);
      n.material = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.04 });
    }
  });
}

type Ctl = { rot: number; vel: number; dragging: boolean; zoom: number; tilt: number; target: number | null; idle: number };

function Scene({ layer, findings, selected, ctl, proj, onReady, onProgress }: {
  layer: LayerKey; findings: Finding[]; selected: string | null; ctl: React.MutableRefObject<Ctl>;
  proj: Record<string, { x: Animated.Value; y: Animated.Value; o: Animated.Value }>; onReady: () => void; onProgress: (f: number) => void;
}) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const { camera, size } = useThree();
  const [parts, setParts] = useState<{ key: string; g: THREE.Group }[]>([]);
  const markerRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const v = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    let live = true;
    const keys = LAYER_PARTS[layer];
    const prog: number[] = keys.map(() => 0);
    Promise.all(keys.map((k, i) => getModel(k, f => { prog[i] = f; onProgress(prog.reduce((a, b) => a + b, 0) / keys.length); }))).then(gs => {
      if (!live) return;
      gs.forEach((g, i) => styleModel(keys[i], g, layer === 'overview'));
      setParts(gs.map((g, i) => ({ key: keys[i], g })));
      onReady();
    }).catch(e => console.warn('anatomy load failed', e));
    return () => { live = false; };
  }, [layer]);

  useFrame((state, dt) => {
    const c = ctl.current;
    const t = state.clock.elapsedTime;
    if (!c.dragging) {
      if (c.target != null) {
        let d = c.target - c.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
        c.rot += d * Math.min(1, dt * 4); c.vel = 0;
        if (Math.abs(d) < 0.002) c.target = null;
      } else {
        c.rot += c.vel * dt; c.vel *= Math.pow(0.04, dt);
        c.idle += dt;
        if (Math.abs(c.vel) < 0.05 && c.idle > 2.5) c.rot += Math.sin(t * 0.4) * dt * 0.12; // gentle sway when idle
      }
    }
    root.current.rotation.y = c.rot;
    body.current.position.y = -0.86 + Math.sin(t * 0.9) * 0.006;
    const cam = camera as THREE.PerspectiveCamera;
    const fitZ = 3.35 / Math.min(1, size.width / size.height / 0.5); // whole figure (1.7 m) in frame
    cam.position.z += (fitZ / c.zoom - cam.position.z) * Math.min(1, dt * 6);
    cam.position.y += (c.tilt - cam.position.y) * Math.min(1, dt * 4);
    cam.lookAt(0, c.tilt * 0.9, 0);
    // project markers → screen
    for (const f of findings) {
      const m = markerRefs.current[f.id];
      const p = proj[f.id];
      if (!m || !p) continue;
      const s = 1 + Math.sin(t * (f.tone === 'flag' ? 4 : 2.4)) * 0.18;
      m.scale.setScalar(selected === f.id ? s * 1.5 : s);
      m.getWorldPosition(v);
      const facing = v.z > -0.02;
      v.project(cam);
      p.x.setValue((v.x * 0.5 + 0.5) * size.width);
      p.y.setValue((-v.y * 0.5 + 0.5) * size.height);
      p.o.setValue(facing ? 1 : 0.28);
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {parts.map(p => <primitive key={p.key} object={p.g} />)}
        {findings.map(f => (
          <mesh key={f.id} position={f.pos} ref={(r: any) => { markerRefs.current[f.id] = r; }} renderOrder={5}>
            <sphereGeometry args={[0.014, 20, 14]} />
            <meshBasicMaterial color={toneColor(f.tone)} transparent opacity={0.95} depthTest={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function AnatomyViewer({ layer, findings, selected, onSelect, height = 420 }: {
  layer: LayerKey; findings: Finding[]; selected: string | null; onSelect: (id: string | null) => void; height?: number;
}) {
  const ctl = useRef<Ctl>({ rot: 0.08, vel: 0, dragging: false, zoom: 1, tilt: 0.05, target: null, idle: 0 });
  const proj = useMemo(() => Object.fromEntries(findings.map(f => [f.id, { x: new Animated.Value(-99), y: new Animated.Value(-99), o: new Animated.Value(0) }])), [findings.map(f => f.id).join()]);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { setReady(false); setProgress(0); fade.setValue(0); }, [layer]);
  useEffect(() => { if (ready) Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }).start(); }, [ready]);
  useEffect(() => {
    const f = findings.find(x => x.id === selected);
    const c = ctl.current;
    if (f) { c.target = -Math.atan2(f.pos[0], f.pos[2] + 0.12) * 0.6; c.tilt = (f.pos[1] - 0.86) * 0.5; c.zoom = 1.45; }
    else { c.zoom = 1; c.tilt = 0.05; }
  }, [selected]);

  const pinch = useRef<number | null>(null);
  const lastDx = useRef(0);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const c = ctl.current; c.dragging = true; c.target = null; c.idle = 0; pinch.current = null; },
    onPanResponderMove: (e, g) => {
      const c = ctl.current;
      const t = e.nativeEvent.touches;
      if (t && t.length === 2) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (pinch.current) c.zoom = Math.max(0.8, Math.min(2.6, c.zoom * (d / pinch.current)));
        pinch.current = d;
        return;
      }
      c.rot += (g.dx - lastDx.current) * 0.012;
      lastDx.current = g.dx;
      c.vel = g.vx * 9;
    },
    onPanResponderRelease: (_, g) => {
      const c = ctl.current; c.dragging = false; c.idle = 0; lastDx.current = 0;
      if (Math.abs(g.dx) < 4 && Math.abs(g.dy) < 4) onSelectRef.current(null);
    },
    onPanResponderTerminate: () => { ctl.current.dragging = false; lastDx.current = 0; },
  })).current;
  const onSelectRef = useRef(onSelect); onSelectRef.current = onSelect;
  const wheel = Platform.OS === 'web' ? { onWheel: (e: any) => { const c = ctl.current; c.zoom = Math.max(0.8, Math.min(2.6, c.zoom * (e.nativeEvent.deltaY > 0 ? 0.92 : 1.08))); } } : {};

  return (
    <View style={{ height, width: '100%' }}>
      <Safe3D style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} fallback={<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Txt v="sub" color={K.ink2}>3D view is unavailable on this device.</Txt></View>}>
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
          <Canvas camera={{ position: [0, 0.05, 3.35], fov: 32, near: 0.05, far: 30 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: 'transparent' }}>
            <hemisphereLight args={['#FFF8F0', '#A78067', 1.9]} />
            <directionalLight position={[3, 5, 4]} intensity={2.2} color="#FFF4EA" />
            <directionalLight position={[-4, 2, -3]} intensity={1.1} color="#FFD8C2" />
            <directionalLight position={[0, -2, 3]} intensity={0.35} color="#E8B898" />
            <Scene layer={layer} findings={findings} selected={selected} ctl={ctl} proj={proj} onReady={() => setReady(true)} onProgress={setProgress} />
          </Canvas>
        </Animated.View>
      </Safe3D>
      <View {...pan.panHandlers} {...(wheel as any)} style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as any) : null]} />
      {!ready ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center' }}>
          <View style={{ width: 140, height: 3, borderRadius: 2, backgroundColor: 'rgba(184,105,63,0.15)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(progress * 100)}%`, height: 3, backgroundColor: K.copper }} />
          </View>
          <Txt v="mono" color={K.ink2} style={{ marginTop: 6 }} upper>{progress > 0.02 ? `Loading layer · ${Math.round(progress * 100)}%` : 'Loading layer…'}</Txt>
        </View>
      ) : null}
      {ready ? findings.map(f => {
        const p = proj[f.id];
        if (!p) return null;
        const on = selected === f.id;
        return (
          <Animated.View key={f.id} style={{ position: 'absolute', left: 0, top: 0, opacity: p.o, transform: [{ translateX: p.x }, { translateY: p.y }] }}>
            <Pressy label={`${f.label} marker`} onPress={() => onSelect(on ? null : f.id)} hitSlop={10}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, marginTop: -13, backgroundColor: on ? K.cocoa : 'rgba(255,253,251,0.94)', borderRadius: 12, paddingHorizontal: 9, height: 25, borderWidth: 1, borderColor: on ? K.cocoa : K.hair2, gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColor(f.tone) }} />
                <Txt v="caption" color={on ? '#fff' : K.ink} style={{ fontFamily: 'Geist_500Medium' }}>{f.label}</Txt>
              </View>
            </Pressy>
          </Animated.View>
        );
      }) : null}
    </View>
  );
}
