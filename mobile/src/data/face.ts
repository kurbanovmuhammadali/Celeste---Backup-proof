/**
 * Face recognition in the browser with open-source face-api.js (MIT): tiny face detector, 68-point landmarks and a recognition network
 * that turns a face into 128 numbers. Models are bundled in /public/models, nothing is trained or downloaded at run time, and no
 * photo is ever uploaded: only the 128 numbers leave the device (see server/src/face.js).
 */
const base = () => (typeof location !== 'undefined' ? location.origin : '');
let lib: Promise<any> | null = null;

export function loadFace(): Promise<any> {
  return (lib = lib ?? (async () => {
    if (!(window as any).faceapi) await new Promise<void>((ok, fail) => { const s = document.createElement('script'); s.src = `${base()}/vendor/face-api.js`; s.onload = () => ok(); s.onerror = () => fail(new Error('face library missing')); document.head.appendChild(s); });
    const f = (window as any).faceapi;
    await Promise.all([f.nets.tinyFaceDetector.loadFromUri(`${base()}/models`), f.nets.faceLandmark68Net.loadFromUri(`${base()}/models`), f.nets.faceRecognitionNet.loadFromUri(`${base()}/models`)]);
    return f;
  })().catch(e => { lib = null; throw e; }));
}

export type Seen = { descriptor: number[]; box: { x: number; y: number; w: number; h: number }; yaw: number; score: number; size: number };
/** Head turn from the landmarks: 0 = facing the camera, about ±0.25 or more = clearly turned. */
export function yawOf(pts: { x: number; y: number }[]): number {
  const l = pts[0], r = pts[16], nose = pts[30]; const w = r.x - l.x;
  return w > 1 ? (nose.x - (l.x + r.x) / 2) / w : 0;
}

/** Finds every face in the image/video, with descriptors (use `maxFaces` to cap the work). */
export async function seeFaces(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement, maxFaces = 1, inputSize = 320): Promise<Seen[]> {
  const f = await loadFace();
  const opts = new f.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.5 });
  const all = await f.detectAllFaces(el, opts).withFaceLandmarks().withFaceDescriptors();
  const W = (el as any).videoWidth || (el as any).naturalWidth || (el as any).width || 1, H = (el as any).videoHeight || (el as any).naturalHeight || (el as any).height || 1;
  return all.sort((a: any, b: any) => b.detection.box.width - a.detection.box.width).slice(0, maxFaces).map((d: any) => ({
    descriptor: Array.from(d.descriptor as Float32Array), score: d.detection.score, yaw: yawOf(d.landmarks.positions),
    box: { x: d.detection.box.x / W, y: d.detection.box.y / H, w: d.detection.box.width / W, h: d.detection.box.height / H }, size: d.detection.box.width / W,
  }));
}
export const faceDistance = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
