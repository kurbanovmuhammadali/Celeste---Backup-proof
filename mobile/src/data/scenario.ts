/**
 * SYNTHETIC DEMO SCENARIO: "Mars replay crew". Invented numbers for demonstrating HMSC; not real astronaut data.
 * 28 days, oldest → newest. Baseline for 25 days, then three short nights, HRV down ~14% and resting HR up.
 * Used only in Judge demo mode, and always labelled "Synthetic demo scenario".
 */
export const SCENARIO_NAME = 'Synthetic demo scenario · Mars replay crew';
export const SCENARIO_MISSION_DAY = 74;

export const SCENARIO = {
  recovery: [68, 71, 66, 72, 69, 70, 74, 67, 71, 73, 68, 70, 72, 69, 71, 66, 70, 73, 68, 71, 69, 72, 70, 71, 62, 54, 49, 44] as (number | null)[],
  sleep: [7.2, 7.0, 7.4, 7.1, 7.3, 7.0, 7.2, 7.1, 7.4, 6.9, 7.2, 7.3, 7.0, 7.1, 7.2, 7.3, 7.1, 7.0, 7.4, 7.2, 7.1, 7.3, 7.0, 7.2, 6.4, 5.6, 5.5, 5.4] as (number | null)[],
  // WHOOP-style RMSSD (ms)
  hrv: [49, 51, 48, 50, 52, 49, 50, 48, 51, 50, 49, 52, 50, 49, 51, 50, 48, 50, 51, 49, 50, 52, 49, 50, 46, 44, 43, 42] as (number | null)[],
  rhr: [56, 55, 57, 56, 55, 56, 57, 55, 56, 56, 55, 57, 56, 55, 56, 57, 56, 55, 56, 56, 57, 55, 56, 56, 58, 60, 61, 62] as (number | null)[],
  workoutMin: [60, 45, 62, 0, 58, 40, 0, 61, 44, 59, 0, 60, 42, 63, 0, 58, 45, 60, 0, 59, 41, 62, 0, 60, 44, 30, 20, 25] as (number | null)[],
  mood: 3,
  symptoms: ['Headache'],
};

/** Daily personal-dosimeter dose (mSv/day) for the synthetic crew: full history, so the cumulative total is allowed. */
export const scenarioDose = (missionDay: number) => Array.from({ length: missionDay }, (_, i) => +(0.36 + ((i * 7) % 9) * 0.01).toFixed(2));
