/**
 * Web-only iPhone preview.
 * On a wide desktop browser the app is shown inside an iPhone-sized frame (an iframe of the app itself), so every
 * screen lays out at a real iPhone viewport — exactly what the Xcode / native build will get.
 * Inside the frame the app gets iPhone safe-area insets (status bar + home indicator).
 * Native builds and real phone browsers never use any of this.
 */
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

/** iPhone viewports in points, with their portrait safe-area insets. */
export const DEVICES = {
  'iphone-16-pro': { label: 'iPhone 16 Pro', w: 402, h: 874, top: 62, bottom: 34, island: true },
  'iphone-16': { label: 'iPhone 16 / 15', w: 393, h: 852, top: 59, bottom: 34, island: true },
  'iphone-16-pro-max': { label: 'iPhone 16 Pro Max', w: 440, h: 956, top: 62, bottom: 34, island: true },
  'iphone-se': { label: 'iPhone SE', w: 375, h: 667, top: 20, bottom: 0, island: false },
} as const;
type DeviceKey = keyof typeof DEVICES;

const param = (k: string) => (web ? new URLSearchParams(window.location.search).get(k) : null);
const DEVICE_PARAM = param('device'); // read once: the router drops unknown query params after the first navigation
const embedded = web && window.self !== window.top && DEVICE_PARAM != null;

/**
 * How a desktop / tablet browser shows the app (phones always render directly):
 *   column (default) — the exact mobile UI in a centred, full-height phone-width column, so web = mobile;
 *   frame  (?frame=1) — the same inside an iPhone bezel, for demos;
 *   full   (?frame=0) — the old responsive wide layout with the sidebar.
 */
// Laptop browsers get the responsive website layout (sidebar, multi-column) and phones the mobile app — both 'direct'.
// The centred phone column is kept only as an opt-in demo (?frame=column); ?frame=1 shows an iPhone bezel.
export const webMode: 'direct' | 'column' | 'frame' =
  !web || embedded ? 'direct' : param('frame') === '1' && window.innerWidth >= 600 ? 'frame' : param('frame') === 'column' ? 'column' : 'direct';
/** Phone template below this width (the app fills the screen), laptop/tablet template at or above it (phone column). */
export const PHONE_MAX = 600;
export const shouldFrame = webMode === 'frame';
const COLUMN = { w: 440, top: 14, bottom: 10 };

