import React from 'react';
import { View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';

/** Inline: **bold** and `code`. */
function inline(s: string, color: string) {
  return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((p, i) =>
    p.startsWith('**') ? <Txt key={i} v="body" color={color} style={{ fontFamily: 'Geist_600SemiBold' }}>{p.slice(2, -2)}</Txt>
      : p.startsWith('`') ? <Txt key={i} v="mono" color={color} style={{ fontSize: 13 }}>{p.slice(1, -1)}</Txt>
        : p);
}

/** A reply as short paragraphs, bullets and bold numbers (the SI answers in this tiny markdown). */
export function Rich({ text, color = K.ink, streaming }: { text: string; color?: string; streaming?: boolean }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const blocks: { t: 'p' | 'li'; s: string }[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) continue;
    const m = /^([-•*]|\d+[.)])\s+(.*)$/.exec(l);
    blocks.push(m ? { t: 'li', s: m[2] } : { t: 'p', s: l.replace(/^#+\s*/, '') });
  }
  return (
    <View style={{ gap: 7 }}>
      {blocks.map((b, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          {b.t === 'li' ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: K.copper, marginTop: 9 }} /> : null}
          <Txt v="body" color={color} style={{ flex: 1, lineHeight: 22 }}>{inline(b.s, color)}{streaming && i === blocks.length - 1 ? ' ▍' : ''}</Txt>
        </View>
      ))}
    </View>
  );
}
