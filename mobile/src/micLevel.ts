/**
 * Live microphone loudness (0…1) as an Animated.Value, for the SI sphere to breathe with your voice.
 * Web: getUserMedia + an AnalyserNode (nothing is recorded or sent anywhere; the stream stops when listening ends).
 * Native, or when the browser refuses the mic: a soft speech-like rhythm so the sphere still feels alive.
 */
import { useEffect, useRef } from 'react';
import { Animated, Platform } from 'react-native';

export function useMicLevel(active: boolean) {
  const level = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { Animated.spring(level, { toValue: 0, useNativeDriver: false, speed: 10, bounciness: 8 }).start(); return; }
    let raf = 0, stop = false, cur = 0;
    let stream: MediaStream | null = null, ctx: AudioContext | null = null, an: AnalyserNode | null = null, buf: Uint8Array | null = null;
    const t0 = Date.now();
    const loop = () => {
      if (stop) return;
      let raw: number;
      if (an && buf) {
        an.getByteTimeDomainData(buf as any);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        raw = Math.min(1, Math.sqrt(sum / buf.length) * 5.5); // speech RMS ≈ 0.02–0.2 → 0.1–1
      } else {
        const t = (Date.now() - t0) / 1000; // gentle syllable-like rhythm
        raw = 0.22 + 0.18 * Math.max(0, Math.sin(t * 7.3)) * (0.6 + 0.4 * Math.sin(t * 1.7)) + 0.08 * Math.sin(t * 13.1);
      }
      cur += (raw - cur) * (raw > cur ? 0.45 : 0.12); // fast attack, slow release
      level.setValue(cur);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); // breathe right away; switch to the real mic level once it is granted
    (async () => {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (stop) { stream.getTracks().forEach(t => t.stop()); return; }
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          ctx = new AC();
          an = ctx!.createAnalyser(); an.fftSize = 1024;
          ctx!.createMediaStreamSource(stream).connect(an);
          buf = new Uint8Array(an.fftSize);
        } catch { an = null; }
      }
    })();
    return () => {
      stop = true; cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      ctx?.close().catch(() => {});
      Animated.spring(level, { toValue: 0, useNativeDriver: false, speed: 10, bounciness: 8 }).start();
    };
  }, [active]);
  return level;
}
