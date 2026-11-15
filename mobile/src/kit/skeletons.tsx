/**
 * Loading skeletons shaped like the page that is about to appear (the user's grey layout idea, per page).
 * On reload the user already sees where the hazard rings, the route, the stat tiles or the chat input will be,
 * then the real content fades in on top. One shimmer sweeps across all bones in sync.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, View, ViewStyle, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MOTION, native, web } from './tokens';
import { useLoop } from './core';

const BG = '#ECEDEF';     // page
const BONE = '#E2E3E5';   // block
const SHELL = '#F5F5F6';  // card that holds smaller bones

export type SkeletonKind = 'home' | 'mission' | 'training' | 'ai' | 'body' | 'profile' | 'list' | 'page' | 'auth' | 'blank';

/** Which skeleton matches a route. On web the address bar wins: during a reload the router may not know the route yet. */
export function skeletonKind(routerPath: string, routerTab?: string): SkeletonKind {
  const loc = web && typeof window !== 'undefined' ? window.location : null;
  const path = loc?.pathname || routerPath;
  const tab = (loc && new URLSearchParams(loc.search).get('tab')) || routerTab;
  if (path === '/intro') return 'blank';
  if (path === '/' || path.startsWith('/today')) return 'home';
  if (path.startsWith('/hazards') || path.startsWith('/plan')) return tab === 'training' || path.startsWith('/plan') ? 'training' : 'mission';
  if (path.startsWith('/assistant')) return 'ai';
  if (path.startsWith('/body')) return 'body';
  if (path === '/profile') return 'profile';
  if (path.startsWith('/profile') || path.startsWith('/check') || path.startsWith('/integrations')) return 'list';
  if (['/welcome', '/name', '/age', '/mission', '/goal', '/email', '/code', '/face', '/login', '/done'].includes(path)) return 'auth';
  return 'page';
}

const Sweep = createContext<Animated.Value | null>(null);

function Bone({ w = '100%', h, r = 14, style, light }: { w?: number | `${number}%`; h: number; r?: number; style?: StyleProp<ViewStyle>; light?: boolean }) {
  const a = useContext(Sweep);
  return (
    <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: light ? SHELL : BONE, overflow: 'hidden' }, style]}>
      {a ? (
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 260, transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-300, 1400] }) }] }}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
        </Animated.View>
      ) : null}
    </View>
  );
}
const Shell = ({ children, style, pad = 12, r = 20 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: number; r?: number }) =>
  <View style={[{ backgroundColor: SHELL, borderRadius: r, padding: pad }, style]}>{children}</View>;
const Row = ({ children, gap = 8, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) =>
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
const Flex = ({ children, f = 1 }: { children: React.ReactNode; f?: number }) => <View style={{ flex: f, minWidth: 0 }}>{children}</View>;
const Two = ({ wide, a, b, ratio = [1.1, 1] }: { wide: boolean; a: React.ReactNode; b: React.ReactNode; ratio?: [number, number] }) =>
  wide ? <View style={{ flexDirection: 'row', gap: 28, alignItems: 'flex-start' }}><Flex f={ratio[0]}>{a}</Flex><Flex f={ratio[1]}>{b}</Flex></View> : <View>{a}{b}</View>;

/** Header row of a tab page: title on the left, status pills on the right. */
function Head({ title = 110, pills = [92, 44] }: { title?: number; pills?: number[] }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Bone w={title} h={18} r={9} />
      <Row gap={6}>{pills.map((w, i) => <Bone key={i} w={w} h={28} r={14} />)}</Row>
    </Row>
  );
}

function ListRows({ n = 3 }: { n?: number }) {
  return (
    <Shell pad={4} r={22}>
      {Array.from({ length: n }, (_, i) => (
        <Row key={i} gap={12} style={{ paddingHorizontal: 12, height: 58, borderTopWidth: i ? 1 : 0, borderTopColor: BG }}>
          <Bone w={30} h={30} r={10} />
          <View style={{ flex: 1, gap: 6 }}><Bone w="55%" h={11} r={6} /><Bone w="78%" h={8} r={4} /></View>
          <Bone w={10} h={14} r={3} />
        </Row>
      ))}
    </Shell>
  );
}

