import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, Trash2 } from 'lucide-react-native';
import { K } from '@/kit/tokens';
import { Kicker, Pressy, Txt } from '@/kit/core';
import { Button, Card, Chip, Notice, PageHead, TopBar, toast } from '@/kit/ui';
import { Page } from '@/kit/page';
import { Field } from '@/kit/fields';
import { api } from '@/api';
import { useApi } from '@/useApi';

type Cond = { name: string; notes: string };
type Bg = { cvText?: string; characteristics?: string; allergies?: string; medications?: string; conditions?: Cond[]; sharedConsent?: boolean };
type FileRow = { id: number; name: string; mime: string; size: number };
const MAX = 700 * 1024;

function toBase64(buf: ArrayBuffer) {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** My background: CV, characteristics, health conditions, allergies, medications and files. Seen by flight surgeons. */
export default function Background() {
  const { data, reload } = useApi<{ background: Bg | null; files: FileRow[] }>('/api/me/background');
  const [bg, setBg] = useState<Bg>({ conditions: [] });
  const [files, setFiles] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (data && !loaded) { setBg({ conditions: [], ...(data.background ?? {}) }); setFiles(data.files ?? []); setLoaded(true); } }, [data, loaded]);
  const set = (p: Partial<Bg>) => setBg(b => ({ ...b, ...p }));
  const conds = bg.conditions ?? [];
  const setCond = (i: number, p: Partial<Cond>) => set({ conditions: conds.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  const save = async () => {
    setBusy(true);
    try { await api('/api/me/background', { method: 'PUT', body: bg }); toast('Background saved'); reload(); } catch (e: any) { toast(e.message ?? 'Could not save'); } finally { setBusy(false); }
  };
  const addFile = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if ((a.size ?? 0) > MAX) return toast('Files can be up to 700 KB');
      setBusy(true);
      const buf = await (await fetch(a.uri)).arrayBuffer();
      if (buf.byteLength > MAX) return toast('Files can be up to 700 KB');
      const out = await api<{ files: FileRow[] }>('/api/me/files', { body: { name: a.name, mime: a.mimeType ?? 'application/pdf', data: toBase64(buf) } });
      setFiles(out.files); toast('File added');
    } catch (e: any) { toast(e.message ?? 'Could not add the file'); } finally { setBusy(false); }
  };
  const del = async (id: number) => { try { const out = await api<{ files: FileRow[] }>(`/api/me/files/${id}`, { method: 'DELETE' }); setFiles(out.files); } catch (e: any) { toast(e.message ?? 'Could not delete'); } };

  return (
    <Page title="My background" maxWidth={680} header={<TopBar title="My background" />} footer={<Button title="Save background" loading={busy} onPress={save} />}>
      <PageHead kicker="Private health file" title="Tell us about you" sub="Your flight surgeon can read this. It helps Celeste personalise your plan, tracking and the SI's replies." style={{ marginTop: 6 }} />
      <View style={{ marginTop: 12 }}><Notice tone="watch" title="Who sees this" body="You and flight surgeons. The SI reads a short summary only if you tick the box at the bottom. You can edit or delete everything any time." /></View>

      <Card style={{ marginTop: 14 }}>
        <Field label="CV / career background" value={bg.cvText ?? ''} onChange={v => set({ cvText: v })} keyboard="default" multiline placeholder="Education, flight experience, past missions, training…" />
        <Field label="Characteristics" value={bg.characteristics ?? ''} onChange={v => set({ characteristics: v })} keyboard="default" multiline placeholder="How you cope with stress, what calms you, what you like, how you like to be talked to…" hint="The SI uses this to answer more kindly and relevantly." />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Health conditions</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>Injuries, chronic conditions, past problems. They shape your plan and let your surgeon track you better.</Txt>
        {conds.map((c, i) => (
          <View key={i} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: K.hair }}>
            <Field label={`Condition ${i + 1}`} value={c.name} onChange={v => setCond(i, { name: v })} keyboard="default" placeholder="e.g. Mild asthma, left knee injury" />
            <Field label="Notes" value={c.notes} onChange={v => setCond(i, { notes: v })} keyboard="default" placeholder="Since when, treatment, limits…" />
            <View style={{ marginTop: 8, alignItems: 'flex-start' }}><Pressy label="Remove condition" onPress={() => set({ conditions: conds.filter((_, j) => j !== i) })}><Txt v="caption" color={K.flag}>Remove</Txt></Pressy></View>
          </View>
        ))}
        <View style={{ marginTop: 12 }}><Button small kind="secondary" title="Add a health condition" onPress={() => set({ conditions: [...conds, { name: '', notes: '' }] })} disabled={conds.length >= 20} /></View>
        <Field label="Allergies" value={bg.allergies ?? ''} onChange={v => set({ allergies: v })} keyboard="default" placeholder="Medicines, food, materials" />
        <Field label="Medications" value={bg.medications ?? ''} onChange={v => set({ medications: v })} keyboard="default" placeholder="Name and dose" />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Kicker>Files</Kicker>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 4 }}>CV, medical letters, test results. PDF, Word, text, PNG or JPEG, up to 700 KB each, 5 files.</Txt>
        {files.map(f => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: K.hair, marginTop: 8 }}>
            <FileText size={18} color={K.copper} />
            <View style={{ flex: 1 }}><Txt v="subM" numberOfLines={1}>{f.name}</Txt><Txt v="caption" color={K.ink3}>{Math.max(1, Math.round(f.size / 1024))} KB</Txt></View>
            <Pressy label={`Delete ${f.name}`} onPress={() => del(f.id)}><Trash2 size={18} color={K.flag} /></Pressy>
          </View>
        ))}
        <View style={{ marginTop: 12 }}><Button small kind="secondary" title="Add a file" loading={busy} onPress={addFile} disabled={files.length >= 5} /></View>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row' }}><Chip label={bg.sharedConsent ? 'Shared with surgeon and SI' : 'Tap to share with surgeon and SI'} on={!!bg.sharedConsent} onPress={() => set({ sharedConsent: !bg.sharedConsent })} /></View>
        <Txt v="caption" color={K.ink2} style={{ marginTop: 8 }}>I agree that my flight surgeon can read this file and that a short summary (characteristics, conditions, background) may be sent to the SI service to make replies more relevant. The SI never diagnoses.</Txt>
      </Card>
    </Page>
  );
}
