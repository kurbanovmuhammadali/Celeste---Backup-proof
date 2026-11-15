import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LEGAL } from '@/legal';
import { Card, Header, Screen, T } from '@/ui';
import { C } from '@/theme';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: 'terms' | 'privacy' | 'cookies' }>();
  const d = LEGAL[doc as keyof typeof LEGAL] ?? LEGAL.terms;
  return (
    <Screen bottomSpace={40}>
      <View style={{ maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Header title={d.title} back sub={`Last updated ${d.updated}`} />
        <Card>
          {d.sections.map(s => (
            <View key={s.h} style={{ marginBottom: 18 }}>
              <T size={16} weight="sb" style={{ marginBottom: 6 }}>{s.h}</T>
              {s.p.map((p, i) => <T key={i} size={14} color={C.ink2} style={{ marginBottom: 6, lineHeight: 21 }}>{p}</T>)}
            </View>
          ))}
        </Card>
      </View>
    </Screen>
  );
}
