/**
 * Offline medical handoff: DRAFT → QUEUED → SENT → ACKNOWLEDGED.
 * Real reports (signed-in app) are delivered to the flight surgeon console of this server once the (simulated) link window
 * opens, and become ACKNOWLEDGED only when a surgeon acknowledges them there. Reports from the synthetic judge scenario are
 * never sent: they only play the timeline (one-way delay compressed, 1 simulated minute = 1 second, capped).
 */
import { useEffect } from 'react';
import { api } from '@/api';
import { getStore, setStore, uid, useStore , getBriefing} from './store';
import type { Handoff, HandoffLine } from './store';
import { delaySeconds } from './hmscMission';
import type { useCrew } from './crew';
import type { Attention } from './attention';

export type HandoffState = 'draft' | 'queued' | 'sent' | 'acknowledged';
const SEND_AFTER = 3; // seconds in the queue before the (simulated) link window opens

export function ackAfterSeconds(delaySec: number) {
  return SEND_AFTER + Math.min(40, Math.max(4, Math.round((delaySec * 2) / 60)));
}

export function handoffStatus(h: Handoff, now = Date.now()): { state: HandoffState; label: string; detail: string } {
  if (!h.queuedAt) return { state: 'draft', label: 'DRAFT', detail: 'Not queued yet' };
  const s = (now - h.queuedAt) / 1000;
  if (!h.synthetic) {
    if (h.ackAt) return { state: 'acknowledged', label: 'ACKNOWLEDGED', detail: `Acknowledged by your flight surgeon${h.ackNote ? `: “${h.ackNote}”` : ''}` };
    if (h.sentAt) return { state: 'sent', label: 'SENT', detail: 'Delivered to the flight surgeon console. Waiting for acknowledgement.' };
    return { state: 'queued', label: 'QUEUED', detail: s < SEND_AFTER ? 'Waiting for the next communication window' : 'Link not available yet. Will retry automatically.' };
  }
  if (s < SEND_AFTER) return { state: 'queued', label: 'QUEUED', detail: 'Waiting for the next communication window' };
  const ack = ackAfterSeconds(h.delaySec);
  if (s < ack) return { state: 'sent', label: 'SENT', detail: h.delaySec ? `Sent · simulated one-way delay ${h.delaySec >= 60 ? Math.round(h.delaySec / 60) + ' min' : h.delaySec + ' s'} (compressed)` : 'Sent' };
  return { state: 'acknowledged', label: 'ACKNOWLEDGED', detail: 'Simulated acknowledgement from the ground' };
}

type Crew = ReturnType<typeof useCrew>;

/** Builds the compact report: reason · mission day/time · trend · latest measurements · symptoms · missing data · actions taken. */
export function buildLines(crew: Crew, attention: Attention | null, reason: string, actionsTaken: string[]): HandoffLine[] {
  const d = crew.days[6];
  const f = (v: number | null, u = '') => (v == null ? 'missing' : `${Math.round(v * 10) / 10}${u}`);
  const missing: string[] = [];
  if (d.sleep == null) missing.push('sleep'); if (d.hrv == null) missing.push('HRV'); if (d.rhr == null) missing.push('resting HR');
  if (crew.radiation.cumulative == null) missing.push(`cumulative dose (${crew.radiation.missing} mission days without a reading)`);
  const symptoms = crew.synthetic ? 'Headache (synthetic scenario)' : crew.manualToday?.symptoms?.length ? crew.manualToday.symptoms.join(', ') : 'None reported';
  return [
    { h: 'Reason for handoff', t: reason },
    { h: 'Mission day & time', t: `Day ${crew.missionDay} of ${crew.duration} · ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC` },
    { h: 'Relevant trend', t: attention?.changes.length ? attention.changes.join(' ') : 'No notable change against the personal baseline.' },
    { h: 'Latest measurements', t: `Sleep ${f(d.sleep, ' h')} · HRV ${f(d.hrv, ' ms')} ${crew.hrvMethod} · Resting HR ${f(d.rhr, ' bpm')} · Recovery ${f(d.recovery, '%')}` },
    { h: 'Symptoms', t: symptoms },
    { h: 'Missing data', t: missing.length ? missing.join('; ') : 'None' },
    { h: 'Actions already taken', t: actionsTaken.length ? actionsTaken.join('; ') : 'None yet' },
    ...(crew.synthetic ? [{ h: 'Data label', t: 'Synthetic demo scenario, not real crew data.' }] : crew.isSample ? [{ h: 'Data label', t: 'Contains demo values.' }] : []),
  ];
}

