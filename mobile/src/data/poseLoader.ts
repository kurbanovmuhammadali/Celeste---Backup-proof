/**
 * MediaPipe Pose Landmarker and Object Detector (pretrained by Google, Apache-2.0). Runtime and models are bundled in /public so
 * everything runs in the browser with no internet and nothing leaves the device. Web only.
 */
export type PoseKind = 'full' | 'heavy';
const base = () => (typeof location !== 'undefined' ? location.origin : '');
let vision: Promise<any> | null = null;
const loadVision = () => (vision = vision ?? (async () => {
  // imported at runtime so the bundler never tries to resolve it
  const mod: any = await (new Function('u', 'return import(u)') as (u: string) => Promise<any>)(`${base()}/vendor/mediapipe/vision_bundle.mjs`);
  return { mod, fileset: await mod.FilesetResolver.forVisionTasks(`${base()}/vendor/mediapipe/wasm`) };
})().catch(e => { vision = null; throw e; }));

const poses: Partial<Record<string, Promise<any>>> = {};
/** `heavy` is slower but more accurate (use it for push-ups and pull-ups). `numPoses` > 1 lets the camera station follow several people. */
export function loadPose(kind: PoseKind = 'full', numPoses = 1): Promise<any> {
  const k = `${kind}:${numPoses}`;
  return (poses[k] = poses[k] ?? (async () => {
    const { mod, fileset } = await loadVision();
    const make = (delegate: 'GPU' | 'CPU') => mod.PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base()}/models/mediapipe/pose_landmarker_${kind}.task`, delegate }, runningMode: 'VIDEO', numPoses,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { return await make('GPU'); } catch { return make('CPU'); }
  })().catch(e => { delete poses[k]; throw e; }));
}

let objects: Promise<any> | null = null;
/** Detects everyday objects (cup, bottle, laptop, phone, ...) to give the activity report some context. */
export const loadObjects = (): Promise<any> => (objects = objects ?? (async () => {
  const { mod, fileset } = await loadVision();
  return mod.ObjectDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: `${base()}/models/mediapipe/efficientdet_lite0.tflite`, delegate: 'CPU' }, runningMode: 'VIDEO', maxResults: 5, scoreThreshold: 0.4 });
})().catch(e => { objects = null; throw e; }));