/** Inside the frame: give the app the device's safe-area insets. Elsewhere: pass through. */
export function DeviceInsets({ children }: { children: React.ReactNode }) {
  if (!embedded) return <>{children}</>;
  if (DEVICE_PARAM === 'column') return <SafeAreaInsetsContext.Provider value={{ top: COLUMN.top, bottom: COLUMN.bottom, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>;
  const d = DEVICES[(DEVICE_PARAM as DeviceKey)] ?? DEVICES['iphone-16'];
  return <SafeAreaInsetsContext.Provider value={{ top: d.top, bottom: d.bottom, left: 0, right: 0 }}>{children}</SafeAreaInsetsContext.Provider>;
}

const pick = (): DeviceKey => {
  try { const v = localStorage.getItem('astra.device'); if (v && v in DEVICES) return v as DeviceKey; } catch {}
  return 'iphone-16';
};

export function DeviceFrame() {
  const [key, setKey] = useState<DeviceKey>(pick);
  const [vh, setVh] = useState(window.innerHeight);
  useEffect(() => { const on = () => setVh(window.innerHeight); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const d = DEVICES[key];
  const bezel = 14;
  const scale = Math.min(1, (vh - 90) / (d.h + bezel * 2));
  const src = (() => {
    const u = new URL(window.location.href);
    u.searchParams.set('device', key);
    return u.pathname + u.search + u.hash;
  })();
  const choose = (k: DeviceKey) => { setKey(k); try { localStorage.setItem('astra.device', k); } catch {} };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 50% 30%, #F8EEE8, #E9D9CF)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: d.w + bezel * 2, height: d.h + bezel * 2, transform: `scale(${scale})`, transformOrigin: 'center', margin: `${((scale - 1) * (d.h + bezel * 2)) / 2}px 0`, flex: 'none' }}>
        <div style={{ position: 'relative', boxSizing: 'border-box', width: '100%', height: '100%', borderRadius: d.island ? 68 : 46, background: '#1a1411', padding: bezel, boxShadow: '0 40px 90px -30px rgba(70,35,15,.55), inset 0 0 0 2px #4a3a31' }}>
          <iframe key={key} title="Celeste on iPhone" src={src} style={{ width: d.w, height: d.h, border: 0, borderRadius: d.island ? 55 : 0, display: 'block', background: '#F8EEE8' }} />
          {d.island ? <div style={{ position: 'absolute', left: '50%', top: bezel + 11, width: 124, height: 36, marginLeft: -62, borderRadius: 18, background: '#000', pointerEvents: 'none' }} /> : null}
          {d.island ? <div style={{ position: 'absolute', left: '50%', bottom: bezel + 8, width: 140, height: 5, marginLeft: -70, borderRadius: 3, background: 'rgba(0,0,0,.35)', pointerEvents: 'none' }} /> : null}
        </div>
      </div>
      <div role="radiogroup" aria-label="Device size" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {(Object.keys(DEVICES) as DeviceKey[]).map(k => (
          <button key={k} role="radio" aria-checked={k === key} onClick={() => choose(k)}
            style={{ cursor: 'pointer', border: '1px solid ' + (k === key ? '#B8693F' : '#E3CFC3'), background: k === key ? '#B8693F' : '#fff', color: k === key ? '#fff' : '#2B1E18', borderRadius: 999, padding: '6px 12px', fontSize: 12 }}>
            {DEVICES[k].label} · {DEVICES[k].w}×{DEVICES[k].h}
          </button>
        ))}
      </div>
    </div>
  );
}

if (web) { const st = document.createElement('style'); st.textContent = 'html, body { overflow-x: hidden; }'; document.head.appendChild(st); }

// ----------------------------------------------------------------------------- column mode (desktop web)
/**
 * Desktop browsers run the SAME app at phone width in the centre of the window (no iframe, no reloads):
 * the browser's visual-viewport width is reported to React Native Web as min(440, window), and #root is
 * centred at that width. The first-launch intro switches to full window (16:9 film) with setFullWindow(true).
 */
export const COLUMN_W = COLUMN.w;
let full = false;
const listeners = new Set<() => void>();
const vv: any = web ? (window as any).visualViewport : null;
const widthDesc = vv ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(vv), 'width') : undefined;
export const realWidth = () => (vv && widthDesc?.get ? widthDesc.get.call(vv) * (vv.scale || 1) : web ? window.innerWidth : 0);

function applyCss() {
  if (!web) return;
  let el = document.getElementById('celeste-column') as HTMLStyleElement | null;
  if (!el) { el = document.createElement('style'); el.id = 'celeste-column'; document.head.appendChild(el); }
  // the laptop template only applies to wide windows; phones (and narrow windows) get the plain full-screen app
  el.textContent = full ? '' : `@media (min-width: ${PHONE_MAX}px) {
    html, body { background: radial-gradient(90% 70% at 50% 0%, #FBF4EF 0%, #F3E2D8 55%, #E9D2C4 100%) fixed !important; }
    #root { position: relative; width: ${COLUMN.w}px !important; max-width: 100vw; margin: 0 auto; box-shadow: 0 0 0 1px rgba(142,74,42,.08), 0 30px 80px -20px rgba(70,35,15,.35); overflow: hidden; } }`;
}
function notify() {
  applyCss();
  try { vv?.dispatchEvent(new Event('resize')); } catch {}
  window.dispatchEvent(new Event('resize'));
  listeners.forEach(f => f());
}
if (webMode === 'column' && vv && widthDesc?.get) {
  Object.defineProperty(vv, 'width', { configurable: true, get() { const w = widthDesc.get!.call(vv); return full || w < PHONE_MAX ? w : Math.min(COLUMN.w, w); } });
  applyCss();
  try { vv.dispatchEvent(new Event('resize')); } catch {}
}
/** The intro plays across the whole window; everything else lives in the phone column. */
export function setFullWindow(on: boolean) { if (webMode !== 'column' || full === on) return; full = on; notify(); }
export function useColumnState() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); listeners.add(f); window.addEventListener('resize', f); return () => { listeners.delete(f); window.removeEventListener('resize', f); }; }, []);
  const real = realWidth();
  return { column: webMode === 'column' && !full && real >= PHONE_MAX, real };
}
