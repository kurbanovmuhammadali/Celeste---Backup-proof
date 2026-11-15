/**
 * Mission Briefing → five-hazard mission profile.
 * NASA's Human Research Program frames astronaut risk around five connected hazards:
 * radiation, isolation and confinement, distance from Earth, altered gravity, hostile/closed environments.
 * The levels below are an illustrative, rule-based reading of the briefing: not an official NASA risk assessment.
 */
import type { Briefing } from './store';

export const DESTINATIONS = {
  iss: { label: 'ISS', sub: 'Low Earth orbit', delay: 'none' as const },
  moon: { label: 'Moon', sub: 'Lunar surface / gateway', delay: 'seconds' as const },
  mars: { label: 'Mars', sub: 'Transit and surface', delay: 'minutes' as const },
};
export const OBJECTIVES = ['Station operations', 'Science & research', 'Surface exploration', 'Technology demonstration'];
export const DELAYS = { none: 'Real-time', seconds: '1–3 seconds', minutes: 'Up to ~22 min each way' } as const;
export const EVAS = { none: 'None', weekly: 'About weekly', daily: 'Near daily' } as const;
export const SENSORS = ['WHOOP', 'Personal dosimeter', 'Cabin CO₂ sensor', 'Medical lab (blood)', 'Manual entry only'];

/** One-way communication delay in seconds (used by the simulated handoff queue). */
export const delaySeconds = (d: Briefing['delay']) => (d === 'none' ? 0 : d === 'seconds' ? 3 : 22 * 60);

export const DEFAULT_BRIEFING = (): Briefing => ({ destination: 'iss', durationDays: 180, objective: OBJECTIVES[0], delay: 'none', eva: 'weekly', crew: 4, sensors: ['Manual entry only'], at: Date.now() });
export const MARS_BRIEFING = (): Briefing => ({ destination: 'mars', durationDays: 900, objective: OBJECTIVES[2], delay: 'minutes', eva: 'weekly', crew: 4, sensors: ['WHOOP', 'Personal dosimeter', 'Cabin CO₂ sensor', 'Medical lab (blood)'], at: Date.now() });

export type HazardKey = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export type HazardLevel = 0 | 1 | 2; // 0 baseline · 1 elevated · 2 high
export type Hazard = { key: HazardKey; label: string; level: HazardLevel; reason: string; track: string };
export const LEVEL_WORD = ['Baseline', 'Elevated', 'High'] as const;

export function hazardProfile(b: Briefing): Hazard[] {
  const long = b.durationDays > 365, mid = b.durationDays > 180;
  const has = (s: string) => b.sensors.includes(s);
  const lvl = (n: number): HazardLevel => (n >= 3 ? 2 : n >= 1 ? 1 : 0);
  return [
    { key: 'radiation', label: 'Radiation', track: 'Dosimeter · DONKI space-weather context',
      level: lvl((b.destination === 'iss' ? 1 : 3) + (long ? 1 : 0) + (b.eva === 'daily' ? 1 : 0)),
      reason: b.destination === 'iss' ? 'Low Earth orbit is partly shielded; dose still accumulates every day.' : 'Beyond low Earth orbit there is far less magnetic shielding, and solar events matter more.' },
    { key: 'isolation', label: 'Isolation & confinement', track: 'Mood · sleep · stress check-ins',
      level: lvl((mid ? 1 : 0) + (long ? 1 : 0) + (b.crew <= 2 ? 1 : 0) + (b.destination === 'mars' ? 1 : 0)),
      reason: `${b.crew} crew over ${b.durationDays} days: mood and sleep drift is easier to miss in a small, closed group.` },
    { key: 'distance', label: 'Distance from Earth', track: 'Offline handoff queue',
      level: b.delay === 'minutes' ? 2 : b.delay === 'seconds' ? 1 : 0,
      reason: b.delay === 'minutes' ? 'Each message can take up to ~22 minutes one way, so the crew must self-assess and queue reports.' : b.delay === 'seconds' ? 'A short delay: conversations work, but live monitoring is not instant.' : 'Real-time contact with the ground is available.' },
    { key: 'gravity', label: 'Altered gravity', track: 'Training load · bone & muscle signals',
      level: lvl((mid ? 2 : b.durationDays > 60 ? 1 : 0) + (long ? 1 : 0)),
      reason: 'Microgravity reduces bone and muscle loading; the effect grows with mission length.' },
    { key: 'environment', label: 'Hostile / closed environment', track: has('Cabin CO₂ sensor') ? 'Cabin CO₂ sensor · symptoms' : 'Symptoms · cabin notes (no CO₂ sensor)',
      level: lvl(1 + (b.destination === 'mars' ? 2 : 0) + (has('Cabin CO₂ sensor') ? 0 : 1)),
      reason: has('Cabin CO₂ sensor') ? 'Closed air, noise and microbes: watch cabin CO₂ and symptoms such as headache.' : 'No cabin sensor selected: environment is tracked through symptoms and manual notes only.' },
  ];
}

/** Judge / demo Mars mission in the unified brief shape (what the store keeps). */
export const MARS_BRIEF = (): import('./store').MissionBrief => {
  const d = (n: number) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return { dest: 'mars', commDelayMin: 12, evaDates: [d(1), d(9)], crewSize: 4, objective: OBJECTIVES[2], eva: 'weekly', durationDays: 900, sensors: ['WHOOP', 'Personal dosimeter', 'Cabin CO₂ sensor', 'Medical lab (blood)'], at: Date.now() };
};
