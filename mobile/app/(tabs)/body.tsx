import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity, Bone, Brain, Eye, HeartPulse, Footprints, RotateCcw, ChevronRight } from 'lucide-react-native';
import { K, RAD, ELEV, toneWord } from '@/kit/tokens';
import { Kicker, Pressy, Swap, Txt, useLayout } from '@/kit/core';
import { Card, Chip, ChipRow, Dot, ListGroup, ListRow, Stepper, Tag } from '@/kit/ui';
import { Cols, Page } from '@/kit/page';
import BodyMap from '@/BodyMap';
import { ReadingSheet, SourceChip } from '@/kit/mission';
import { useMission, type Reading } from '@/data/mission';
import { FlaskConical } from 'lucide-react-native';
import { assessRisks } from '@/data/risk';
import { useSources } from '@/data/freshness';
import { sensorConfidence } from '@/data/confidence';
import { ConfidenceRow } from '@/kit/tools';

const READING_OF: Record<string, string> = { heart: 'rhr', bone: 'ntx', mood: 'mood' };
import { LAYERS, LayerKey, findings as allFindings, useCrew } from '@/data/crew';

const ICON: Record<string, any> = { vision: Eye, heart: HeartPulse, knee: Footprints, mood: Brain, bone: Bone };

export default function Body() {
  const crew = useCrew();
  const { wide, gutter } = useLayout();
  const [li, setLi] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const layer = LAYERS[li];
  const today = crew.days[6];
  const m = useMission();
  const sources = useSources(crew);
  const confidence = useMemo(() => sensorConfidence(crew, sources), [crew, sources]);
  const risks = useMemo(() => assessRisks(today, crew.duration), [today, crew.duration]);
  // findings come from the real readings and symptoms: an area with no data stays unmarked (nothing is invented)
  const all = useMemo(() => {
    const R = m.readings, sym = m.symptoms, t = (x: string) => (x === 'flag' || x === 'watch' ? x : 'ok') as 'ok' | 'watch' | 'flag';
    return allFindings(today.rhr).flatMap(f => {
      if (f.id === 'mood') { const r = R.mood; return r.value == null ? [] : [{ ...f, tone: t(r.tone), sub: `Mood ${r.text}${r.note ? ' · ' + r.note : ''}` }]; }
      if (f.id === 'heart') { const r = R.rhr; return r.value == null ? [] : [{ ...f, tone: t(r.tone), sub: `${r.text}${r.baseline ? ` · your range ${r.baseline.lo}–${r.baseline.hi}` : ' · baseline still building'}` }]; }
      if (f.id === 'bone') { const r = R.ntx; return r.value == null ? [] : [{ ...f, tone: t(r.tone), sub: `NTx ${r.text} · lab result` }]; }
      if (f.id === 'vision') return sym.includes('vision') ? [f] : [];
      if (f.id === 'knee') return sym.includes('knee') ? [f] : [];
      return [f];
    });
  }, [today.rhr, m.readings, m.symptoms]);
  const marks = all; // whole body: every finding at once
  const selected = all.find(f => f.id === sel);
  const [sheet, setSheet] = useState<Reading | null>(null);
  const selReading = selected && READING_OF[selected.id] ? m.readings[READING_OF[selected.id]] : null;

  const viewer = (
    <View>
      <BodyMap findings={marks} selected={sel} onSelect={setSel} height={wide ? 640 : 470} />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ backgroundColor: 'rgba(255,253,251,0.85)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}><Kicker color={K.ink2}>{sel ? `Focus · ${selected?.label}` : 'Whole body'}</Kicker></View>
        {sel ? <Pressy label="Reset view" onPress={() => setSel(null)}><View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,253,251,0.9)', alignItems: 'center', justifyContent: 'center' }}><RotateCcw size={15} color={K.ink} /></View></Pressy> : null}
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Txt v="mono" color={K.ink2} upper style={{ fontSize: 9.5 }}>Tap a dot to zoom in</Txt>
      </View>
    </View>
  );

  const legend = (
    <View style={{ marginTop: 12 }}>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        {(['ok', 'watch', 'flag'] as const).map(t => <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Dot tone={t} size={7} /><Txt v="caption" color={K.ink2}>{toneWord(t)}</Txt></View>)}
      </View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 6 }}>Dots mark recorded findings. Areas without data are unmarked.</Txt>
    </View>
  );

  const side = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
        <Txt v="headline">Findings</Txt>
        <Txt v="mono" color={K.ink3} upper>{marks.length} findings</Txt>
      </View>
      <ListGroup>
        {all.map(f => (
          <ListRow key={f.id} icon={ICON[f.id] ?? Activity} title={f.title} sub={f.sub} tone={f.tone} current={sel === f.id}
            onPress={() => setSel(sel === f.id ? null : f.id)} />
        ))}
      </ListGroup>
      {selected ? (
        <Swap k={selected.id}>
          <Card style={{ marginTop: 10 }} onPress={() => (selReading ? setSheet(selReading) : router.push(selected.route as any))} label={`Open ${selected.title}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Dot tone={selected.tone} pulse />
              <View style={{ flex: 1 }}>
                <Txt v="subM">{toneWord(selected.tone)} · {selected.title}</Txt>
                {selReading ? <View style={{ marginTop: 3, gap: 3 }}><Txt v="headline" tabular>{selReading.text}</Txt><SourceChip r={selReading} /></View>
                  : <Txt v="caption" color={K.ink2}>Reported in a crew check-in · no device reading</Txt>}
              </View>
              <ChevronRight size={17} color={K.ink3} />
            </View>
          </Card>
        </Swap>
      ) : null}
      <Card style={{ marginTop: 12 }}>
        <ConfidenceRow c={confidence} full />
      </Card>
      <ListGroup kicker="Mission risk report" style={{ marginTop: 12 }}>
        {risks.map(r => <ListRow key={r.id} icon={Activity} title={r.title} sub={r.note} tone={r.tone} chevron={false} right={<Tag label={r.tone === 'ok' ? 'Stable' : r.tone === 'watch' ? 'Watch' : r.tone === 'flag' ? 'Action' : 'No data'} tone={r.tone} />} />)}
      </ListGroup>
      <Card onPress={() => router.push('/research')} label="NASA research layer" style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><Kicker color="#3F6797">NASA research · not your data</Kicker><Txt v="headline" style={{ marginTop: 4 }}>Inspiration4 blood counts</Txt><Txt v="caption" color={K.ink2}>Pre- and post-flight research context</Txt></View>
          <FlaskConical size={18} color="#3F6797" />
        </View>
      </Card>
      <Card onPress={() => router.push('/signals')} label="Health signals" style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}><Kicker>Body analytics</Kicker><Txt v="headline" style={{ marginTop: 4 }}>Health signals</Txt><Txt v="caption" color={K.ink2}>Recovery, heart-rate trend and personal dosimetry</Txt></View>
          <ChevronRight size={18} color={K.ink3} />
        </View>
      </Card>
    </View>
  );

  return (
    <Page tabs title="Body explorer" header={<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="headline">Body explorer</Txt><Tag label="Body map" /></View>}>
      <Cols ratio={[1.25, 1]} gap={28} style={{ marginTop: 14 }}>
        <View>{viewer}{legend}</View>
        {side}
      </Cols>
      <Txt v="caption" color={K.ink3} center style={{ marginTop: 22 }}>Illustration for orientation only — not diagnostic.</Txt>
      <ReadingSheet r={sheet} onClose={() => setSheet(null)} />
    </Page>
  );
}
