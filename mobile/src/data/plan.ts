/**
 * Personal mission plan: built from sex, age, height, weight, mission goal, destination, duration, EVA frequency,
 * logged exposures, radiation tracking and stress. All numbers are STARTING ESTIMATES from common formulas
 * (Tanaka max heart rate, Mifflin-St Jeor energy); the flight surgeon, trainer and dietitian set the final values.
 */
import type { Briefing, Exposure } from './store';
import type { RadSummary } from './radiation';
import type { StressSummary } from './stress';
import type { Override } from './override';

export type Tone = 'ok' | 'watch' | 'flag' | 'none';
export type PlanItem = { id: string; title: string; detail: string; tone?: Tone; check?: boolean };
export type PlanSection = { key: 'radiation' | 'training' | 'health' | 'nutrition' | 'sleep' | 'isolation'; title: string; sub: string; items: PlanItem[] };
export type Body = { age: number; sex: string; heightCm: number; weightKg: number };
export type Numbers = { bmi: number; hrMax: number; zone2: [number, number]; kcal: number; protein: [number, number]; waterL: number; loads: { squat: number; row: number; press: number } };
export type Plan = { numbers: Numbers; sections: PlanSection[]; radiationLevel: 0 | 1 | 2; activeExposure: Exposure | null; checklist: PlanItem[] };

const r5 = (v: number, step: number) => Math.round(v / step) * step;
const HOURS72 = 72 * 36e5;

export function bodyNumbers(b: Body): Numbers {
  const s = b.sex === 'Male' ? 5 : b.sex === 'Female' ? -161 : -78;
  const bmr = 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + s;
  const hrMax = Math.round(208 - 0.7 * b.age);
  return {
    bmi: +(b.weightKg / (b.heightCm / 100) ** 2).toFixed(1), hrMax,
    zone2: [Math.round(hrMax * 0.6), Math.round(hrMax * 0.7)],
    kcal: r5(bmr * 1.55, 50), protein: [Math.round(b.weightKg * 1.2), Math.round(b.weightKg * 1.6)], waterL: +(b.weightKg * 0.035).toFixed(1),
    loads: { squat: r5(b.weightKg * 0.6, 2.5), row: r5(b.weightKg * 0.5, 2.5), press: r5(b.weightKg * 0.4, 2.5) },
  };
}

/** 0 baseline · 1 elevated · 2 high: from route, duration and time outside the spacecraft. */
export function radiationLevel(b: Briefing): 0 | 1 | 2 {
  const n = (b.destination === 'iss' ? 1 : 3) + (b.durationDays > 365 ? 1 : 0) + (b.eva === 'daily' ? 1 : b.eva === 'weekly' ? 0 : -1);
  return n >= 3 ? 2 : n >= 1 ? 1 : 0;
}

const GOAL_FOCUS: Record<string, string> = {
  'Surface exploration': 'Lower-body strength and balance: you will walk and carry loads in partial gravity, so squats, lunges and loaded carries come first.',
  'Station operations': 'Full-body maintenance with extra core and grip strength for long tool and repair work.',
  'Science & research': 'A steady routine that protects sleep and focus for precise lab work.',
  'Technology demonstration': 'Peak readiness around test dates: keep hard sessions 48 hours away from key events.',
};