// ----------------------------------------------------------------------------- per page
function HomeSkel({ wide }: { wide: boolean }) {
  const rings = (
    <Row gap={6} style={{ marginTop: 10 }}>
      {[0, 1, 2, 3, 4].map(i => <Shell key={i} pad={9} r={16} style={{ flex: 1, alignItems: 'center', gap: 6 }}><Bone w={34} h={34} r={17} /><Bone w="70%" h={6} r={3} /></Shell>)}
    </Row>
  );
  const attention = (
    <Shell r={22} pad={14} style={{ marginTop: 10, gap: 8 }}>
      <Bone w={110} h={9} r={5} /><Bone w="70%" h={16} r={8} /><Bone w="92%" h={10} r={5} /><Bone w="60%" h={10} r={5} />
      <Bone h={38} r={14} light style={{ backgroundColor: BONE, opacity: 0.6, marginTop: 4 }} />
      <Row style={{ marginTop: 2 }}><Flex><Bone h={42} r={21} /></Flex><Flex><Bone h={42} r={21} /></Flex></Row>
    </Shell>
  );
  const route = (
    <View style={{ height: 200, marginTop: 14 }}>
      <Svg width="100%" height={200} viewBox="0 0 360 200" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Path d="M25 32 C 50 215, 215 210, 300 60" stroke={BONE} strokeWidth={3} strokeDasharray="6 8" strokeLinecap="round" fill="none" />
      </Svg>
      <Bone w={26} h={26} r={13} style={{ position: 'absolute', left: '5%', top: 18 }} />
      <Bone w={56} h={56} r={28} style={{ position: 'absolute', right: '10%', top: 32 }} />
      <Bone w={64} h={30} r={10} style={{ position: 'absolute', left: '34%', top: 134 }} />
    </View>
  );
  const stats = (
    <View>
      <Bone h={40} r={20} style={{ marginTop: 6 }} />
      <Row style={{ justifyContent: 'space-between', marginTop: 18, marginBottom: 10 }}><Bone w={140} h={18} r={9} /><Bone w={96} h={10} r={5} /></Row>
      <Shell pad={8} style={{ gap: 8 }}>
        {[0, 1].map(r => (
          <Row key={r}>{[0, 1].map(c => (
            <Flex key={c}><View style={{ backgroundColor: '#FBFBFC', borderRadius: 18, padding: 10, gap: 8 }}>
              <Row><Bone w={30} h={30} r={15} /><Bone w="45%" h={9} r={5} /></Row>
              <Bone w="62%" h={20} r={8} /><Bone h={20} r={6} /><Bone w="55%" h={7} r={4} />
            </View></Flex>
          ))}</Row>
        ))}
      </Shell>
      <Row gap={10} style={{ marginTop: 10 }}>
        <Flex><Shell r={20} style={{ height: 236, alignItems: 'center', gap: 14 }}><Bone w="50%" h={14} r={7} style={{ alignSelf: 'flex-start' }} /><Bone w={112} h={112} r={56} /></Shell></Flex>
        <Flex><Shell r={20} style={{ height: 236, gap: 10 }}><Bone w="50%" h={14} r={7} /><Bone w="60%" h={22} r={8} />
          {[0, 1, 2, 3].map(r => <Row key={r} style={{ justifyContent: 'space-between' }}>{[0, 1, 2, 3, 4, 5, 6].map(c => <Bone key={c} w={11} h={11} r={6} />)}</Row>)}
        </Shell></Flex>
      </Row>
    </View>
  );
  return (
    <View>
      <Row style={{ justifyContent: 'space-between' }}><Bone w={84} h={16} r={8} /><Row gap={6}><Bone w={110} h={28} r={14} /><Bone w={44} h={28} r={14} /><Bone w={70} h={28} r={14} /></Row></Row>
      <Two wide={wide} ratio={[1.15, 1]}
        a={<View><Row style={{ justifyContent: 'space-between', marginTop: 20 }}><Bone w={150} h={18} r={9} /><Bone w={120} h={20} r={10} /></Row>{rings}{attention}{wide ? stats : null}</View>}
        b={<View>{route}{wide ? <Row gap={10} style={{ marginTop: 14 }}><Flex><Bone h={168} r={20} /></Flex><Flex><Bone h={168} r={20} /></Flex></Row> : stats}</View>} />
    </View>
  );
}

