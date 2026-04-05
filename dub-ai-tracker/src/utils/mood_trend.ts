// Mood trend detection — pattern-based check for sustained low mood / high anxiety
// Wave 2 P1: Automated mood-trend detection with crisis resource surfacing
//
// SAFETY FEATURE: This module detects mood patterns that may indicate a user
// is struggling. It does NOT diagnose. It does NOT store alerts in exportable data.
// Alerts are computed on-the-fly from mood log data.
//
// TRIGGERS (any one sufficient):
//   a. Mood score 1-2 for 3+ consecutive days
//   b. Anxiety score 4-5 for 3+ consecutive days
//   c. Mood score 1 on any single day (immediate)

import { storageGet, STORAGE_KEYS, dateKey } from './storage';
import type { MoodEntry } from '../types';

export interface MoodTrendResult {
  /** Whether any trigger condition is met */
  triggered: boolean;
  /** Which trigger(s) fired — for Coach context only, never shown to user */
  triggers: MoodTriggerType[];
}

export type MoodTriggerType =
  | 'sustained_low_mood'    // mood 1-2 for 3+ consecutive days
  | 'sustained_high_anxiety' // anxiety 4-5 for 3+ consecutive days
  | 'immediate_crisis_mood'; // mood 1 on any single day

function pastDateString(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Evaluate mood trend triggers from the last 7 days of mood data.
 * Pure async function — no side effects, no stored state.
 */
export async function evaluateMoodTrend(): Promise<MoodTrendResult> {
  const triggers: MoodTriggerType[] = [];

  // Load last 7 days of mood entries (today = index 0)
  const dailyMoods: { avgMood: number | null; avgAnxiety: number | null }[] = [];

  for (let i = 0; i < 7; i++) {
    const date = pastDateString(i);
    const entries = await storageGet<MoodEntry[]>(dateKey(STORAGE_KEYS.LOG_MOOD, date));

    if (!entries || entries.length === 0) {
      dailyMoods.push({ avgMood: null, avgAnxiety: null });
      continue;
    }

    const avgMood = entries.reduce((s, m) => s + m.score, 0) / entries.length;

    const withAnxiety = entries.filter((m) => m.anxiety != null);
    const avgAnxiety = withAnxiety.length > 0
      ? withAnxiety.reduce((s, m) => s + m.anxiety!, 0) / withAnxiety.length
      : null;

    dailyMoods.push({ avgMood, avgAnxiety });
  }

  // Trigger C: Mood 1 on any single day (immediate)
  // Check all 7 days — if ANY day has avg mood of 1 (or rounds to 1), trigger
  for (const day of dailyMoods) {
    if (day.avgMood != null && day.avgMood <= 1) {
      triggers.push('immediate_crisis_mood');
      break;
    }
  }

  // Trigger A: Mood 1-2 for 3+ consecutive days
  // Walk from most recent (index 0) backward, counting consecutive low-mood days
  // Skip null days (no data) — they do NOT break the streak but also don't count
  {
    let consecutive = 0;
    for (const day of dailyMoods) {
      if (day.avgMood == null) continue; // no data, skip
      if (day.avgMood <= 2) {
        consecutive++;
      } else {
        break; // streak broken by a day with mood > 2
      }
    }
    if (consecutive >= 3 && !triggers.includes('sustained_low_mood')) {
      triggers.push('sustained_low_mood');
    }
  }

  // Trigger B: Anxiety 4-5 for 3+ consecutive days
  {
    let consecutive = 0;
    for (const day of dailyMoods) {
      if (day.avgAnxiety == null) continue; // no data, skip
      if (day.avgAnxiety >= 4) {
        consecutive++;
      } else {
        break; // streak broken
      }
    }
    if (consecutive >= 3) {
      triggers.push('sustained_high_anxiety');
    }
  }

  return {
    triggered: triggers.length > 0,
    triggers,
  };
}
