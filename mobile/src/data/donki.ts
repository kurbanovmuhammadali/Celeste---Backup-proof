/**
 * NASA DONKI (Space Weather Database Of Notifications, Knowledge, Information): solar flares, coronal mass ejections
 * and solar energetic particle events. This is CONTEXT for radiation risk, not any astronaut's personal dose.
 * Uses the public api.nasa.gov endpoint; DEMO_KEY is rate limited, set EXPO_PUBLIC_NASA_API_KEY for a real key.
 */
export type SpaceEvent = { id: string; kind: 'CME' | 'FLR' | 'SEP'; time: string; title: string; detail: string; link?: string };
export type DonkiResult = { events: SpaceEvent[]; fetchedAt: number; error?: string; windowDays: number };

const KEY = process.env.EXPO_PUBLIC_NASA_API_KEY ?? 'DEMO_KEY';
const KINDS = ['CME', 'FLR', 'SEP'] as const;
let cache: DonkiResult | null = null;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const short = (s: unknown, n = 150) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

function map(kind: (typeof KINDS)[number], x: any): SpaceEvent {
  if (kind === 'CME') return { id: x.activityID, kind, time: x.startTime, title: 'Coronal mass ejection', detail: short(x.note) || 'CME observed by coronagraph imagery.', link: x.link };
  if (kind === 'FLR') return { id: x.flrID, kind, time: x.beginTime, title: `Solar flare${x.classType ? ' · class ' + x.classType : ''}`, detail: short(x.sourceLocation ? `Source region ${x.sourceLocation}.` : 'Solar flare detected.'), link: x.link };
  return { id: x.sepID, kind, time: x.eventTime, title: 'Solar energetic particle event', detail: short(x.instruments?.map((i: any) => i.displayName).join(', ') || 'Energetic particles detected.'), link: x.link };
}

export async function fetchDonki(days = 30, force = false): Promise<DonkiResult> {
  if (cache && !force && Date.now() - cache.fetchedAt < 10 * 60e3 && cache.windowDays === days) return cache;
  const end = new Date(), start = new Date(Date.now() - days * 864e5);
  const events: SpaceEvent[] = [];
  let error: string | undefined;
  await Promise.all(KINDS.map(async kind => {
    try {
      const r = await fetch(`https://api.nasa.gov/DONKI/${kind}?startDate=${iso(start)}&endDate=${iso(end)}&api_key=${KEY}`);
      if (r.status === 404) return; // DONKI answers 404 when the window has no events of this kind
      if (r.status === 429) { error = 'NASA API rate limit reached (DEMO_KEY). Try again later or add a free NASA API key.'; return; }
      if (!r.ok) { error = `NASA DONKI is not reachable right now (HTTP ${r.status}).`; return; }
      const list = await r.json();
      if (Array.isArray(list)) list.forEach(x => events.push(map(kind, x)));
    } catch { error = 'Offline: NASA DONKI could not be reached. Showing nothing rather than guessing.'; }
  }));
  events.sort((a, b) => (a.time < b.time ? 1 : -1));
  cache = { events, fetchedAt: Date.now(), error: error && !events.length ? error : undefined, windowDays: days };
  return cache;
}