function MissionSkel({ wide, training }: { wide: boolean; training?: boolean }) {
  const hazards = (
    <View style={{ gap: 8 }}>
      {[0, 1, 2, 3, 4].map(i => (
        <Shell key={i} r={20} pad={14}><Row gap={12}><Bone w={36} h={36} r={18} /><View style={{ flex: 1, gap: 6 }}><Bone w="45%" h={12} r={6} /><Bone w="80%" h={9} r={5} /></View><Bone w={14} h={10} r={3} /></Row></Shell>
      ))}
    </View>
  );
  const side = (
    <View style={{ gap: 10, marginTop: wide ? 0 : 14 }}>
      <Shell r={20} pad={14} style={{ gap: 7 }}><Row style={{ justifyContent: 'space-between', marginBottom: 4 }}><Bone w={100} h={12} r={6} /><Bone w={80} h={9} r={5} /></Row>
        {[0, 1, 2, 3, 4].map(i => <Bone key={i} h={9} r={3} />)}
        <Row style={{ marginTop: 4 }}><Bone w={56} h={22} r={11} /><Bone w="60%" h={9} r={5} /></Row>
      </Shell>
      <Shell r={20} pad={14}><Row gap={12}><Bone w={36} h={36} r={18} /><View style={{ flex: 1, gap: 6 }}><Bone w="40%" h={8} r={4} /><Bone w="65%" h={12} r={6} /></View></Row></Shell>
      <Row><Flex><Shell r={20} style={{ height: 112, gap: 8 }}><Bone w={32} h={32} r={16} /><Bone w="60%" h={11} r={6} /><Bone w="80%" h={8} r={4} /></Shell></Flex><Flex><Shell r={20} style={{ height: 112, gap: 8 }}><Bone w={32} h={32} r={16} /><Bone w="60%" h={11} r={6} /><Bone w="80%" h={8} r={4} /></Shell></Flex></Row>
    </View>
  );
  const train = (
    <Two wide={wide}
      a={<View><Bone h={wide ? 280 : 200} r={22} /><Row style={{ marginTop: 10 }}>{[0, 1, 2].map(i => <Flex key={i}><Shell r={20} style={{ height: 112, gap: 8 }}><Bone w={32} h={32} r={16} /><Bone w="70%" h={11} r={6} /><Bone w="90%" h={8} r={4} /></Shell></Flex>)}</Row></View>}
      b={<View style={{ gap: 10, marginTop: wide ? 0 : 12 }}>
        <Shell r={20} pad={16} style={{ gap: 10 }}><Bone w={80} h={9} r={5} /><Bone w={140} h={28} r={10} /><Bone h={8} r={4} /><Row gap={5}>{[0, 1, 2, 3, 4, 5, 6].map(i => <Flex key={i}><Bone h={46} r={14} /></Flex>)}</Row></Shell>
        <Shell r={20} style={{ height: 130 }}><Bone w={130} h={12} r={6} /></Shell>
      </View>} />
  );
  return (
    <View>
      <Head title={80} pills={[130, 44]} />
      <Bone h={44} r={18} style={{ marginTop: 10, maxWidth: wide ? 420 : undefined }} />
      {training ? <View style={{ marginTop: 14 }}>{train}</View> : (
        <View>
          <View style={{ gap: 8, marginTop: 14 }}><Bone w={150} h={9} r={5} /><Bone w={210} h={24} r={10} /><Bone w="80%" h={11} r={6} /></View>
          <View style={{ marginTop: 14 }}><Two wide={wide} a={hazards} b={side} /></View>
        </View>
      )}
    </View>
  );
}

function AiSkel() {
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ justifyContent: 'space-between' }}><Bone w={70} h={18} r={9} /><Row><Bone w={34} h={34} r={17} /><Bone w={34} h={34} r={17} /></Row></Row>
      <View style={{ alignItems: 'center', marginTop: 56, gap: 12 }}>
        <Bone w={128} h={128} r={64} />
        <Bone w={190} h={24} r={10} style={{ marginTop: 10 }} />
        <Bone w={250} h={11} r={6} />
        <View style={{ gap: 8, marginTop: 22, alignItems: 'center' }}>{[220, 260, 200].map((w, i) => <Bone key={i} w={w} h={40} r={20} />)}</View>
      </View>
      <View style={{ flex: 1 }} />
      <Bone h={54} r={27} style={{ marginBottom: 96 }} />
    </View>
  );
}

