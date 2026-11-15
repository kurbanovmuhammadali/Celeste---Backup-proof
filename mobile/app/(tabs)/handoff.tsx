import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Send } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, Sheet, Tag, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { SyntheticBanner } from '@/kit/hmsc';
import { useCrew } from '@/data/crew';
import { useSources } from '@/data/freshness';
import { computeAttention } from '@/data/attention';
import { createDraft, handoffStatus, queueHandoff, removeHandoff, useHandoffSync } from '@/data/handoff';
import type { HandoffState } from '@/data/handoff';
import { useStore , useBriefing} from '@/data/store';
import type { Handoff } from '@/data/store';
import { DELAYS } from '@/data/hmscMission';

const STEPS: HandoffState[] = ['draft', 'queued', 'sent', 'acknowledged'];
const TONE: Record<HandoffState, string> = { draft: 'none', queued: 'watch', sent: 'watch', acknowledged: 'ok' };
const REASONS = ['Sleep and recovery drift', 'New symptom', 'Radiation concern', 'Routine status report'];

function Timeline({ h }: { h: Handoff }) {
  const st = handoffStatus(h).state;
  const at = STEPS.indexOf(st);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i <= at ? K.copper : K.ink4 }} />
            <Txt v="mono" color={i <= at ? K.copperInk : K.ink3} style={{ fontSize: 8, marginTop: 4 }} upper>{s}</Txt>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

function Report({ h }: { h: Handoff }) {
  const [open, setOpen] = useState(false);
  const s = handoffStatus(h);
  return (
    <Card style={{ marginTop: 12 }} onPress={() => setOpen(o => !o)} label={h.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Txt v="subM" style={{ flex: 1 }} numberOfLines={open ? 3 : 1}>{h.title}</Txt>
        <Tag label={s.label} tone={TONE[s.state]} />
      </View>
      <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Day {h.missionDay} · {new Date(h.createdAt).toLocaleString()}{h.synthetic ? ' · synthetic' : ''}</Txt>
      <Timeline h={h} />
      <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>{s.detail}</Txt>
      {open ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          {h.lines.map(l => <View key={l.h}><Kicker color={K.ink2}>{l.h}</Kicker><Txt v="sub" style={{ marginTop: 2 }}>{l.t}</Txt></View>)}
        </View>
      ) : <Txt v="caption" color={K.copperInk} style={{ marginTop: 8 }}>Tap to read the report</Txt>}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {!h.queuedAt ? <View style={{ flex: 1 }}><Button small icon={Send} title="Queue for sending" onPress={() => { queueHandoff(h.id); toast('Queued'); }} /></View> : null}
        {!h.queuedAt ? <Button small kind="secondary" title="Delete" onPress={() => removeHandoff(h.id)} /> : null}
        {h.queuedAt && s.state === 'acknowledged' ? <Button small kind="secondary" title="Remove" onPress={() => removeHandoff(h.id)} /> : null}
      </View>
    </Card>
  );
}

/** Offline medical handoff: DRAFT → QUEUED → SENT → ACKNOWLEDGED. Simulated store-and-forward queue. */
export default function Handoff() {
  const crew = useCrew();
  const sources = useSources(crew);
  const handoffs = useStore(s => s.handoffs);
  const briefing = useBriefing();
  const [sheet, setSheet] = useState(false);
  const [, tick] = useState(0);
  useHandoffSync(!crew.synthetic);
  const active = handoffs.some(h => h.queuedAt && handoffStatus(h).state !== 'acknowledged');
  useEffect(() => { if (!active) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, [active]);

  const make = (reason: string) => {
    createDraft(crew, computeAttention(crew, sources), reason);
    setSheet(false);
    toast('Draft created');
  };

  return (
    <Page tabs title="Medical handoff" header={<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Txt v="headline">Medical handoff</Txt><Tag label={briefing ? `Delay: ${DELAYS[briefing.delay]}` : 'Delay: not set'} /></View>} maxWidth={720}>
      <View style={{ marginTop: 14 }}>
        <Txt v="display">Prepare it now,{'\n'}send when the link opens.</Txt>
        <Txt v="sub" color={K.ink2} style={{ marginTop: 8 }}>When Earth is far away, HMSC packs the reason, trend, latest numbers, symptoms and missing data into one compact report. Queued reports arrive in the flight surgeon console, and the surgeon's acknowledgement comes back here.</Txt>
      </View>
      {crew.synthetic ? <SyntheticBanner /> : null}
      <View style={{ marginTop: 14 }}>
        <Notice tone="watch" title="Prototype link" body="Reports go to the flight surgeon console of this HMSC server, not to NASA. The communication window is simulated; the synthetic judge scenario never sends anything." />
      </View>
      <View style={{ marginTop: 14 }}><Button icon={Send} title="New handoff report" onPress={() => setSheet(true)} /></View>
      {handoffs.length === 0 ? <Txt v="sub" color={K.ink3} center style={{ marginTop: 28 }}>No reports yet. Create one here, or from an attention card.</Txt> : handoffs.map(h => <Report key={h.id} h={h} />)}

      <Sheet open={sheet} onClose={() => setSheet(false)} kicker="Handoff" title="What is this report about?">
        <View style={{ gap: 8, marginTop: 6 }}>{REASONS.map(r => <Chip key={r} label={r} onPress={() => make(r)} />)}</View>
      </Sheet>
    </Page>
  );
}
