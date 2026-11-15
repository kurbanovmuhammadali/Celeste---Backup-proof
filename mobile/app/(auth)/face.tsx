import React from 'react';
import { FormShell } from '@/astra';
import { nav } from '@/motion';
import FaceScan from '@/FaceScan';

/** Last sign-up step (optional): enrol the face so camera tools recognise this crew member. */
export default function FaceStep() {
  return (
    <FormShell step={7} title="Face scan" sub="Optional · so the camera tools know it’s you among the crew.">
      <FaceScan onDone={() => nav.replace('/team')} />
    </FormShell>
  );
}