function BodySkel({ wide }: { wide: boolean }) {
  const viewer = (
    <Shell r={24} style={{ height: wide ? 640 : 470, alignItems: 'center', paddingTop: 40 }}>
      <Bone w={58} h={58} r={29} />
      <Bone w={120} h={170} r={44} style={{ marginTop: 10 }} />
      <Row gap={12} style={{ marginTop: 6 }}><Bone w={40} h={150} r={20} /><Bone w={40} h={150} r={20} /></Row>
      <Bone w={14} h={14} r={7} style={{ position: 'absolute', top: 150, left: '58%' }} />
      <Bone w={14} h={14} r={7} style={{ position: 'absolute', top: 250, left: '40%' }} />
    </Shell>
  );
  const side = (
    <View style={{ marginTop: wide ? 0 : 20 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Bone w={90} h={16} r={8} /><Bone w={80} h={9} r={5} /></Row>
      <ListRows n={4} />
      <Shell r={20} style={{ height: 84, marginTop: 14, gap: 8 }}><Bone w="50%" h={8} r={4} /><Bone w="70%" h={14} r={7} /></Shell>
    </View>
  );
  return <View><Head title={120} pills={[80]} /><View style={{ marginTop: 14 }}><Two wide={wide} ratio={[1.25, 1]} a={viewer} b={side} /></View></View>;
}

function ProfileSkel({ wide }: { wide: boolean }) {
  const card = (
    <View style={{ alignItems: 'center', gap: 10, paddingTop: 10 }}>
      <Bone w={96} h={96} r={48} />
      <Bone w={160} h={22} r={10} style={{ marginTop: 6 }} />
      <Bone w={200} h={11} r={6} />
      <Row gap={6} style={{ marginTop: 4 }}><Bone w={80} h={26} r={13} /><Bone w={96} h={26} r={13} /></Row>
    </View>
  );
  const lists = <View style={{ gap: 18, marginTop: wide ? 0 : 24 }}>{[3, 3, 2].map((n, i) => <View key={i} style={{ gap: 8 }}><Bone w={110} h={9} r={5} style={{ marginLeft: 6 }} /><ListRows n={n} /></View>)}</View>;
  return <View><Head title={90} pills={[44]} /><View style={{ marginTop: 18 }}><Two wide={wide} ratio={[0.8, 1.2]} a={card} b={lists} /></View></View>;
}

function ListSkel({ wide }: { wide: boolean }) {
  return (
    <View>
      <Row><Bone w={28} h={28} r={14} /><Bone w={130} h={18} r={9} /></Row>
      <View style={{ gap: 8, marginTop: 20 }}><Bone w={120} h={9} r={5} /><Bone w={230} h={26} r={10} /><Bone w="75%" h={11} r={6} /></View>
      <View style={{ marginTop: 18 }}><Two wide={wide} a={<View style={{ gap: 14 }}><ListRows n={3} /><ListRows n={2} /></View>} b={<View style={{ gap: 14, marginTop: wide ? 0 : 14 }}><ListRows n={3} /></View>} /></View>
    </View>
  );
}

function PageSkel({ wide }: { wide: boolean }) {
  return (
    <View>
      <Row><Bone w={28} h={28} r={14} /><Bone w={130} h={18} r={9} /></Row>
      <View style={{ gap: 8, marginTop: 20 }}><Bone w={120} h={9} r={5} /><Bone w={230} h={26} r={10} /><Bone w="75%" h={11} r={6} /></View>
      <View style={{ marginTop: 18 }}><Two wide={wide}
        a={<View style={{ gap: 10 }}><Bone h={wide ? 260 : 200} r={22} /><Row><Flex><Bone h={90} r={20} /></Flex><Flex><Bone h={90} r={20} /></Flex></Row></View>}
        b={<View style={{ gap: 10, marginTop: wide ? 0 : 10 }}><ListRows n={4} /></View>} /></View>
    </View>
  );
}

function AuthSkel() {
  return (
    <View style={{ flex: 1 }}>
      <Bone w={90} h={18} r={9} />
      <View style={{ gap: 12, marginTop: 70 }}><Bone w="80%" h={32} r={12} /><Bone w="55%" h={32} r={12} /><Bone w="70%" h={12} r={6} style={{ marginTop: 6 }} /></View>
      <Bone h={56} r={18} style={{ marginTop: 34 }} />
      <View style={{ flex: 1 }} />
      <Bone h={54} r={27} style={{ marginBottom: 28 }} />
    </View>
  );
}

function Rail() {
  return (
    <View style={{ width: 252, padding: 28, gap: 14, borderRightWidth: 1, borderRightColor: BONE }}>
      <Bone w={120} h={18} r={9} />
      <View style={{ height: 18 }} />
      {[0, 1, 2, 3, 4].map(i => <Bone key={i} h={40} r={14} />)}
      <View style={{ height: 10 }} />
      {[0, 1, 2, 3].map(i => <Bone key={i} w="70%" h={14} r={7} />)}
    </View>
  );
}

function Dock() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 14, right: 14, bottom: Math.max(insets.bottom - 6, 12), height: 64, borderRadius: 32, backgroundColor: '#F4F4F5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10 }}>
      {[0, 1, 2, 3, 4].map(i => <View key={i} style={{ alignItems: 'center', gap: 5 }}><Bone w={22} h={22} r={11} /><Bone w={34} h={6} r={3} /></View>)}
    </View>
  );
}

