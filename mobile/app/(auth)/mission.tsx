/**
 * Mission length. The ship from the age screen shrinks onto a route; dragging the scale flies it along.
 * The route shape follows the length (orbit → Moon loop → Mars transfer → Jupiter via Mars) but never jumps:
 * every route is resampled to the same number of points, so crossing a band MORPHS the path point by point
 * while the planets glide, grow, shrink and fade between their places. No route names — the mission goal is
 * asked on the next screen.
 * The ship flies on the curve every frame (no springs between points), with an engine plume that grows while
 * it moves, over the user's deep-space nebula.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Floaty, SPACE } from '@/astra';
import Planet from '@/Planet';
import { EASE_OUT, nav } from '@/motion';
import { useDraft, type Destination } from '@/onboarding';
import QuestionScreen, { useHero } from '@/QuestionScreen';

const native = Platform.OS !== 'web';
type Pt = [number, number];
type BodyKey = 'earth' | 'moon' | 'mars' | 'jupiter';
type Geo = { pts: Pt[]; back: Pt[]; backO: number; bodies: Record<BodyKey, { x: number; y: number; r: number; o: number }>; ship: number };
const N = 160;

const bez = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 200): Pt[] => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
});
/** Resample a polyline to N points evenly spaced along its length (so any two routes can be blended). */
function resample(src: Pt[], n = N): Pt[] {
  const cum = [0];
  for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const L = cum[cum.length - 1] || 1, out: Pt[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * L;
    while (j < cum.length - 1 && cum[j] < d) j++;
    const f = (d - cum[j - 1]) / Math.max(1e-6, cum[j] - cum[j - 1]);
    out.push([src[j - 1][0] + (src[j][0] - src[j - 1][0]) * f, src[j - 1][1] + (src[j][1] - src[j - 1][1]) * f]);
  }
  return out;
}

function geoFor(dest: Destination, W: number, h: number): Geo {
  const hidden = (x: number, y: number) => ({ x, y, r: 0, o: 0 });
  switch (dest) {
    case 'orbit': { // tilted ring around a big Earth
      const cx = W * 0.5, cy = h * 0.44, rx = W * 0.4, ry = h * 0.1, rot = -0.2;
      const ring: Pt[] = Array.from({ length: 241 }, (_, i) => {
        const a = Math.PI * 0.55 + (i / 240) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
        return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
      });
      const pts = resample(ring);
      return { pts, back: pts, backO: 0, ship: 54, bodies: { earth: { x: cx, y: cy, r: Math.min(W, h) * 0.17, o: 1 }, moon: hidden(W * 0.8, h * 0.26), mars: hidden(W * 0.72, h * 0.66), jupiter: hidden(W * 0.76, h * 0.34) } };
    }
    case 'moon': { // figure-8 free-return between Earth and Moon
      const E: Pt = [W * 0.22, h * 0.5], M: Pt = [W * 0.78, h * 0.28];
      const cx = (E[0] + M[0]) / 2, cy = (E[1] + M[1]) / 2, ang = Math.atan2(M[1] - E[1], M[0] - E[0]);
      const a = Math.hypot(M[0] - E[0], M[1] - E[1]) / 2 + 26, b = h * 0.22;
      const loop: Pt[] = Array.from({ length: 241 }, (_, i) => {
        const t = -Math.PI / 2 + (i / 240) * Math.PI * 2, x = a * Math.cos(t), y = b * Math.sin(t) * Math.cos(t);
        return [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)];
      });
      const pts = resample(loop);
      return { pts, back: pts, backO: 0, ship: 50, bodies: { earth: { x: E[0], y: E[1], r: 30, o: 1 }, moon: { x: M[0], y: M[1], r: 15, o: 1 }, mars: hidden(W * 0.72, h * 0.66), jupiter: hidden(W * 0.76, h * 0.34) } };
    }
    case 'mars': { // out to Mars and back (return leg dotted)
      const E: Pt = [W * 0.16, h * 0.24], S: Pt = [W * 0.74, h * 0.64];
      return { pts: resample(bez(E, [W * 0.55, h * 0.02], [W * 0.95, h * 0.3], S)), back: resample(bez(S, [W * 0.5, h * 0.62], [W * 0.2, h * 0.52], E)), backO: 0.7, ship: 46,
        bodies: { earth: { x: E[0], y: E[1], r: 18, o: 1 }, moon: hidden(E[0] + 30, E[1] - 20), mars: { x: S[0], y: S[1], r: 26, o: 1 }, jupiter: hidden(W * 0.76, h * 0.34) } };
    }
    case 'jupiter': { // long haul with a Mars fly-by
      const E: Pt = [W * 0.12, h * 0.3], J: Pt = [W * 0.76, h * 0.32];
      const pts = resample(bez(E, [W * 0.3, h * 0.95], [W * 0.62, h * 0.85], J));
      const mid = pts[Math.round(N * 0.48)];
      return { pts, back: pts, backO: 0, ship: 42,
        bodies: { earth: { x: E[0], y: E[1], r: 14, o: 1 }, moon: hidden(E[0] + 20, E[1] - 16), mars: { x: mid[0] + 4, y: mid[1] + 26, r: 11, o: 1 }, jupiter: { x: J[0], y: J[1], r: 40, o: 1 } } };
    }
  }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function blend(a: Geo, b: Geo, t: number): Geo {
  const P = (x: Pt[], y: Pt[]) => x.map((p, i) => [mix(p[0], y[i][0], t), mix(p[1], y[i][1], t)] as Pt);
  const bodies = {} as Geo['bodies'];
  (Object.keys(a.bodies) as BodyKey[]).forEach(k => { const p = a.bodies[k], q = b.bodies[k]; bodies[k] = { x: mix(p.x, q.x, t), y: mix(p.y, q.y, t), r: mix(p.r, q.r, t), o: mix(p.o, q.o, t) }; });
  return { pts: P(a.pts, b.pts), back: P(a.back, b.back), backO: mix(a.backO, b.backO, t), ship: mix(a.ship, b.ship, t), bodies };
}

