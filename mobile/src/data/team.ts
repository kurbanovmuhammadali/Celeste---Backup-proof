import { useEffect } from 'react';
import { useApi } from '@/useApi';
import { getStore, setStore , getBriefing} from './store';
import type { MissionBrief } from './store';

export type Member = { id: number; name: string; role: 'commander' | 'member'; online: boolean; you: boolean };
export type Pulse = { todayCount: number; enough: boolean; mood: number | null; stress: number | null; history: { day: string; mood: number; stress: number }[]; mine: boolean };
export type FeedItem = { id: number; kind: 'announce' | 'kudos' | 'join' | 'mission'; text: string; at: string; name: string | null };
export type Crew = { id: number; name: string; code: string; role: 'commander' | 'member'; briefing: MissionBrief | null; briefingAt: string | null; members: Member[]; pulse: Pulse; feed: FeedItem[] };

/** My crew (or null). When the commander shares a mission, every member's briefing follows it (same environment for the whole team). */
export function useTeam() {
  const r = useApi<{ crew: Crew | null }>('/api/crew');
  const crew = r.data?.crew ?? null;
  useEffect(() => {
    const b = crew?.briefing; if (!b) return;
    if (JSON.stringify({ ...getStore().briefing, at: 0 }) !== JSON.stringify({ ...b, at: 0 })) setStore(s => ({ ...s, briefing: b, profile: { ...s.profile, duration: String(b.durationDays ?? s.profile.duration) } }));
  }, [crew?.briefingAt]);
  return { crew, loading: r.loading, reload: r.reload, setCrew: (c: Crew | null) => r.setData({ crew: c }) };
}