/** Whole-screen skeleton for one page kind (phone, or laptop with the left rail). */
export function PageSkeleton({ tabs = true, kind = 'home' }: { tabs?: boolean; kind?: SkeletonKind }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const sweep = useLoop(1500);
  if (kind === 'blank') return <View style={{ flex: 1, backgroundColor: '#F8EEE8' }} />;
  const laptop = web && width >= 1024;
  const isTab = ['home', 'mission', 'training', 'ai', 'body', 'profile'].includes(kind);
  const body = kind === 'home' ? <HomeSkel wide={laptop} /> : kind === 'mission' ? <MissionSkel wide={laptop} /> : kind === 'training' ? <MissionSkel wide={laptop} training />
    : kind === 'ai' ? <AiSkel /> : kind === 'body' ? <BodySkel wide={laptop} /> : kind === 'profile' ? <ProfileSkel wide={laptop} /> : kind === 'list' ? <ListSkel wide={laptop} />
    : kind === 'auth' ? <AuthSkel /> : <PageSkel wide={laptop} />;
  const content = (
    <View style={{ flex: 1, paddingTop: laptop ? 30 : insets.top + 12, paddingHorizontal: laptop ? 36 : 20, overflow: 'hidden' }}>
      <View style={{ width: '100%', maxWidth: laptop ? 1180 : 560, alignSelf: 'center', flex: 1 }}>{body}</View>
    </View>
  );
  return (
    <Sweep.Provider value={sweep}>
      <View style={{ flex: 1, flexDirection: laptop && kind !== 'auth' ? 'row' : 'column', backgroundColor: BG }} accessibilityLabel="Loading" accessibilityRole="progressbar">
        {laptop && kind !== 'auth' ? <Rail /> : null}
        {content}
        {!laptop && tabs && isTab ? <Dock /> : null}
      </View>
    </Sweep.Provider>
  );
}

/** Covers the app on every (re)load until fonts, sign-in state and stored data are ready, then fades away. */
export function BootSkeleton({ ready, kind }: { ready: boolean; kind?: SkeletonKind }) {
  const [gone, setGone] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  // keep the shape of the page that was opened: the router can pass through other routes while it boots
  const first = useRef(kind).current;
  useEffect(() => { const t = setTimeout(() => setMinDone(true), 700); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready && minDone) Animated.timing(fade, { toValue: 0, duration: 420, easing: MOTION.out, useNativeDriver: native }).start(() => setGone(true)); }, [ready, minDone]);
  if (gone) return null;
  return (
    <Animated.View pointerEvents={ready && minDone ? 'none' : 'auto'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fade, zIndex: 1000,
      transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [1.015, 1] }) }] }}>
      <PageSkeleton kind={first ?? kind} />
    </Animated.View>
  );
}
