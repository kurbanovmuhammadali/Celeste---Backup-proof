/**
 * Indicator catalogue. Thresholds are DATA, not code: when NASA / a flight surgeon provides
 * official ranges, replace the `ranges` entries (or load them from a JSON file) without touching the engine.
 *
 * range.kind:
 *  - 'abs'       absolute thresholds: green [lo, hi], amber [lo, hi] (outside amber → red)
 *  - 'baseline'  % deviation from the astronaut's personal 14-day baseline
 *  - 'min'       higher is better: green >= g, amber >= a, else red
 *  - 'max'       lower is better: green <= g, amber <= a, else red
 */
export const METRICS = {
  recovery: {
    label: 'Recovery', unit: '%', system: 'heart', source: 'WHOOP', range: { kind: 'min', g: 67, a: 34 },
    what: 'WHOOP recovery combines HRV, resting heart rate, respiratory rate and sleep into a 0–100 % readiness score.',
    space: 'Isolation, CO₂, noise and disrupted light cycles on a station all reduce recovery. A low score means your body has not adapted to yesterday\'s load.',
    how: 'Measured automatically while you sleep. Wear the band snugly, 2 fingers above the wrist bone.',
  },
  hrv: {
    label: 'HRV', unit: 'ms', system: 'brain', source: 'WHOOP', range: { kind: 'baseline', dir: 'low', amber: 10, red: 25 },
    what: 'Heart-rate variability (RMSSD) — the beat-to-beat variation of your heart. Higher usually means a relaxed, recovered nervous system.',
    space: 'Spaceflight shifts autonomic balance. A sustained drop versus YOUR pre-flight baseline is an early sign of stress, poor sleep, illness or overtraining.',
    how: 'Measured during deep sleep by the wearable. Compare only with your own baseline, never with other crew members.',
  },
  rhr: {
    clinical: true, label: 'Resting HR', unit: 'bpm', system: 'heart', source: 'WHOOP', range: { kind: 'abs', green: [40, 75], amber: [36, 90] },
    what: 'Your heart rate at full rest, measured during sleep.',
    space: 'Fluid shifts toward the head and cardiovascular deconditioning change resting HR in microgravity. A rise of 5–7 bpm over baseline can signal infection, dehydration or fatigue.',
    how: 'Automatic from the wearable, or count your pulse for 60 s right after waking.',
  },
  spo2: {
    clinical: true, label: 'Blood oxygen', unit: '%', system: 'heart', source: 'WHOOP', range: { kind: 'min', g: 95, a: 92 },
    what: 'Oxygen saturation of your blood (SpO₂).',
    space: 'Cabin atmosphere problems or respiratory illness lower SpO₂. Below 92 % needs immediate attention.',
    how: 'Automatic during sleep, or use the pulse oximeter in the medical kit: sit still, warm finger, 60 s.',
  },
  sleep: {
    label: 'Sleep', unit: 'h', system: 'brain', source: 'WHOOP', range: { kind: 'min', g: 7, a: 6 },
    what: 'Hours actually asleep (light + deep + REM), excluding time awake in bed.',
    space: 'ISS crews average ~6 h of sleep. 16 sunrises a day, noise, CO₂ and workload break your circadian rhythm. Short sleep drives mood, cognition and immune problems.',
    how: 'Tracked by the wearable. Keep the sleep station dark and log caffeine.',
  },
  strain: {
    label: 'Strain', unit: '', system: 'bones', source: 'WHOOP', range: { kind: 'min', g: 10, a: 7 },
    what: 'WHOOP day strain (0–21): how much cardiovascular load your body took today.',
    space: 'Without gravity, bones and muscles lose load. Daily exercise (~2.5 h on ISS) is the main countermeasure; low strain days mean the countermeasure was missed.',
    how: 'Automatic. Exercise sessions on treadmill (T2), cycle (CEVIS) and resistance device (ARED) count.',
  },
  bp: {
    clinical: true, label: 'Blood pressure', unit: 'mmHg', system: 'heart', source: 'Manual', dual: true,
    range: { kind: 'bp' },
    what: 'Systolic / diastolic arterial pressure.',
    space: 'Head-ward fluid shift, stress and CO₂ affect BP. Repeated readings ≥ 140/90 increase cardiovascular risk and are linked to eye changes (SANS).',
    how: 'Sit 5 min, arm at heart level, cuff on bare upper arm. Take 2 readings 1 min apart.',
  },
  glucose: {
    clinical: true, label: 'Blood glucose', unit: 'mg/dL', system: 'metabolism', source: 'Manual', range: { kind: 'abs', green: [70, 99], amber: [60, 125] },
    what: 'Fasting blood sugar.',
    space: 'Spaceflight reduces insulin sensitivity; inactivity and stress raise glucose.',
    how: 'Fasting (8 h), finger-prick glucometer, clean finger, discard first drop.',
  },
  temp: {
    clinical: true, label: 'Body temp', unit: '°C', system: 'immune', source: 'Manual', range: { kind: 'abs', green: [36.1, 37.2], amber: [35.5, 37.9] },
    what: 'Core body temperature.',
    space: 'Body temperature in space runs ~1 °C higher during exercise ("space fever"). Fever ≥ 38 °C may mean infection — immune function is weakened in flight.',
    how: 'Oral or ear thermometer, at rest, not within 30 min of exercise or hot drinks.',
  },
  weight: {
    label: 'Body mass', unit: 'kg', system: 'metabolism', source: 'Manual', range: { kind: 'baseline', dir: 'low', amber: 3, red: 5 },
    what: 'Total body mass.',
    space: 'Most astronauts lose mass in flight from under-eating and muscle loss. More than 5 % loss from baseline needs a nutrition plan.',
    how: 'On ISS: SLAMMD (spring-oscillation mass device). Same time, after waking, after toilet.',
  },
  mood: {
    label: 'Mood', unit: '/100', system: 'brain', source: 'Check-in', range: { kind: 'min', g: 60, a: 40 },
    what: 'Self-rated mood from your daily check-in.',
    space: 'Isolation and confinement are one of the 5 hazards. Trends matter more than single days. Persistent low mood should be discussed in the private psychological conference.',
    how: 'Rate honestly every morning in the check-in dial. Data stays between you and the flight surgeon.',
  },
  ntx: {
    label: 'Bone resorption (NTx)', unit: 'nmol/mmol', system: 'bones', source: 'Lab', range: { kind: 'baseline', dir: 'high', amber: 10, red: 25 },
    what: 'Urinary N-telopeptide — a marker of how fast bone is being broken down.',
    space: 'Astronauts lose 1–1.5 % of hip & spine bone mass per month. Rising NTx is the earliest measurable signal, months before a scan.',
    how: 'Second-void morning urine sample, processed per lab protocol.',
  },
  vitd: {
    clinical: true, label: 'Vitamin D', unit: 'ng/mL', system: 'bones', source: 'Lab', range: { kind: 'min', g: 30, a: 20 },
    what: '25-hydroxy vitamin D in blood.',
    space: 'No sunlight on a spacecraft — crews rely on supplements. Low vitamin D accelerates bone loss.',
    how: 'Blood draw, analysed on board or after return.',
  },
  radiation: {
    clinical: true, label: 'Radiation dose', unit: 'mSv', system: 'immune', source: 'Dosimeter', range: { kind: 'max', g: 1, a: 2 },
    what: 'Daily absorbed dose from your personal dosimeter.',
    space: 'ISS: ~0.5–1 mSv/day. Solar particle events can spike it; shelter in the most shielded module if told to.',
    how: 'Read your personal dosimeter, or enter the module reading from the radiation monitor.',
  },
  co2: {
    label: 'Cabin CO₂', unit: 'mmHg', system: 'eyes', source: 'Environment', range: { kind: 'max', g: 3, a: 4 },
    what: 'Partial pressure of CO₂ in your module.',
    space: 'CO₂ pockets form without convection. High CO₂ causes headaches and may contribute to SANS (eye changes).',
    how: 'Read the module CDM / CO₂ monitor near your sleep station.',
  },
  exercise: {
    label: 'Exercise', unit: 'min', system: 'bones', source: 'Plan', range: { kind: 'min', g: 120, a: 80 },
    what: 'Minutes of countermeasure exercise completed today.',
    space: 'Prescribed exercise is the main protection against bone, muscle and heart deconditioning.',
    how: 'Logged automatically from WHOOP workouts or by completing plan tasks.',
  },
};