export function exposureChecklist(): PlanItem[] {
  return [
    { id: 'log-dose', title: 'Log your dose', detail: 'Read the personal dosimeter and add the reading in Radiation (interval of the exposure).' },
    { id: 'symptoms', title: 'Watch symptoms for 72 hours', detail: 'Nausea, unusual fatigue, headache, skin redness. Record them in the Daily crew health check.' },
    { id: 'hydrate-eat', title: 'Drink and eat regularly today', detail: 'Add about 0.5 L of water and a full meal within a few hours after the exposure.' },
    { id: 'light-day', title: 'Keep the next 24 hours light', detail: 'Easy Zone 2 cardio or mobility only; skip heavy resistance and max-effort intervals.' },
    { id: 'sleep-shield', title: 'Sleep in the best-shielded quarters', detail: 'Use the most shielded sleeping area available for the next two nights.' },
    { id: 'lab-cbc', title: 'Book a blood count at the next lab draw', detail: 'A complete blood count shows how your cells respond. See the Inspiration4 crew data in Real NASA data for what changes after flight.' },
    { id: 'handoff', title: 'Send a medical handoff if anything is off', detail: 'Symptoms, an unexpectedly high dose or missing history: create a report in Handoff.' },
  ];
}

/** Health considerations from the listed conditions. Keyword rules, deliberately cautious: the flight surgeon decides. */
const RULES: [RegExp, string, string][] = [
  [/knee|hip|ankle|joint|arthr/i, 'Joints', 'Use lower loads and a slow, controlled tempo; skip jumping and hard impact intervals. Ask your flight surgeon before heavy squats.'],
  [/back|spine|disc|sciatic/i, 'Back', 'Keep a neutral spine, use lighter hinges, and swap Romanian deadlifts for glute bridges until your surgeon clears them.'],
  [/shoulder|rotator/i, 'Shoulder', 'Limit overhead pressing and heavy pulling; use rows and light presses within a pain-free range.'],
  [/hypertens|blood pressure|\bbp\b/i, 'Blood pressure', 'Avoid max-effort lifts and breath-holding. Log blood pressure before and after sessions and send a handoff if it stays at or above 140/90.'],
  [/asthma|lung|respir|copd/i, 'Breathing', 'Warm up longer and keep your inhaler within reach. Report wheeze or breathlessness, especially after an EVA or in high-CO₂ air.'],
  [/diabet|glucose|insulin/i, 'Glucose', 'Eat before long sessions, keep a fast carbohydrate nearby, and check glucose after hard sessions. Report lows or spikes.'],
  [/heart|cardiac|arrhythm|palpit/i, 'Heart', 'Stay in Zone 2 and avoid max-effort intervals until your surgeon clears them. Report chest pain or palpitations immediately.'],
  [/depress|anxiet|mood|insomnia|panic/i, 'Mood and sleep', 'Stress tracking matters more for you: keep the daily check and the private wellbeing check, and tell your surgeon early if things slip.'],
  [/migraine|headache/i, 'Headaches', 'Log each headache in the daily check with the time and what you were doing, and report new or worsening ones.'],
];
export function conditionItems(conditions: string[]): PlanItem[] {
  return conditions.map((c, i) => {
    const r = RULES.find(([re]) => re.test(c));
    return { id: `hc-${i}`, tone: 'watch' as Tone, title: `${c}${r ? ` · ${r[1]}` : ''}`, detail: r ? r[2] : 'Noted. Your flight surgeon can see it and tailor the plan: tell them if it affects training or sleep.' };
  });
}

