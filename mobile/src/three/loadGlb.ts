/** Web: load a bundled .glb by URL (with download progress). */
import { Asset } from 'expo-asset';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group } from 'three';

export async function loadGlb(mod: number, onProgress?: (f: number) => void): Promise<Group> {
  const asset = Asset.fromModule(mod);
  const gltf = await new GLTFLoader().loadAsync(asset.uri, e => { if (e.total) onProgress?.(e.loaded / e.total); });
  onProgress?.(1);
  return gltf.scene;
}
