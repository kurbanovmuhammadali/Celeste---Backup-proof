import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { C, shadow } from './theme';
import { Button, Row, T } from './ui';

const KEY = 'pg_cookie_consent';
const read = () => { try { return localStorage.getItem(KEY); } catch { return 'unavailable'; } };

export default function CookieBanner() {
  const [show, setShow] = useState(false);
  const path = usePathname();
  useEffect(() => { if (Platform.OS === 'web' && !read()) setShow(true); }, []);
  if (!show || path.startsWith('/cam/') || path === '/camera') return null; // the phone camera page stays clean
  const choose = (v: string) => { try { localStorage.setItem(KEY, JSON.stringify({ v, essential: true, analytics: false, at: new Date().toISOString() })); } catch {} setShow(false); };
  return (
    <View style={{ position: 'absolute' as any, left: 16, right: 16, bottom: 16, alignItems: 'center', zIndex: 50 }} pointerEvents="box-none">
      <View style={[{ backgroundColor: '#fff', borderRadius: 24, padding: 18, maxWidth: 560, width: '100%' }, shadow]}>
        <T size={15} weight="sb">Cookies, kept to the essentials</T>
        <T size={13} color={C.ink2} style={{ marginTop: 6 }}>
          We use one strictly-necessary cookie to keep you signed in. No analytics, no ads, no tracking.{' '}
          <Link href="/legal/cookies"><T size={13} weight="m" style={{ textDecorationLine: 'underline' }}>Cookie policy</T></Link>
        </T>
        <Row gap={8} style={{ marginTop: 14 }}>
          <Button title="Essential only" kind="ghost" onPress={() => choose('essential')} style={{ flex: 1, height: 46 }} />
          <Button title="OK, got it" onPress={() => choose('accepted')} style={{ flex: 1, height: 46 }} />
        </Row>
      </View>
    </View>
  );
}
