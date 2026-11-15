/**
 * Form check (optional countermeasure tool). A phone or laptop camera stands in for the exercise devices in this prototype:
 * a pretrained pose model (MediaPipe, bundled, runs on the device) counts push-ups, pull-ups and squats. No frame leaves the device.
 */
import React from 'react';
import { View } from 'react-native';
import { K } from '@/kit/tokens';
import { Txt } from '@/kit/core';
import { Notice, PageHead, TopBar } from '@/kit/ui';
import { Page } from '@/kit/page';
import CameraTracker from '@/kit/CameraTracker';

export default function FormCheck() {
  return (
    <Page title="Form check" maxWidth={760} header={<TopBar title="Form check" />}>
      <PageHead kicker="Countermeasure tool" title="Count my reps" sub="Push-ups: film from the side. Pull-ups: face the camera. Whole body in frame." style={{ marginTop: 6 }} />
      <View style={{ marginTop: 12 }}><CameraTracker /></View>
      <View style={{ marginTop: 12 }}><Notice tone="watch" title="Prototype" body="In orbit crews train on ARED, CEVIS and T2, which this app is not connected to. The camera is a demonstration." /></View>
      <Txt v="caption" color={K.ink3} style={{ marginTop: 10 }}>Video stays on your device.</Txt>
    </Page>
  );
}
