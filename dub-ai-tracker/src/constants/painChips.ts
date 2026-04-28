// S33-A: Pain logger chip display metadata + threshold constants.
//
// The JointPainArea type itself stays in src/types/index.ts (it's reused by
// PerimenopauseEntry). This file holds only display-side metadata (label,
// optional icon, sort order) and the persistence/chronicity thresholds the
// Coach context builder reads.

import type { JointPainArea } from '../types';

/** Display metadata for the 7 pain area chips. Sort order is anatomical
 *  (head-down ish) so a person mentally scanning their body finds chips
 *  in a predictable sequence. */
export const PAIN_CHIP_DISPLAY: Record<JointPainArea, {
  label: string;
  icon?: string;
  sort_order: number;
}> = {
  hands:     { label: 'Hands',             sort_order: 1 },
  shoulders: { label: 'Shoulders',         sort_order: 2 },
  back:      { label: 'Back',              sort_order: 3 },
  hips:      { label: 'Hips',              sort_order: 4 },
  knees:     { label: 'Knees',             sort_order: 5 },
  feet:      { label: 'Feet',              sort_order: 6 },
  general:   { label: 'General / Overall', sort_order: 7 },
};

/** All chip values in display sort order. Convenience for UI rendering. */
export const PAIN_CHIPS_ORDERED: JointPainArea[] =
  (Object.keys(PAIN_CHIP_DISPLAY) as JointPainArea[]).sort(
    (a, b) => PAIN_CHIP_DISPLAY[a].sort_order - PAIN_CHIP_DISPLAY[b].sort_order,
  );

/** Severity 1-5 labels, plain English (no clinical "mild/moderate/severe"). */
export const PAIN_SEVERITY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'barely there',
  2: 'noticeable',
  3: 'distracting',
  4: 'hard to ignore',
  5: "can't ignore",
};

// -- Coach context flag thresholds (not user-configurable in v1) --

/** persistent_pain_areas: an area appears if logged at least this many
 *  times within PAIN_PERSISTENT_THRESHOLD_DAYS. */
export const PAIN_PERSISTENT_THRESHOLD_COUNT = 3;
export const PAIN_PERSISTENT_THRESHOLD_DAYS = 14;

/** chronic_pain_areas: an area appears if it has at least one entry in
 *  AT LEAST PAIN_CHRONIC_THRESHOLD_WEEKS of the last
 *  PAIN_CHRONIC_THRESHOLD_WINDOW ISO weeks. */
export const PAIN_CHRONIC_THRESHOLD_WEEKS = 4;
export const PAIN_CHRONIC_THRESHOLD_WINDOW = 6;
