import React from 'react';
import { Redirect } from 'expo-router';

/** The mission briefing lives in Profile › Mission briefing (Celeste). Old links land there. */
export default function BriefingRedirect() {
  return <Redirect href="/profile/briefing" />;
}