export function buildPlan(p: { body: Body; briefing: Briefing; exposures: Exposure[]; radiation: RadSummary; stress: StressSummary; override?: Override | null; conditions?: string[] }): Plan {
  const { body, briefing: b, radiation, stress, override: ov } = p;
  const n = bodyNumbers(body);
  const lvl = radiationLevel(b);
  const beyond = b.destination !== 'iss';
  const active = [...p.exposures].filter(e => Date.now() - e.at < HOURS72).sort((a, c) => c.at - a.at)[0] ?? null;
  const long = b.durationDays > 90;

  const radiationItems: PlanItem[] = [
    { id: 'rad-level', title: lvl === 2 ? 'Radiation exposure: high for your mission' : lvl === 1 ? 'Radiation exposure: elevated' : 'Radiation exposure: baseline', tone: lvl === 2 ? 'flag' : lvl === 1 ? 'watch' : 'ok',
      detail: beyond ? `${b.destination === 'moon' ? 'The Moon' : 'Mars'} is outside Earth's magnetic protection, so you receive more radiation than in Earth orbit${b.eva !== 'none' ? ', and every time you work outside the spacecraft adds to it' : ''}. Tracking and shielding matter every day, not only on EVA days.` : `Earth orbit is partly shielded, but${b.eva !== 'none' ? ' spacewalks and' : ''} solar storms still raise your dose.` },
    { id: 'rad-before', title: 'Before an EVA or a known solar event', detail: 'Check space weather (Radiation → NASA DONKI) and ask ground control before starting an EVA while a solar particle event is active. Note your dosimeter reading first, drink water, and eat.' },
    { id: 'rad-during', title: 'During', detail: 'Wear your personal dosimeter. If a solar storm alert sounds, move to the shielded storm shelter and stay until mission control clears you.' },
    { id: 'rad-after', title: 'After any exposure', detail: 'Follow the 72-hour post-exposure checklist below: log the dose, watch symptoms, rest, and plan a blood count.' },
    { id: 'rad-track', title: 'How HMSC tracks it',
      detail: `Three separate numbers: dose rate, dose for an interval, and the mission total (shown only with a full history).${radiation.rate != null ? ` At ${radiation.rate.toFixed(2)} mSv/day, 30 days would add about ${(radiation.rate * 30).toFixed(1)} mSv: compare it with the limit your flight surgeon sets.` : ' Add your first dosimeter reading to start.'}`,
      tone: radiation.rate == null ? 'watch' : undefined },
  ];
  if (beyond) radiationItems.push({ id: 'rad-transit', title: 'On long transit legs', detail: 'Sleep and rest in the best-shielded area, and log dose every day: gaps in the history make the total unavailable.' });

  const resistance = ov?.resistancePerWeek ?? (long ? 4 : 3);
  const training: PlanItem[] = [
    { id: 'tr-focus', title: 'Training focus for your goal', detail: GOAL_FOCUS[b.objective] ?? GOAL_FOCUS['Science & research'] },
    { id: 'tr-res', title: `Resistance: ${resistance} sessions a week${ov?.resistancePerWeek ? ' (set by your flight surgeon)' : ''}`, detail: `Starting loads for your body weight (${body.weightKg} kg): squat or deadlift about ${n.loads.squat} kg, row about ${n.loads.row} kg, press about ${n.loads.press} kg for 3 sets of 8 at an effort of 6 to 7 out of 10. Add about 5% when every set feels easy. Bone loss in microgravity is the biggest long-mission risk, so do not skip these.` },
    { id: 'tr-cardio', title: ov?.zone2Minutes ? `Cardio: Zone 2 for ${ov.zone2Minutes} minutes a week (set by your flight surgeon)` : 'Cardio: Zone 2 for 120 to 150 minutes a week', detail: `Your estimated maximum heart rate is ${n.hrMax} bpm, so Zone 2 is about ${n.zone2[0]} to ${n.zone2[1]} bpm. Add one short interval session a week if recovery is good.` },
    { id: 'tr-fit', title: 'Fit the equipment to your height', detail: `At ${body.heightCm} cm, write down your seat, handlebar and harness settings for the cycle, treadmill and resistance device, so every session loads you the same way.` },
  ];
  if (body.age >= 45) training.push({ id: 'tr-age', title: 'Warm up longer', detail: 'Use a 10-minute warm-up and prefer joint-friendly cardio on high-load days.' });
  if (body.sex === 'Female') training.push({ id: 'tr-sex', title: 'Bone and iron checks', detail: 'Ask your flight surgeon to include iron and bone-health markers at each lab draw.' });
  if (ov?.intensity === 'light') training.unshift({ id: 'tr-light', title: 'Flight surgeon: keep intensity light', tone: 'watch', detail: 'Stay at an effort of 5 out of 10 or lower and skip max-effort sets until the plan changes.' });
  if (active) training.unshift({ id: 'tr-exposure', title: 'Exposure in the last 72 hours: keep it light', tone: 'watch', detail: 'Swap heavy resistance and hard intervals for easy Zone 2 or mobility until the post-exposure checklist is complete.' });

  const nutrition: PlanItem[] = [
    { id: 'nu-kcal', title: `Energy: about ${n.kcal} kcal a day`, detail: `A starting estimate for ${body.heightCm} cm, ${body.weightKg} kg, age ${body.age}${body.sex === 'Prefer not to say' ? '' : ', ' + body.sex.toLowerCase()}. Your dietitian adjusts it from real weight change.` },
    { id: 'nu-prot', title: `Protein: ${n.protein[0]} to ${n.protein[1]} g a day`, detail: 'Spread over 3 to 4 meals to protect muscle in microgravity.' },
    { id: 'nu-water', title: `Water: about ${n.waterL} L a day`, detail: 'Add about 0.5 L on EVA days. Dark urine or headache is a signal to drink more.' },
    { id: 'nu-bone', title: 'Calcium and vitamin D', detail: 'Take only what your flight surgeon prescribes. Do not start supplements on your own.' },
  ];

  const sleep: PlanItem[] = [
    { id: 'sl-target', title: 'Sleep 7 to 8 hours at a fixed time', detail: 'Keep the same wake time every day, dim cabin lights 90 minutes before sleep, and keep screens off in the last 30 minutes.' },
    { id: 'sl-stress', title: 'Use WHOOP sleep and recovery as a guide', detail: 'Two short nights in a row: cut optional training and move the hardest session to a recovered day.' },
  ];

  const high = stress.highDays >= 3;
  const isolation: PlanItem[] = [
    { id: 'is-stress', title: `Stress load today: ${stress.level === 'none' ? 'no data' : stress.level}${stress.highDays ? ` · ${stress.highDays} high day${stress.highDays > 1 ? 's' : ''} this week` : ''}`, tone: high ? 'flag' : stress.level === 'high' ? 'watch' : stress.level === 'none' ? 'none' : 'ok', detail: stress.note },
    { id: 'is-routine', title: 'Keep a daily structure', detail: 'Fixed meal times, one shared meal with the crew, and 15 minutes of something just for you (reading, music, drawing).' },
    { id: 'is-contact', title: b.delay === 'minutes' ? 'Record voice messages for family' : 'Call family on a schedule', detail: b.delay === 'minutes' ? `Replies take up to ~22 minutes each way, so send recorded messages and read the replies when they arrive. The family-voice companion can fill the quiet gaps.` : 'Set two fixed call slots a week and keep them.' },
  ];
  if (high) isolation.push({ id: 'is-escalate', title: 'Stress has been high for 3 or more days', tone: 'flag', detail: 'Talk to a crew member you trust and message your flight surgeon or behavioral health contact. HMSC can prepare the handoff.' });

  return {
    numbers: n, radiationLevel: lvl, activeExposure: active, checklist: exposureChecklist(),
    sections: [
      { key: 'radiation', title: 'Radiation protocol', sub: 'What to do before, during and after exposure, and how to track it.', items: radiationItems },
      { key: 'training', title: 'Training', sub: 'Loads and zones from your height, weight, age and goal.', items: training },
      ...(p.conditions?.length ? [{ key: 'health' as const, title: 'Health considerations', sub: 'From the conditions in your background file. Not medical advice: your flight surgeon decides.', items: conditionItems(p.conditions) }] : []),
      { key: 'nutrition', title: 'Nutrition and water', sub: 'Starting estimates from your body numbers.', items: nutrition },
      { key: 'sleep', title: 'Sleep', sub: 'Protect it: it drives recovery and mood.', items: sleep },
      { key: 'isolation', title: 'Isolation and wellbeing', sub: 'Stress tracking and support for the long months.', items: isolation },
    ],
  };
}
