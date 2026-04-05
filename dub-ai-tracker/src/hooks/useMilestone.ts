// Milestone recognition hook — earned moments only
// P2-05: No gamification. No confetti, badges, XP.
// Checks total_days_logged against thresholds and PR records.
// Returns at most one unacknowledged milestone at a time.
// Acknowledged milestones are permanently dismissed.

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, storageList, STORAGE_KEYS, dateKey } from '../utils/storage';
import type { StreakData } from '../types/profile';
import type { StrengthEntry } from '../types/strength';

// ============================================================
// Milestone Definitions
// ============================================================

const DAY_MILESTONES = [7, 14, 28, 50, 100, 200, 365] as const;

/** Messages are factual, not celebratory. Earned, not rewarded. */
const DAY_MESSAGES: Record<number, string> = {
  7: "7 days of showing up. That's a start.",
  14: "14 days logged. You're building a habit.",
  28: "28 days of data. That's a full cycle of consistency.",
  50: "50 days logged. The data is getting useful.",
  100: "100 days of showing up. That's consistency.",
  200: "200 days. Your data tells a real story now.",
  365: "One year. 365 days of tracking your health.",
};

export interface MilestoneInfo {
  id: string;
  type: 'days' | 'pr';
  title: string;
  message: string;
  icon: 'checkmark-done-outline' | 'ribbon-outline' | 'fitness-outline';
}

export interface UseMilestoneResult {
  milestone: MilestoneInfo | null;
  acknowledge: () => Promise<void>;
  loading: boolean;
}

// ============================================================
// Hook
// ============================================================

export function useMilestone(streak: StreakData | null): UseMilestoneResult {
  const [milestone, setMilestone] = useState<MilestoneInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!streak) {
      setLoading(false);
      return;
    }
    checkMilestones(streak).then((m) => {
      setMilestone(m);
      setLoading(false);
    });
  }, [streak]);

  const acknowledge = useCallback(async () => {
    if (!milestone) return;
    const acknowledged = await storageGet<string[]>(STORAGE_KEYS.MILESTONES_ACKNOWLEDGED) ?? [];
    if (!acknowledged.includes(milestone.id)) {
      await storageSet(STORAGE_KEYS.MILESTONES_ACKNOWLEDGED, [...acknowledged, milestone.id]);
    }
    setMilestone(null);
  }, [milestone]);

  return { milestone, acknowledge, loading };
}

// ============================================================
// Detection Logic
// ============================================================

async function checkMilestones(streak: StreakData): Promise<MilestoneInfo | null> {
  const acknowledged = await storageGet<string[]>(STORAGE_KEYS.MILESTONES_ACKNOWLEDGED) ?? [];
  const ackSet = new Set(acknowledged);

  // Check day milestones — highest earned but unacknowledged wins
  // "earned" means total_days_logged >= milestone
  let dayMilestone: MilestoneInfo | null = null;
  for (const days of DAY_MILESTONES) {
    const id = `days_${days}`;
    if (streak.total_days_logged >= days && !ackSet.has(id)) {
      dayMilestone = {
        id,
        type: 'days',
        title: `${days} Days Logged`,
        message: DAY_MESSAGES[days],
        icon: days >= 100 ? 'ribbon-outline' : 'checkmark-done-outline',
      };
      // Don't break — keep going to find the highest earned milestone
    }
  }

  // Check for new PR (from recent strength log entries)
  const prMilestone = await checkRecentPR(ackSet);

  // PR takes priority over day milestones (more specific, more earned)
  // But only one card at a time — PR first, then day milestone
  return prMilestone ?? dayMilestone;
}

/**
 * Scan today's and yesterday's strength logs for a new personal record.
 * A PR is the highest weight on any set for a given exercise across all history.
 */
async function checkRecentPR(ackSet: Set<string>): Promise<MilestoneInfo | null> {
  const today = new Date();
  const todayStr = formatDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday);
  const recentDates = [todayStr, yesterdayStr];

  // Load recent strength entries
  for (const date of recentDates) {
    const entries = await storageGet<StrengthEntry[]>(dateKey(STORAGE_KEYS.LOG_STRENGTH, date));
    if (!entries || entries.length === 0) continue;

    for (const entry of entries) {
      for (const exercise of entry.exercises) {
        const maxWeight = Math.max(...exercise.sets.map((s) => s.weight_lbs));
        if (maxWeight <= 0) continue;

        // Check if this is a new all-time PR for this exercise
        const isPR = await isPersonalRecord(exercise.name, maxWeight, date);
        if (!isPR) continue;

        const id = `pr_${exercise.name}_${date}`;
        if (ackSet.has(id)) continue;

        const bestSet = exercise.sets.reduce((best, s) =>
          s.weight_lbs > best.weight_lbs ? s : best,
        );

        return {
          id,
          type: 'pr',
          title: `New PR: ${exercise.name}`,
          message: `${exercise.name} ${bestSet.weight_lbs} lbs x ${bestSet.reps}. New personal record.`,
          icon: 'fitness-outline',
        };
      }
    }
  }

  return null;
}

/**
 * Check if a given weight for an exercise exceeds all previous entries.
 * Scans all historical strength log keys (excluding the current date).
 */
async function isPersonalRecord(
  exerciseName: string,
  weight: number,
  currentDate: string,
): Promise<boolean> {
  const allKeys = await storageList('dub.log.strength.');
  let previousMax = 0;

  for (const key of allKeys) {
    // Skip the current date — we're comparing against history
    if (key.endsWith(currentDate)) continue;

    const entries = await storageGet<StrengthEntry[]>(key);
    if (!entries) continue;

    for (const entry of entries) {
      for (const ex of entry.exercises) {
        if (ex.name === exerciseName) {
          for (const set of ex.sets) {
            if (set.weight_lbs > previousMax) {
              previousMax = set.weight_lbs;
            }
          }
        }
      }
    }
  }

  // PR only if we have prior data AND current weight exceeds it
  return previousMax > 0 && weight > previousMax;
}

// ============================================================
// Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================================
// Export for Coach Context
// ============================================================

/**
 * Get the currently active (unacknowledged) milestone string for coach context.
 * Returns null if no milestone is active.
 */
export async function getActiveMilestone(streak: StreakData): Promise<string | null> {
  const acknowledged = await storageGet<string[]>(STORAGE_KEYS.MILESTONES_ACKNOWLEDGED) ?? [];
  const ackSet = new Set(acknowledged);

  // Check highest earned day milestone
  for (let i = DAY_MILESTONES.length - 1; i >= 0; i--) {
    const days = DAY_MILESTONES[i];
    const id = `days_${days}`;
    if (streak.total_days_logged >= days && !ackSet.has(id)) {
      return `milestone: ${days} days logged`;
    }
  }

  return null;
}
