import React from 'react';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useThree } from './fiber';

/** Procedural studio reflections for metal (no HDR download → works offline, e.g. on a spacecraft). */
export function StudioEnv({ intensity = 0.9 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (Platform.OS !== 'web') return; // expo-gl: rely on lights only
    try {
      const pm = new THREE.PMREMGenerator(gl as THREE.WebGLRenderer);
      const tex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = tex;
      (scene as any).environmentIntensity = intensity;
      return () => { tex.dispose(); pm.dispose(); scene.environment = null; };
    } catch { /* lights only */ }
  }, [gl, scene, intensity]);
  return null;
}

/** Scales children so a w×h world-unit box always fits the canvas (any aspect ratio). */
export function Fit({ w, h, children }: { w: number; h: number; children: React.ReactNode }) {
  const size = useThree(st => st.size);
  const camera = useThree(st => st.camera) as THREE.PerspectiveCamera;
  // visible frustum at the origin
  const dist = camera.position.length();
  const vh = 2 * Math.tan(((camera.fov ?? 40) * Math.PI) / 360) * dist;
  const vw = vh * (size.width / Math.max(1, size.height));
  const raw = Math.min(1, vw / w, vh / h);
  const s = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return <group scale={[s, s, s]}>{children}</group>;
}
