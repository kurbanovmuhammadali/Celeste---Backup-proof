/** Judge demo mode: switches the whole app to the clearly-labelled synthetic Mars scenario, and back. */
import { dayKey, getStore, setStore } from './store';
import { MARS_BRIEF } from './hmscMission';
import { SCENARIO_MISSION_DAY } from './scenario';

export function enableJudge() {
  setStore(s => ({
    ...s,
    judge: s.judge ?? { prev: { duration: s.profile.duration, missionStart: s.profile.missionStart, briefing: s.briefing } },
    briefing: MARS_BRIEF(),
    profile: { ...s.profile, duration: '900', missionStart: dayKey(-(SCENARIO_MISSION_DAY - 1)) },
  }));
}

export function disableJudge() {
  setStore(s => {
    const prev = s.judge?.prev;
    if (!prev) return s;
    const { judge, ...rest } = s;
    return { ...rest, briefing: prev.briefing ?? s.briefing, profile: { ...s.profile, duration: prev.duration, missionStart: prev.missionStart } };
  });
}

export const judgeOn = () => !!getStore().judge;
