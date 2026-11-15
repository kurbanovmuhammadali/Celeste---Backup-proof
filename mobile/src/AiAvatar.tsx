/**
 * Celeste's AI avatar (the user's copper planet with its ring) and its first-meeting animation.
 *
 * AiAvatar — floats, breathes; listening = the sphere glows and swells with your voice (live mic level) and settles
 *            back when you stop; thinking = a dashed orbit spins; speaking = gentle beat.
 * AiIntro  — plays once, the first time the assistant opens (from the user's sketch):
 *   1. a straight copper line draws across the screen;
 *   2. the comet (rock + fire trail) streaks in from the top right toward the line;
 *   3. it strikes — a flash, a small shake — and the line WRAPS around it, closing into the ring;
 *   4. the rock turns into the avatar planet, settling exactly where the assistant's avatar lives;
 *   5. "Hello, <name>" rises underneath. Then the overlay fades and the real screen is already in place.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useMicLevel } from './micLevel';
import { native } from './kit/tokens';
import { Txt, haptic } from './kit/core';
import { K } from './kit/tokens';

export const AI = { avatar: require('../assets/ai/avatar.png'), comet: require('../assets/ai/comet.png'), trail: require('../assets/ai/trail.png'), trailRatio: 700 / 309 };
export type AvatarState = 'ready' | 'listening' | 'thinking' | 'speaking';
const RING = 0.47; // ring radius as a fraction of the avatar image size
const TRAIL_ANG = -21; // the trail image's own head→tail angle (degrees)

export function AiAvatar({ size, state = 'ready' }: { size: number; state?: AvatarState }) {
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const f = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
      Animated.timing(float, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
    ]));
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: native }));
    f.start(); s.start();
    return () => { f.stop(); s.stop(); };
  }, []);
  useEffect(() => {
    pulse.setValue(0);
    const d = state === 'listening' ? 1100 : state === 'speaking' ? 700 : 2600;
    const l = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: d, easing: Easing.out(Easing.quad), useNativeDriver: native }));
    l.start(); return () => l.stop();
  }, [state]);
  const halo = state === 'listening' ? 0.5 : state === 'speaking' ? 0.35 : 0.18;
  const voice = useMicLevel(state === 'listening'); // 0…1, springs back to 0 when listening stops
  const glowId = React.useMemo(() => 'sg' + Math.random().toString(36).slice(2, 7), []);
  const G = size * 1.7;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel={`Celeste is ${state}`}>
      {/* living glow: brightens and spreads with the voice */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: G, height: G, left: (size - G) / 2, top: (size - G) / 2,
        opacity: voice.interpolate({ inputRange: [0, 0.6], outputRange: [state === 'listening' ? 0.35 : 0, 1], extrapolate: 'clamp' }),
        transform: [{ scale: voice.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35], extrapolate: 'clamp' }) }] }}>
        <Svg width={G} height={G}>
          <Defs><RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <Stop offset="0.3" stopColor="#FFB27A" stopOpacity={0.75} />
            <Stop offset="0.6" stopColor="#EE8F6A" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#EE8F6A" stopOpacity={0} />
          </RadialGradient></Defs>
          <Circle cx={G / 2} cy={G / 2} r={G / 2} fill={`url(#${glowId})`} />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size * 0.8, height: size * 0.8, borderRadius: size, backgroundColor: 'rgba(238,143,106,0.35)',
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [halo, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] }) }] }} />
      {state === 'thinking' ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size * 1.02, height: size * 1.02, borderRadius: size, borderWidth: 1.5, borderColor: K.copper, borderStyle: 'dashed', opacity: 0.6,
          transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
      ) : null}
      <Animated.View style={{ transform: [{ scale: voice.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2], extrapolate: 'clamp' }) }] }}>
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-size * 0.025, size * 0.025] }) },
          { scale: state === 'speaking' ? pulse.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 1.035, 1] }) : 1 }] }}>
          <Image source={AI.avatar} style={{ width: size, height: size }} resizeMode="contain" accessibilityIgnoresInvertColors />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** `box` = where the avatar sits, in this overlay's coordinates. */
