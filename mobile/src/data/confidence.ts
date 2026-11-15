/**
 * Sensor confidence score: how far an alert can be trusted. Starts at 100 and loses points for stale or missing data,
 * demo or hand-typed data, missing dosimeter readings and a short personal baseline. Every deduction is listed.
 */
import type { useCrew } from './crew';
import { staleSleep } from './freshness';
import type { SourceStatus } from './freshness';

type Crew = ReturnType<typeof useCrew>;
export type Factor = { label: string; delta: number; detail: string };
export type Confidence = { score: number; label: 'High' | 'Moderate' | 'Low'; tone: 'ok' | 'watch' | 'flag'; factors: Factor[] };

const nums = (a: (number | null)[]) => a.filter((v): v is number => v != null);
export function sensorConfidence(crew: Crew, sources: SourceStatus[]): Confidence {
  const f: Factor[] = [];
  const add = (label: string, delta: number, detail: string) => f.push({ label, delta, detail });
  if (crew.synthetic) add('Synthetic scenario', -40, 'These numbers are invented for the demo, not measured.');
  else if (crew.isSample && !crew.handMode) add('Demo or sample data', -35, 'Connect WHOOP or enter your own readings to trust the alerts.');
  else if (crew.handMode) add('Typed by hand', -10, 'Hand-entered numbers depend on how carefully they were measured.');
  const st = staleSleep(crew); if (st) add('Sleep data is old', -20, `Sleep has not updated for ${st.hours} h.`);
  for (const s of sources) {
    if (s.key === 'whoop' && s.state === 'missing') add('WHOOP not connected', -20, 'No device is reporting.');
    else if (s.state === 'stale') add(`${s.label} is stale`, -15, s.detail);
    else if (s.state === 'error') add(`${s.label} error`, -20, s.detail);
    else if (s.key === 'dosimeter' && s.state === 'missing') add('No dosimeter reading', -10, 'Radiation alerts cannot be backed by a measurement.');
  }
  const H = crew.history, gaps = [H.sleep, H.hrv, H.rhr].reduce((a, h) => a + h.slice(-14).filter(v => v == null).length, 0);
  if (gaps > 0) add('Missing readings', -Math.min(25, Math.round(gaps * 1.2)), `${gaps} sleep, HRV or resting-HR readings are missing in the last 14 days.`);
  const bl = Math.min(...[H.sleep, H.hrv, H.rhr].map(h => nums(h.slice(Math.max(0, h.length - 17), Math.max(0, h.length - 3))).length));
  if (bl < 5) add('Short baseline', -25, `Only ${bl} comparable days to compare against (5 needed, 14 ideal).`);
  else if (bl < 10) add('Baseline still building', -10, `${bl} of 14 baseline days.`);
  const score = Math.max(5, Math.min(100, 100 + f.reduce((a, x) => a + x.delta, 0)));
  const label = score >= 75 ? 'High' : score >= 50 ? 'Moderate' : 'Low';
  return { score, label, tone: score >= 75 ? 'ok' : score >= 50 ? 'watch' : 'flag', factors: f };
}