export const SYSTEMS = {
  heart: { label: 'Heart & vessels', metrics: ['rhr', 'bp', 'spo2', 'recovery'], hazard: 'Gravity fields', blurb: 'Fluid shifts and less work against gravity decondition the heart; radiation may harm blood vessels long-term.' },
  bones: { label: 'Bones & muscle', metrics: ['ntx', 'vitd', 'strain', 'exercise'], hazard: 'Gravity fields', blurb: 'Without load, bones lose 1–1.5 %/month and muscles atrophy. Exercise and nutrition are the countermeasures.' },
  brain: { label: 'Brain & mood', metrics: ['mood', 'sleep', 'hrv'], hazard: 'Isolation & confinement', blurb: 'Confinement, workload and circadian disruption affect sleep, mood, cognition and crew cohesion.' },
  eyes: { label: 'Eyes (SANS)', metrics: ['co2'], symptoms: ['vision', 'headache'], hazard: 'Gravity fields', blurb: 'Spaceflight-Associated Neuro-ocular Syndrome: fluid shift swells the optic disc and changes vision.' },
  immune: { label: 'Immune & radiation', metrics: ['temp', 'radiation'], symptoms: ['fever', 'sore_throat', 'rash'], hazard: 'Radiation & closed environment', blurb: 'Immune function is altered in flight; latent viruses can reactivate. Radiation adds cumulative risk.' },
  metabolism: { label: 'Metabolism & nutrition', metrics: ['glucose', 'weight'], hazard: 'Distance from Earth', blurb: 'Limited food variety, under-eating and inactivity change body mass and blood sugar.' },
};