export function createDraft(crew: Crew, attention: Attention | null, reason: string, actionsTaken: string[] = []): Handoff {
  const briefing = getBriefing();
  const h: Handoff = { id: uid(), createdAt: Date.now(), title: reason.length > 60 ? reason.slice(0, 57) + '…' : reason, reason, missionDay: crew.missionDay,
    lines: buildLines(crew, attention, reason, actionsTaken), delaySec: delaySeconds(briefing?.delay ?? 'none'), synthetic: crew.synthetic };
  setStore(s => ({ ...s, handoffs: [h, ...s.handoffs] }));
  return h;
}

export const queueHandoff = (id: string) => setStore(s => ({ ...s, handoffs: s.handoffs.map(h => (h.id === id && !h.queuedAt ? { ...h, queuedAt: Date.now() } : h)) }));
export const removeHandoff = (id: string) => setStore(s => ({ ...s, handoffs: s.handoffs.filter(h => h.id !== id) }));

/** Delivers queued reports to the server and picks up acknowledgements. Mount once on a screen that is always open. */
export function useHandoffSync(enabled: boolean) {
  const handoffs = useStore(s => s.handoffs);
  const pending = handoffs.filter(h => !h.synthetic && h.queuedAt && !h.ackAt).length;
  useEffect(() => {
    if (!enabled || !pending) return;
    let stop = false;
    const tick = async () => {
      for (const h of getStore().handoffs) {
        if (stop) return;
        if (h.synthetic || !h.queuedAt || h.sentAt || Date.now() - h.queuedAt < SEND_AFTER * 1000) continue;
        try {
          await api(`/api/me/handoffs/${h.id}`, { method: 'PUT', body: { title: h.title, reason: h.reason, missionDay: h.missionDay, lines: h.lines, queuedAt: h.queuedAt } });
          setStore(s => ({ ...s, handoffs: s.handoffs.map(x => (x.id === h.id ? { ...x, sentAt: Date.now() } : x)) }));
        } catch { /* offline or signed out: stays queued and retries */ }
      }
      try {
        const r = await api<{ handoffs: { id: string; ackAt: string | null; ackNote: string | null }[] }>('/api/me/handoffs');
        setStore(s => ({ ...s, handoffs: s.handoffs.map(x => { const k = r.handoffs.find(y => y.id === x.id); return k?.ackAt && !x.ackAt ? { ...x, sentAt: x.sentAt ?? Date.now(), ackAt: k.ackAt, ackNote: k.ackNote ?? undefined } : x; }) }));
      } catch { /* retry next tick */ }
    };
    tick(); const t = setInterval(tick, 4000);
    return () => { stop = true; clearInterval(t); };
  }, [enabled, pending]);
}

/** A report with custom lines. `synthetic` reports (simulations) only play the timeline and are never sent to the server. */
export function createReport(crew: Crew, reason: string, lines: HandoffLine[], synthetic = false): Handoff {
  const briefing = getBriefing();
  const h: Handoff = { id: uid(), createdAt: Date.now(), title: reason.length > 60 ? reason.slice(0, 57) + '…' : reason, reason, missionDay: crew.missionDay, lines, delaySec: delaySeconds(briefing?.delay ?? 'none'), synthetic: synthetic || crew.synthetic };
  setStore(s => ({ ...s, handoffs: [h, ...s.handoffs] }));
  return h;
}
