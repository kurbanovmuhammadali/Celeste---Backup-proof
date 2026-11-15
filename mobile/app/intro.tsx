/**
 * First-launch intro film (plays once; replay from Profile).
 * Full-screen video with Skip (always visible, as App Review expects) and a sound toggle.
 * The ending dissolves into the Welcome screen's own Mars + ship composition, so the cut is invisible:
 * the Welcome route then mounts in place (nav.seamless) and only its title animates in.
 */
import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, Volume2, VolumeX } from 'lucide-react-native';
import { A } from '@/theme';
import { AstraLogo, IMG, RATIO } from '@/astra';
import { setFlag } from '@/storage';
import { realWidth, setFullWindow } from '@/DeviceFrame';
import { nav } from '@/motion';
import { Txt, haptic } from '@/kit/core';

const native = Platform.OS !== 'web';
const FILM = require('../assets/intro/intro.mp4');
const POSTER = require('../assets/intro/poster.jpg');
// 16:9 cut for Mac / laptop browsers (same film inside an iPhone, with the mission story beside it)
const FILM_WIDE = require('../assets/intro/intro-wide.mp4');
const POSTER_WIDE = require('../assets/intro/poster-wide.jpg');
const DISSOLVE_AT = 0.95; // seconds before the end when the hand-off starts

export default function Intro() {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false); // sound on by default; if the browser refuses, fall back to muted + a clear "sound" button
  const [needsTap, setNeedsTap] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(0)).current;      // 0 film → 1 welcome composition
  const chrome = useRef(new Animated.Value(0)).current;   // skip + progress fade in
  const leaving = useRef(false);

  // desktop web: the film plays across the whole window, the app itself lives in the phone column
  const [wide] = useState(() => !native && realWidth() / H > 1.2);
  useLayoutEffect(() => { if (wide) setFullWindow(true); return () => setFullWindow(false); }, []);
  const player = useVideoPlayer(wide ? FILM_WIDE : FILM, p => {
    p.loop = false;
    p.muted = false;
    p.timeUpdateEventInterval = 0.1;
    p.play();
  });
  const film = useRef(new Animated.Value(1)).current; // the full-window film fades to the page before the column appears

  const finish = (fast = false) => {
    if (leaving.current) return;
    leaving.current = true;
    setFlag('introSeen');
    const handOff = () => Animated.timing(out, { toValue: 1, duration: fast ? 520 : 900, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: native }).start(() => {
      try { player.pause(); } catch {}
      if (replay) { router.back(); return; }
      nav.seamless();
      router.replace('/welcome');
    });
    if (!wide) return handOff();
    // laptop: film fades out across the window → the column (with the Welcome composition) fades in
    Animated.timing(film, { toValue: 0, duration: fast ? 360 : 650, easing: Easing.bezier(0.45, 0, 0.2, 1), useNativeDriver: native }).start(() => {
      try { player.pause(); } catch {}
      setFullWindow(false);
      out.setValue(0);
      requestAnimationFrame(handOff);
    });
  };

  useEffect(() => {
    const subs = [
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') {
          setReady(true);
          if (!leaving.current && !player.playing) player.play();
          Animated.timing(chrome, { toValue: 1, duration: 600, delay: 400, useNativeDriver: native }).start();
        }
        if (status === 'error') finish(true);
      }),
      player.addListener('timeUpdate', ({ currentTime }) => {
        const d = player.duration || 18.75;
        progress.setValue(Math.min(1, currentTime / d));
        if (currentTime >= d - DISSOLVE_AT) finish();
      }),
      player.addListener('playToEnd', () => finish()),
    ];
    // autoplay can be refused (browser policy, Low Power Mode) → offer a tap to play; never strand the user
    // sound-on autoplay is often refused by browsers → retry muted, then show the sound button prominently
    const muteRetry = setTimeout(() => { if (!player.playing && player.currentTime === 0) { player.muted = true; setMuted(true); player.play(); } }, 900);
    const blocked = setTimeout(() => { if (!player.playing && player.currentTime === 0) setNeedsTap(true); }, 2200);
    const guard = setTimeout(() => { if (player.status !== 'readyToPlay' && player.currentTime === 0) finish(true); }, 12000);
    return () => { subs.forEach(s => s.remove()); clearTimeout(guard); clearTimeout(blocked); clearTimeout(muteRetry); };
  }, [player]);

  const toggleSound = () => { haptic.tap(); const m = !muted; setMuted(m); player.muted = m; if (!player.playing) player.play(); };
  const shipW = Math.min(W * 0.78, 420);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F1EC', overflow: 'hidden' }}>
      {/* poster until the first frame is ready */}
      {!ready ? <Image source={wide ? POSTER_WIDE : POSTER} resizeMode="cover" style={{ position: 'absolute', width: W, height: H }} /> : null}
      <Animated.View style={{ position: 'absolute', width: W, height: H, opacity: film, transform: [{ scale: out.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }}>
        <VideoView player={player} style={{ width: W, height: H }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} {...({ fullscreenOptions: { enable: false } } as any)} />
      </Animated.View>

      {/* the Welcome screen's composition, dissolving in over the film's last second */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: W, height: H, opacity: out }}>
        <View style={{ position: 'absolute', width: W, height: H, backgroundColor: A.sand }} />
        <Image source={IMG.mars} resizeMode="cover" style={{ position: 'absolute', top: 0, left: 0, width: W, height: H * 0.72 }} />
        <LinearGradient colors={['rgba(248,238,232,0)', 'rgba(248,238,232,0.55)', A.sand]} locations={[0.35, 0.62, 0.9]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.72 }} />
        <View style={{ position: 'absolute', top: H * 0.1, right: -shipW * 0.12, transform: [{ translateY: -7 }, { rotate: '-1.5deg' }] }}>
          <Image source={IMG.ship} style={{ width: shipW, height: shipW / RATIO.ship }} resizeMode="contain" />
        </View>
        <View style={{ position: 'absolute', top: insets.top + 16, left: 24 }}><AstraLogo color="#fff" star={A.copperSoft} /></View>
      </Animated.View>

      {needsTap ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Play intro" onPress={() => { setNeedsTap(false); player.play(); }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}><Play size={28} color={A.copper} fill={A.copper} /></View>
          <Txt v="subM" color={A.ink2} style={{ marginTop: 12 }}>Tap to play the intro</Txt>
        </Pressable>
      ) : null}

      {/* chrome */}
      <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: Animated.multiply(chrome, out.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' })) }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={() => { haptic.tap(); finish(true); }} hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 12, right: 18, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 999, paddingHorizontal: 16, height: 34, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(142,74,42,0.12)' }}>
          <Txt v="subM" color={A.ink}>Skip</Txt>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Turn sound on' : 'Mute'} onPress={toggleSound} hitSlop={10}
          style={{ position: 'absolute', bottom: insets.bottom + 26, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(142,74,42,0.12)' }}>
          {muted ? <VolumeX size={17} color={A.ink} /> : <Volume2 size={17} color={A.ink} />}
        </Pressable>
        <View pointerEvents="none" style={{ position: 'absolute', left: 22, right: 72, bottom: insets.bottom + 44, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(43,30,24,0.12)', overflow: 'hidden' }}>
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', backgroundColor: A.copper, transformOrigin: 'left', transform: [{ scaleX: progress }] } as any} />
        </View>
      </Animated.View>
    </View>
  );
}