export const SYMPTOMS = {
  headache: { label: 'Headache', system: 'eyes', severity: 'amber' },
  vision: { label: 'Blurry / changed vision', system: 'eyes', severity: 'red' },
  fever: { label: 'Feeling feverish', system: 'immune', severity: 'amber' },
  sore_throat: { label: 'Sore throat / congestion', system: 'immune', severity: 'amber' },
  rash: { label: 'Skin rash', system: 'immune', severity: 'amber' },
  chest_pain: { label: 'Chest pain / palpitations', system: 'heart', severity: 'red' },
  dizziness: { label: 'Dizziness', system: 'heart', severity: 'amber' },
  back_pain: { label: 'Back pain', system: 'bones', severity: 'amber' },
  insomnia: { label: 'Trouble sleeping', system: 'brain', severity: 'amber' },
  anxiety: { label: 'Anxious / low', system: 'brain', severity: 'amber' },
};

/** The mission's own prescribed daily plan (imported "as is" — we never delete these items). */
export const DEFAULT_MISSION_PLAN = [
  { key: 'checkin', title: 'Morning check-in', detail: 'Mood dial + symptoms', category: 'measure', target: 1, unit: '', xp: 20, metric: 'mood' },
  { key: 'bp', title: 'Blood pressure & pulse', detail: 'Seated, 2 readings', category: 'measure', target: 1, unit: '', xp: 20, metric: 'bp' },
  { key: 'treadmill', title: 'Treadmill run (T2)', detail: 'Harness load 70 % body weight', category: 'exercise', target: 1, unit: 'km', xp: 40 },
  { key: 'ared', title: 'Resistance (ARED)', detail: 'Squats, deadlifts, heel raises', category: 'exercise', target: 60, unit: 'min', xp: 40 },
  { key: 'cevis', title: 'Cycle ergometer (CEVIS)', detail: 'Zone 2 intervals', category: 'exercise', target: 30, unit: 'min', xp: 30 },
  { key: 'vitd', title: 'Vitamin D3 supplement', detail: '800 IU with breakfast', category: 'nutrition', target: 1, unit: '', xp: 10 },
  { key: 'water', title: 'Hydration', detail: 'Drink pouches', category: 'nutrition', target: 2.5, unit: 'L', xp: 10 },
  { key: 'sleep', title: 'Sleep window', detail: '22:00 – 06:30 GMT', category: 'recovery', target: 8.5, unit: 'h', xp: 20 },
];
