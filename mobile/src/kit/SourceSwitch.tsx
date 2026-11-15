import React from 'react';
import { router } from 'expo-router';
import { Activity, PencilLine } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Card, Segmented, toast } from '@/kit/ui';
import { setStore, useStore } from '@/data/store';

type Provider = { key: string; status: string };
type Mode = 'whoop' | 'manual';

/** HMSC reads WHOOP only. Switch between WHOOP data and typing it in by hand. One of the two is always required. */
export function SourceSwitch({ providers }: { providers: Provider[] | undefined; onChanged?: () => void }) {
  const mode = useStore(s => s.dataMode) ?? 'whoop';
  const whoop = providers?.some(p => p.key === 'whoop' && p.status === 'connected') ?? false;
  const demo = providers?.some(p => p.key === 'demo' && p.status === 'connected') ?? false;
  const change = (m: Mode) => {
    if (m === mode) return;
    setStore(s => ({ ...s, dataMode: m }));
    if (m === 'manual') toast('Data by hand: enter your numbers in the Daily crew health check');
    else if (!whoop && !demo) { toast('Connect WHOOP to start syncing'); router.push('/integrations'); }
    else toast('Using WHOOP data');
  };
  return (
    <Card pad={14}>
      <Txt v="subM">Where your data comes from</Txt>
      <Txt v="caption" color={K.ink2} style={{ marginTop: 2, marginBottom: 10 }}>
        {mode === 'manual' ? 'Only numbers you type in are used. Nothing is filled in for you.' : whoop ? 'Reading your WHOOP data.' : demo ? 'WHOOP demo dataset (labelled demo) until WHOOP is connected.' : 'WHOOP is not connected yet.'}
      </Txt>
      <Segmented<Mode> value={mode} onChange={change} options={[{ key: 'whoop', label: 'WHOOP', icon: Activity }, { key: 'manual', label: 'By hand', icon: PencilLine }]} />
    </Card>
  );
}
