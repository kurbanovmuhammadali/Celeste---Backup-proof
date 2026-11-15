export type Snap = {
  key: string; label: string; unit: string; system: string; value: number | null; value2: number | null;
  status: 'green' | 'amber' | 'red' | 'none'; deviation: number | null; baseline: number | null;
  recordedAt: string | null; stale: boolean; source: string | null; spark: (number | null)[];
};
export type System = { key: string; label: string; hazard: string; blurb: string; status: string; reasons: { metric?: string; symptom?: string; label: string; status: string }[]; metrics: string[] };
export type Alert = { level: 'red' | 'amber'; title: string; body: string; escalate?: boolean; metric?: string; system?: string };
export type Game = { xp: number; level: number; levelProgress: number; nextLevelXp: number; streak: number; badges: { key: string; label: string; earned: boolean; hint: string }[] };
export type Dashboard = {
  readiness: number; metrics: Record<string, Snap>; systems: System[]; alerts: Alert[];
  checkin: { mood: number; symptoms: string[]; recorded_at: string } | null; checkedInToday: boolean; game: Game;
};
export type Task = {
  key: string; title: string; detail: string; category: string; target?: number; unit?: string; xp: number; done: boolean;
  origin: 'mission' | 'perigee'; kind?: 'add' | 'modify' | 'escalate'; reason?: string; needsApproval?: boolean; escalate?: boolean; baseKey?: string; adaptations?: string[];
};
export type Plan = { day: string; source: string; items: Task[]; adaptations: Task[]; progress: number; xpAvailable: number; readiness: number };
