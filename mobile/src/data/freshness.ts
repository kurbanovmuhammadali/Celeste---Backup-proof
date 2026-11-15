/**
 * Data freshness: every source shows one honest state: demo · received · stale · missing · error · queued.
 * HMSC never shows a green "normal" when a source is silent.
 */
import { useApi } from '../useApi';
import { useStore } from './store';
import type { useCrew } from './crew';
import { handoffStatus } from './handoff';

export type SourceState = 'demo' | 'received' | 'stale' | 'missing' | 'error' | 'queued';
export type SourceStatus = { key: string; label: string; state: SourceState; detail: string };
type Crew = ReturnType<typeof useCrew>;
type Provider = { key: string; status: string; lastSync: string | null };

export const STATE_WORD: Record<SourceState, string> = { demo: 'Demo', received: 'Received', stale: 'Stale', missing: 'Missing', error: 'Error', queued: 'Queued' };
export const STATE_TONE: Record<SourceState, string> = { demo: 'watch', received: 'ok', stale: 'watch', missing: 'none', error: 'flag', queued: 'watch' };

export const hoursSince = (ms: number) => Math.max(0, (Date.now() - ms) / 36e5);
export const ago = (h: number) => (h < 1 ? 'just now' : h < 48 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} d ago`);

/** Sleep source freshness: null when fresh, demo or synthetic. */
export function staleSleep(crew: Crew): { hours: number } | null {
  if (crew.synthetic || crew.manualToday?.sleep != null) return null;
  const s = crew.raw?.metrics.sleep;
  if (!s || !s.source || s.source === 'demo') return null;
  const h = s.recordedAt ? hoursSince(Date.parse(s.recordedAt)) : null;
  return s.stale || (h != null && h > 18) ? { hours: Math.round(h ?? 24) } : null;
}

export function useSources(crew: Crew): SourceStatus[] {
  const { data, error } = useApi<{ providers: Provider[] }>('/api/integrations');
  const handoffs = useStore(s => s.handoffs);
  const out: SourceStatus[] = [];

  // WHOOP
  const whoop = data?.providers.find(p => p.key === 'whoop' && p.status === 'connected');
  const demo = data?.providers.find(p => p.key === 'demo' && p.status === 'connected');
  if (crew.handMode) { /* data by hand: no WHOOP row */ }
  else if (crew.synthetic) out.push({ key: 'whoop', label: 'WHOOP', state: 'demo', detail: 'Synthetic demo scenario' });
  else if (error && !data) out.push({ key: 'whoop', label: 'WHOOP', state: 'error', detail: 'Server not reachable' });
  else if (whoop) {
    const t = whoop.lastSync ? Date.parse(whoop.lastSync.replace(' ', 'T') + 'Z') : NaN;
    const h = Number.isFinite(t) ? hoursSince(t) : null;
    out.push({ key: 'whoop', label: 'WHOOP', state: h != null && h > 12 ? 'stale' : 'received', detail: h != null ? `Last sync ${ago(h)}` : 'Connected' });
  } else if (demo) out.push({ key: 'whoop', label: 'WHOOP', state: 'demo', detail: 'Demo dataset (not your data)' });
  else out.push({ key: 'whoop', label: 'WHOOP', state: 'missing', detail: 'Not connected' });

  // Personal dosimeter
  const r = crew.radiation;
  if (r.source === 'dosimeter' && r.lastAt != null) { const h = hoursSince(r.lastAt); out.push({ key: 'dosimeter', label: 'Dosimeter', state: h > 36 ? 'stale' : 'received', detail: `Last reading ${ago(h)}` }); }
  else if (r.source === 'synthetic') out.push({ key: 'dosimeter', label: 'Dosimeter', state: 'demo', detail: 'Synthetic demo scenario' });
  else if (r.source === 'demo') out.push({ key: 'dosimeter', label: 'Dosimeter', state: 'demo', detail: 'Demo values (not your dose)' });
  else out.push({ key: 'dosimeter', label: 'Dosimeter', state: 'missing', detail: 'No reading entered' });

  // Daily crew check
  out.push(crew.manualToday ? { key: 'manual', label: 'Daily check', state: 'received', detail: 'Entered today' } : { key: 'manual', label: 'Daily check', state: 'missing', detail: 'Not entered today' });

  // Handoff queue
  const pending = handoffs.filter(h => ['queued', 'sent'].includes(handoffStatus(h).state)).length;
  if (pending) out.push({ key: 'handoff', label: 'Handoff queue', state: 'queued', detail: `${pending} report${pending > 1 ? 's' : ''} waiting (simulated)` });
  return out;
}