export function AiIntro({ box, W, H, name, onDone }: { box: { x: number; y: number; size: number }; W: number; H: number; name: string; onDone: () => void }) {
  const t = useRef(new Animated.Value(0)).current;           // master timeline 0 → 1 (4.6 s)
  const [ring, setRing] = useState({ rx: W * 0.36, ry: 0.5 });
  const bg = useRef(new Animated.Value(1)).current;
  const D = 4600;
  const at = (ms: number) => ms / D;
  useEffect(() => {
    const cx = W * 0.36, R = box.size * RING;
    const id = t.addListener(({ value }) => {
      const k = Math.min(1, Math.max(0, (value - at(1750)) / (at(2550) - at(1750))));
      const e = 1 - Math.pow(1 - k, 3);
      setRing({ rx: cx + (R - cx) * e, ry: 0.5 + (R * 0.98 - 0.5) * e });
    });
    const hit = setTimeout(() => haptic.firm(), 1750);
    Animated.timing(t, { toValue: 1, duration: D, easing: Easing.linear, useNativeDriver: false }).start(() => {
      Animated.timing(bg, { toValue: 0, duration: 380, useNativeDriver: native }).start(onDone);
    });
    return () => { t.removeListener(id); clearTimeout(hit); };
  }, []);

  const cx = box.x + box.size / 2, cy = box.y + box.size / 2;
  const seg = (a: number, b: number, from = 0, to = 1, ease = (x: number) => x) => t.interpolate({ inputRange: [at(a), at(b)], outputRange: [from, to], extrapolate: 'clamp', easing: ease });
  const outE = Easing.out(Easing.cubic), inE = Easing.in(Easing.quad);
  // comet path: from top-right off-screen to the impact point
  const sx = W + 80, sy = cy - H * 0.42;
  const fly = seg(450, 1750, 0, 1, inE);
  const tailAng = (Math.atan2(sy - cy, sx - cx) * 180) / Math.PI; // direction the tail should point
  const cometSize = box.size * 0.36, tw = cometSize * 3.4, th = tw / AI.trailRatio;
  const shake = t.interpolate({ inputRange: [at(1750), at(1800), at(1850), at(1900), at(1950), at(2000)], outputRange: [0, 6, -5, 3, -2, 0], extrapolate: 'clamp' });

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, opacity: bg }}>
      <View style={{ position: 'absolute', inset: 0, backgroundColor: K.canvas } as any} />
      <Animated.View style={{ position: 'absolute', inset: 0, transform: [{ translateX: shake }, { translateY: Animated.multiply(shake, -0.6) }] } as any}>
        {/* 1 + 3: the line, which wraps into the ring */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: Animated.multiply(seg(1740, 1760), seg(2700, 3200, 1, 0)) }}>
          <Svg width={W} height={H}>
            <Ellipse cx={cx} cy={cy} rx={ring.rx} ry={ring.ry} stroke={K.copper} strokeWidth={2.2} fill="none" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: cx - W * 0.36, top: cy - 1, width: W * 0.72, height: 2, backgroundColor: K.copper, opacity: seg(1740, 1760, 1, 0), transform: [{ scaleX: seg(0, 520, 0, 1, outE) }] }} />
        {/* 2: comet with its fire trail */}
        <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity: Animated.multiply(seg(450, 650), seg(1750, 2300, 1, 0)),
          transform: [{ translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [sx - cometSize / 2, cx - cometSize / 2] }) }, { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [sy - cometSize / 2, cy - cometSize / 2] }) }] }}>
          <View style={{ width: cometSize, height: cometSize }}>
            {/* the trail's bright head (≈6%, 88% of the image) sits on the rock; rotate about it so the tail points back along the path */}
            <View style={{ position: 'absolute', left: cometSize / 2, top: cometSize / 2, width: 0, height: 0, transform: [{ rotate: `${tailAng - TRAIL_ANG}deg` }] }}>
              <Image source={AI.trail} style={{ position: 'absolute', width: tw, height: th, left: -tw * 0.06, top: -th * 0.88, opacity: 0.95 }} resizeMode="contain" />
            </View>
            <Image source={AI.comet} style={{ width: cometSize, height: cometSize }} resizeMode="contain" />
          </View>
        </Animated.View>
        {/* impact flash */}
        <Animated.View style={{ position: 'absolute', left: cx - box.size * 0.5, top: cy - box.size * 0.5, width: box.size, height: box.size, borderRadius: box.size, backgroundColor: '#FFE7D6',
          opacity: Animated.multiply(seg(1740, 1760), seg(1760, 2250, 0.9, 0)), transform: [{ scale: seg(1750, 2250, 0.2, 1.6, outE) }] }} />
        {/* 4: the rock becomes the avatar, in its final place */}
        <Animated.View style={{ position: 'absolute', left: box.x, top: box.y, width: box.size, height: box.size, opacity: seg(2100, 2900), transform: [{ scale: seg(2100, 3100, 0.55, 1, Easing.out(Easing.back(1.4))) }] }}>
          <Image source={AI.avatar} style={{ width: box.size, height: box.size }} resizeMode="contain" />
        </Animated.View>
        {/* 5: hello */}
        {/* where the assistant's own title sits (above the avatar), so the hand-off is invisible */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: box.y - 76, alignItems: 'center', opacity: seg(3100, 3600), transform: [{ translateY: seg(3100, 3700, 14, 0, outE) }] }}>
          <Txt v="display" center>Hello, {name}</Txt>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
