import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { K } from '@/kit/tokens';
import { Kicker, Txt } from '@/kit/core';
import { Button, Card, Notice, PageHead, SectionHead, Skeleton, Tag, TopBar, toast } from '@/kit/ui';
import { Progress } from '@/kit/charts';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { SyntheticBanner } from '@/kit/hmsc';
import { dayKey, setStore, todayKey, uid, useStore } from '@/data/store';
import { useCrew } from '@/data/crew';
import { fetchDonki } from '@/data/donki';
import type { DonkiResult } from '@/data/donki';

const KIND_WORD = { CME: 'CME', FLR: 'Flare', SEP: 'SEP' } as const;
const SRC_WORD = { dosimeter: 'Personal dosimeter', demo: 'Demo values', synthetic: 'Synthetic demo scenario', none: 'No reading' } as const;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s));

/** Radiation module: personal dose (rate · interval · cumulative with honest coverage) + NASA DONKI space-weather context. */
export default function RadiationScreen() {
  const crew = useCrew();
  const r = crew.radiation;
  const entries = useStore(s => s.radiation);
  const [donki, setDonki] = useState<DonkiResult | null>(null);
  const [mSv, setMSv] = useState('');
  const [from, setFrom] = useState(todayKey());
  const [to, setTo] = useState(todayKey());
  const [device, setDevice] = useState('Personal dosimeter');
  const [where, setWhere] = useState('Crew quarters');

  const load = (force = false) => { setDonki(null); fetchDonki(30, force).then(setDonki); };
  useEffect(() => { load(); }, []);

  const add = () => {
    const v = parseFloat(mSv.replace(',', '.'));
    if (!Number.isFinite(v) || v < 0) return toast('Enter the dose in mSv');
    if (!isDay(from) || !isDay(to) || to < from) return toast('Use dates like 2026-11-14 (to ≥ from)');
    if (to > todayKey()) return toast('The interval cannot end in the future');
    setStore(s => ({ ...s, radiation: [...s.radiation, { id: uid(), at: Date.now(), fromDay: from, toDay: to, mSv: v, device: device.trim() || 'Personal dosimeter', location: where.trim() || 'Unspecified' }] }));
    setMSv('');
    toast('Dosimeter reading saved');
  };

  return (
    <Page title="Radiation" maxWidth={720} header={<TopBar title="Radiation" />}>
      <PageHead kicker="Personal dose + space-weather context" title="Radiation" sub="Four different things, never mixed up: dose rate, dose for an interval, total mission dose, and what the Sun is doing." style={{ marginTop: 6 }} />
      {crew.synthetic ? <SyntheticBanner /> : null}

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Kicker>Your dose</Kicker><Tag label={SRC_WORD[r.source]} tone={r.source === 'dosimeter' ? 'ok' : 'watch'} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
          <View style={{ flex: 1 }}><Txt v="caption" color={K.ink2}>Dose rate</Txt><Txt v="title" tabular style={{ marginTop: 2 }}>{r.rate == null ? '—' : r.rate.toFixed(2)} <Txt v="sub" color={K.ink2}>mSv/day</Txt></Txt></View>
          <View style={{ flex: 1 }}><Txt v="caption" color={K.ink2}>{r.intervalDays ? `Last ${r.intervalDays} days` : 'Interval'}</Txt><Txt v="title" tabular style={{ marginTop: 2 }}>{r.interval == null ? '—' : r.interval.toFixed(2)} <Txt v="sub" color={K.ink2}>mSv</Txt></Txt></View>
        </View>
        <View style={{ marginTop: 16 }}>
          <Txt v="caption" color={K.ink2}>Total mission dose</Txt>
          {r.cumulative == null
            ? <Txt v="headline" color={K.copperInk} style={{ marginTop: 2 }}>Cumulative dose unavailable</Txt>
            : <Txt v="title" tabular style={{ marginTop: 2 }}>{r.cumulative.toFixed(1)} <Txt v="sub" color={K.ink2}>mSv</Txt></Txt>}
        </View>
        <View style={{ marginTop: 12 }}><Progress value={r.missionDay ? r.coveredDays / r.missionDay : 0} height={6} /></View>
        <Txt v="mono" color={K.ink3} style={{ marginTop: 6 }}>HISTORY COVERAGE · {r.coveredDays} OF {r.missionDay} MISSION DAYS</Txt>
        {r.cumulative == null ? <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>The total is only shown when every mission day has a reading. HMSC will not show 0.0 mSv for a history it does not have.</Txt> : null}
        <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>Personal dosimeter readings are separate from cabin monitors.</Txt>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Add a dosimeter reading</Kicker>
        <Field label="Dose for the interval" value={mSv} onChange={setMSv} unit="mSv" placeholder="0.40" />
        <Field label="From (date)" value={from} onChange={setFrom} keyboard="default" placeholder="2026-11-14" />
        <Field label="To (date)" value={to} onChange={setTo} keyboard="default" placeholder="2026-11-14" hint="A multi-day dose is spread evenly over its days." />
        <Field label="Device" value={device} onChange={setDevice} keyboard="default" />
        <Field label="Location" value={where} onChange={setWhere} keyboard="default" />
        <View style={{ marginTop: 16 }}><Button title="Save reading" onPress={add} /></View>
        {entries.length ? (
          <View style={{ marginTop: 14, gap: 6 }}>
            <Kicker color={K.ink3}>Recent readings</Kicker>
            {[...entries].sort((a, b) => b.at - a.at).slice(0, 4).map(e => (
              <Txt key={e.id} v="caption" color={K.ink2}>{e.fromDay === e.toDay ? e.fromDay : `${e.fromDay} → ${e.toDay}`} · {e.mSv} mSv · {e.device} · {e.location}</Txt>
            ))}
          </View>
        ) : null}
      </Card>

      <SectionHead kicker="NASA DONKI" title="Space-weather context" action="Refresh" onAction={() => load(true)} />
      <Notice tone="watch" title="Context for radiation risk, not your personal dose" body="Solar flares, coronal mass ejections and energetic-particle events from the last 30 days, from NASA's DONKI database." />
      <View style={{ marginTop: 10, gap: 8 }}>
        {!donki ? [0, 1, 2].map(i => <Skeleton key={i} h={64} r={16} />)
          : donki.error ? <Notice tone="flag" title="DONKI unavailable" body={donki.error} />
          : donki.events.length === 0 ? <Notice tone="ok" title="No events reported in the last 30 days" body="DONKI returned no flares, CMEs or SEP events for this window." />
          : donki.events.slice(0, 8).map(e => (
            <Card key={e.id} pad={12} onPress={e.link ? () => Linking.openURL(e.link!) : undefined} label={e.title}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Txt v="subM">{e.title}</Txt><Tag label={KIND_WORD[e.kind]} />
              </View>
              <Txt v="mono" color={K.ink3} style={{ marginTop: 2 }}>{e.time.replace('T', ' ').replace('Z', ' UTC')}</Txt>
              <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>{e.detail}</Txt>
            </Card>
          ))}
      </View>
      {donki && !donki.error ? <Txt v="caption" color={K.ink3} style={{ marginTop: 8 }}>Source: NASA DONKI via api.nasa.gov · fetched {new Date(donki.fetchedAt).toLocaleTimeString()}. Tap an event to open it on NASA's site.</Txt> : null}
    </Page>
  );
}
