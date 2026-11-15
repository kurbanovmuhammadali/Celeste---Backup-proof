/** Training moved into the Mission tab (second segment). Old links to /plan land there. */
import React from 'react';
import { Redirect } from 'expo-router';
import { TRAINING_HREF } from '@/kit/missionTraining';

export default function PlanRedirect() {
  return <Redirect href={TRAINING_HREF} />;
}
