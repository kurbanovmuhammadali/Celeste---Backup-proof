import React, { useState } from 'react';
import { View } from 'react-native';
import { nav } from '@/motion';
import { Press } from '@/astra';
import { A } from '@/theme';
import { T } from '@/ui';
import { FormShell, Input, Star } from '@/astra';
import { useDraft } from '@/onboarding';
import { useAuth } from '@/auth';
import { api } from '@/api';
import FaceScan from '@/kit/FaceScan';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Crew log in: accounts are prepared by the mission, so it's just email → 4-digit code. */
export default function Login() {
  const [d, set] = useDraft();
  const { requestCode, faceLogin, demoLogin } = useAuth();
  const [demoOn, setDemoOn] = useState(false);
  React.useEffect(() => { api<{ demoAccounts?: boolean }>('/api/health').then(h => setDemoOn(!!h.demoAccounts)).catch(() => {}); }, []);
  const tryDemo = async (as: 'astronaut' | 'doctor' | 'leader') => { setBusy(true); setErr(null); try { await demoLogin(as); nav.replace(as === 'astronaut' ? '/today' : as === 'leader' ? '/admin/leader' : '/admin'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); } };
  const [faceOk, setFaceOk] = useState(false), [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = EMAIL_RE.test(d.email.trim());
  React.useEffect(() => { // offer face sign-in only when this email has a face enrolled
    setFaceOk(false); if (!valid) return;
    const t = setTimeout(() => api<{ available: boolean }>(`/api/auth/face/available?email=${encodeURIComponent(d.email.trim())}`).then(r => setFaceOk(r.available)).catch(() => {}), 400);
    return () => clearTimeout(t);
  }, [d.email, valid]);
  const byFace = async (descs: number[][]) => {
    setScan(false); setBusy(true); setErr(null);
    try { await faceLogin(d.email.trim(), descs[0]); nav.replace('/today'); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const next = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await requestCode(d.email.trim(), 'login');
      set({ devCode: r.devCode ?? '' });
      nav.push({ pathname: '/code', params: { purpose: 'login' } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <FormShell title="Log in" sub="Crew accounts are set up by your mission. Enter your email and we’ll send you a code."
      top={<View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: A.copper, alignItems: 'center', justifyContent: 'center', marginTop: 12, marginBottom: 14 }}><Star size={30} color="#fff" /></View>}
      onBack={() => nav.back('/welcome')} onNext={next} nextDisabled={!valid} nextLoading={busy} nextLabel="Send code">
      <Input label="Email" required value={d.email} onChangeText={v => { set({ email: v }); setErr(null); }} valid={valid} placeholder="name@crew.agency"
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" focusOnEnter
        returnKeyType="send" onSubmitEditing={() => valid && next()} error={err} />
      {scan ? <View style={{ marginTop: 16 }}><FaceScan mode="login" onDone={byFace} onCancel={() => setScan(false)} /></View> : faceOk ? (
        <Press onPress={() => setScan(true)} label="Sign in with my face" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16, padding: 14, borderRadius: 18, backgroundColor: A.copper }}>
          <T size={15} weight="m" color="#fff">Sign in with my face</T>
        </Press>
      ) : null}
      {demoOn ? (
        <View style={{ marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.75)', borderWidth: 1, borderColor: A.line }}>
          <T size={13.5} weight="m" color={A.ink}>Judges: try a demo account</T>
          <T size={12.5} color={A.ink2} style={{ marginTop: 3, lineHeight: 18 }}>These are demo accounts with ready-made data, a health file and reports. One tap signs you in.</T>
          <View style={{ gap: 8, marginTop: 10 }}>
            <Press onPress={() => tryDemo('astronaut')} label="Demo astronaut" style={{ padding: 12, borderRadius: 14, backgroundColor: A.copper }}><T size={14} weight="m" color="#fff">Demo astronaut · Alex Morgan</T></Press>
            <Press onPress={() => tryDemo('doctor')} label="Demo doctor" style={{ padding: 12, borderRadius: 14, backgroundColor: A.ink }}><T size={14} weight="m" color="#fff">Demo doctor · Dr. Elena Voss</T></Press>
            <Press onPress={() => tryDemo('leader')} label="Demo team leader" style={{ padding: 12, borderRadius: 14, backgroundColor: A.sand2, borderWidth: 1, borderColor: A.line }}><T size={14} weight="m" color={A.ink}>Demo team leader · Cmdr. Volkova</T></Press>
          </View>
        </View>
      ) : null}
      <T size={13} color={A.ink3} style={{ marginTop: 14, marginLeft: 4 }}>New here? <T size={13} weight="m" color={A.copper} onPress={() => nav.replace('/name')}>Get started</T></T>
    </FormShell>
  );
}
