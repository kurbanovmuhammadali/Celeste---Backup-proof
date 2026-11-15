import React from 'react';
import { Redirect } from 'expo-router';

/** Face sign-in setup lives in Profile › Face scan. Old links land there. */
export default function FaceRedirect() {
  return <Redirect href="/profile/face" />;
}