// continuous bands: the ship rides each route from 12% to 88% and hands over exactly at the band edge
const BANDS: [Destination, number, number][] = [['orbit', 0.5, 1.25], ['moon', 1.25, 2.25], ['mars', 2.25, 4.25], ['jupiter', 4.25, 10]];
const bandOf = (y: number) => BANDS.find(([, , hi]) => y < hi) ?? BANDS[BANDS.length - 1];
const uFor = (y: number) => { const [, lo, hi] = bandOf(y); return 0.12 + 0.76 * Math.min(1, Math.max(0, (y - lo) / (hi - lo))); };
const toD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
const at = (pts: Pt[], u: number): { p: Pt; ang: number } => {
  const x = Math.max(0, Math.min(1, u)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), f = x - i, a = pts[i], b = pts[i + 1];
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], ang: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI };
};

function BodyArt({ k, b }: { k: BodyKey; b: Geo['bodies'][BodyKey] }) {
  if (b.o < 0.02 || b.r < 1) return null;
  const s = b.r * 2;
  const src = k === 'earth' ? SPACE.earth : k === 'mars' ? SPACE.mars : k === 'jupiter' ? SPACE.jupiter : null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: b.x - b.r, top: b.y - b.r, width: s, height: s, opacity: b.o }}>
      <View style={{ position: 'absolute', left: -s * 0.18, top: -s * 0.18, width: s * 1.36, height: s * 1.36, borderRadius: s, backgroundColor: k === 'earth' ? 'rgba(127,178,255,0.16)' : 'rgba(255,214,190,0.16)' }} />
      {src ? <Image source={src} style={{ width: s, height: s }} resizeMode="contain" /> : <Planet k="moon" size={s * 1.4} />}
    </View>
  );
}

