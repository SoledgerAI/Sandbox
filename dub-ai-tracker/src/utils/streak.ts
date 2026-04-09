// Streak calculation utility
// Sprint 15: 7-Day Streak Badge

import { STORAGE_KEYS, storageGet, storageList } from './storage';

/** Calculate consecutive days with at least one log entry */
export async function calculateStreak(): Promise<number> {
  const allLogPrefixes = [
    STORAGE_KEYS.LOG_FOOD, STORAGE_KEYS.LOG_WATER, STORAGE_KEYS.LOG_CAFFEINE,
    STORAGE_KEYS.LOG_WORKOUT, STORAGE_KEYS.LOG_STRENGTH, STORAGE_KEYS.LOG_BODY,
    STORAGE_KEYS.LOG_SLEEP, STORAGE_KEYS.LOG_MOOD, STORAGE_KEYS.LOG_SUPPLEMENTS,
    STORAGE_KEYS.LOG_SUBSTANCES, STORAGE_KEYS.LOG_GRATITUDE, STORAGE_KEYS.LOG_MEDITATION,
    STORAGE_KEYS.LOG_STRESS, STORAGE_KEYS.LOG_THERAPY, STORAGE_KEYS.LOG_SEXUAL,
    STORAGE_KEYS.LOG_CYCLE, STORAGE_KEYS.LOG_DIGESTIVE, STORAGE_KEYS.LOG_PERSONALCARE,
    STORAGE_KEYS.LOG_INJURY, STORAGE_KEYS.LOG_BLOODWORK, STORAGE_KEYS.LOG_GLUCOSE,
    STORAGE_KEYS.LOG_BP, STORAGE_KEYS.LOG_CUSTOM, STORAGE_KEYS.LOG_STEPS,
  ];

  // Collect all logged dates from storage keys
  const loggedDatesSet = new Set<string>();
  for (const prefix of allLogPrefixes) {
    const keys = await storageList(prefix + '.');
    for (const key of keys) {
      // Key format: dub.log.food.2026-04-09
      const dateStr = key.split('.').pop();
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        loggedDatesSet.add(dateStr);
      }
    }
  }

  if (loggedDatesSet.size === 0) return 0;

  // Count consecutive days ending with today (or yesterday with grace)
  const today = new Date();
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(new Date(today.getTime() - 86400000));

  // Start from today or yesterday
  let startDate: Date;
  if (loggedDatesSet.has(todayStr)) {
    startDate = today;
  } else if (loggedDatesSet.has(yesterdayStr)) {
    startDate = new Date(today.getTime() - 86400000);
  } else {
    return 0;
  }

  let streak = 0;
  const d = new Date(startDate);
  while (loggedDatesSet.has(formatDate(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return streak;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
