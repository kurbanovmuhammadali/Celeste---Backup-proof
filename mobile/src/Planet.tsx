/** Mission destination icon — the user's design-handoff SVGs (Earth orbit, Moon, Mars, Jupiter, Deep space). */
import React from 'react';
import { SvgXml } from 'react-native-svg';
import { DEST_SVG } from './art';
import type { GoalDest } from './onboarding';

export default function Planet({ k, size = 40 }: { k: GoalDest; size?: number }) {
  return <SvgXml xml={DEST_SVG[k]} width={size} height={size} />;
}
