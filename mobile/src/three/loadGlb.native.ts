/** iOS/Android: copy the bundled .glb to disk, read its bytes and parse (no Draco/Meshopt: the meshes are pre-decoded). */
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Group } from 'three';

// Hermes may lack TextDecoder; GLTFLoader only needs UTF-8 for the JSON chunk.
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = class {
    decode(input?: ArrayBuffer | ArrayBufferView) {
      if (!input) return '';
      const b = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '', i = 0;
      while (i < b.length) {
        const c = b[i++];
        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (b[i++] & 0x3f));
        else if (c < 0xf0) out += String.fromCharCode(((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f));
        else { const cp = (((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f)) - 0x10000; out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); }
      }
      return out;
    }
  };
}

export async function loadGlb(mod: number, onProgress?: (f: number) => void): Promise<Group> {
  onProgress?.(0.1);
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  onProgress?.(0.45);
  const buf = await new File(asset.localUri ?? asset.uri).arrayBuffer();
  onProgress?.(0.8);
  const gltf = await new Promise<any>((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
  onProgress?.(1);
  return gltf.scene;
}
