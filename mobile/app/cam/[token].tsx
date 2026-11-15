import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import CaptureView from '@/kit/CaptureView';

/** Private camera link (kept for later): reachable only by /cam/<token>. */
export default function CamLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <CaptureView base={`/api/cam/${token}`} />;
}