export default function Mission() {
  const [d, set] = useDraft();
  const { W, heroH: h } = useHero();
  const [live, setLive] = useState(d.missionYears);
  const dest = bandOf(live)[0];
  const target = useMemo(() => geoFor(dest, W, h), [dest, W, h]);

  // route morph: from → target over 750 ms; re-targeting mid-morph starts from what is on screen
  const [geo, setGeo] = useState<Geo>(target);
  const shown = useRef(geo); shown.current = geo;
  const morph = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const from = shown.current, to = target;
    morph.stopAnimation(); morph.setValue(0);
    const id = morph.addListener(({ value }) => setGeo(blend(from, to, value)));
    Animated.timing(morph, { toValue: 1, duration: 750, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: false }).start();
    return () => morph.removeListener(id);
  }, [target]);

  // ship FLIES along the route: its position along the path (fu) glides toward the ruler's value every frame,
  // so it always travels on the curve (never cuts across or hops), and its nose follows the curve's tangent.
  const u = uFor(live);
  const uRef = useRef(u); uRef.current = u;
  const [fly, setFly] = useState(() => ({ u, ang: at(geo.pts, u).ang, speed: 0 }));
  useEffect(() => {
    let raf = 0, last = Date.now(), cu = uRef.current, ca = at(shown.current.pts, cu).ang, sp = 0;
    const step = () => {
      const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      const prev = cu;
      cu += (uRef.current - cu) * (1 - Math.exp(-dt * 4.2));          // smooth glide toward the target
      const tAng = at(shown.current.pts, cu).ang;
      let da = ((tAng - ca + 540) % 360) - 180;                        // shortest turn
      ca += da * (1 - Math.exp(-dt * 7));
      sp += (Math.min(1, Math.abs(cu - prev) / Math.max(dt, 1e-3) * 1.6) - sp) * (1 - Math.exp(-dt * 6)); // engine thrust 0..1
      setFly(f => (Math.abs(f.u - cu) < 1e-5 && Math.abs(f.ang - ca) < 0.05 && Math.abs(f.speed - sp) < 0.004 ? f : { u: cu, ang: ca, speed: sp }));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);
  const { p } = at(geo.pts, fly.u);
  const ang = fly.ang;
  const shipH = geo.ship / SPACE.shipRatio;

  // entrance: arrives big from the age screen's centre and settles onto its point on the route
  const start = useRef({ x: W / 2 - p[0], y: h * 0.36 - p[1] }).current;
  const off = useRef(new Animated.ValueXY(start)).current;
  const scale = useRef(new Animated.Value(Math.min(W * 0.86, 460) / geo.ship)).current;
  const routeIn = useRef(new Animated.Value(0)).current;
  const flame = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(off, { toValue: { x: 0, y: 0 }, duration: 1500, delay: 250, easing: EASE_OUT, useNativeDriver: native }),
      Animated.timing(scale, { toValue: 1, duration: 1500, delay: 250, easing: EASE_OUT, useNativeDriver: native }),
      Animated.timing(routeIn, { toValue: 1, duration: 900, delay: 900, easing: EASE_OUT, useNativeDriver: native }),
    ]).start();
    const l = Animated.loop(Animated.sequence([
      Animated.timing(flame, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(flame, { toValue: 0.35, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]));
    l.start(); return () => l.stop();
  }, []);
  const rad = (ang * Math.PI) / 180;
  const tail: Pt = [p[0] - Math.cos(rad) * geo.ship * 0.36, p[1] - Math.sin(rad) * geo.ship * 0.36];
  const plume = 10 + fly.speed * 34; // longer exhaust while the ship is actually moving

  if (!d.firstName) return <Redirect href="/name" />;
  const cut = Math.max(1, Math.round(fly.u * (N - 1)));
  const wake = geo.pts.slice(Math.max(0, cut - 14), cut).concat([p]); // glowing wake right behind the ship
  const flown = [...geo.pts.slice(0, cut), p], ahead = [p, ...geo.pts.slice(cut)];
  const order: BodyKey[] = ['earth', 'moon', 'mars', 'jupiter'];

  const hero = (
    <>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: routeIn } as any}>
        {/* the big Earth of the orbit route sits behind the ring; everything else in front */}
        {geo.bodies.earth.r > 34 ? <BodyArt k="earth" b={geo.bodies.earth} /> : null}
        <Svg width={W} height={h} style={{ position: 'absolute' }}>
          {geo.backO > 0.02 ? <Path d={toD(geo.back)} stroke="#F6D2BC" strokeWidth={1.6} strokeDasharray="2 7" strokeLinecap="round" fill="none" opacity={geo.backO} /> : null}
          <Path d={toD(ahead)} stroke="#F6D2BC" strokeWidth={1.8} strokeDasharray="5 7" strokeLinecap="round" fill="none" opacity={0.65} />
          <Path d={toD(flown)} stroke="#F3B48D" strokeWidth={6} strokeLinecap="round" fill="none" opacity={0.18} />
          <Path d={toD(flown)} stroke="#F3B48D" strokeWidth={2.6} strokeLinecap="round" fill="none" />
        </Svg>
        {order.filter(k => !(k === 'earth' && geo.bodies.earth.r > 34)).map(k => <BodyArt key={k} k={k} b={geo.bodies[k]} />)}
      </Animated.View>
      {/* wake + engine plume + ship, all riding the same point on the route */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: routeIn } as any}>
        <Svg width={W} height={h} style={{ position: 'absolute' }}>
          <Path d={toD(wake)} stroke="#FFD9B8" strokeWidth={9} strokeLinecap="round" fill="none" opacity={0.12 + fly.speed * 0.25} />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: off.x }, { translateY: off.y }] }}>
        <Animated.View style={{ position: 'absolute', left: tail[0] - plume, top: tail[1] - 4, width: plume, height: 8, borderRadius: 4, opacity: flame.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.95] }),
          transform: [{ translateX: plume / 2 }, { rotate: `${ang}deg` }, { translateX: -plume / 2 }, { scaleY: flame.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }] }}>
          <LinearGradient colors={['rgba(255,140,70,0)', 'rgba(255,170,100,0.85)', '#FFF3E0']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1, borderRadius: 4 }} />
        </Animated.View>
        <View style={{ position: 'absolute', left: p[0] - geo.ship / 2, top: p[1] - shipH / 2 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Floaty amp={1.2} dur={3600} rotate={0.6}>
              <Image source={SPACE.ship} style={{ width: geo.ship, height: shipH, transform: [{ rotate: `${ang - SPACE.shipNose}deg` }] }} resizeMode="contain" />
            </Floaty>
          </Animated.View>
        </View>
      </Animated.View>
    </>
  );

  return (
    <QuestionScreen
      step={3}
      space
      question="How long is your mission?"
      hero={hero}
      ruler={{ min: 0.5, max: 10, step: 0.5, majorEvery: 1, value: d.missionYears, onChange: v => set({ missionYears: v }), onLive: setLive, format: v => `${v} yr` }}
      value={String(d.missionYears)}
      unit={d.missionYears === 1 ? 'year' : 'years'}
      onBack={() => nav.back('/age')}
      onNext={() => nav.push('/goal')}
    />
  );
}
