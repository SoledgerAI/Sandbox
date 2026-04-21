// Typed AsyncStorage wrapper for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 7: AsyncStorage Key Structure
//
// DATA-AT-REST PROTECTION
// App-layer encryption is not applied. Data-at-rest
// protection relies on:
//   iOS: NSFileProtection (device-lock-bound encryption)
//   Android: Full-disk encryption (modern devices)
//   App-layer: PIN + biometric gate (authService.ts)
// For HIPAA-covered deployments, app-layer encryption
// must be re-implemented before handling PHI.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// Storage Key Constants
// All keys use dot-delimited namespacing.
// Date-keyed entries use YYYY-MM-DD.
// ============================================================

export const STORAGE_KEYS = {
  // Profile and Settings
  PROFILE: 'dub.profile',
  SETTINGS: 'dub.settings',
  TIER: 'dub.tier',
  TAGS_ENABLED: 'dub.tags.enabled',
  TAGS_ORDER: 'dub.tags.order',
  ONBOARDING_COMPLETE: 'dub.onboarding.complete',
  ONBOARDING_DATE: 'dub.onboarding.date',
  DEFERRED_SETUP: 'dub.deferred.setup',

  // Daily Logs (functions that take a date parameter)
  LOG_FOOD: 'dub.log.food',
  LOG_WATER: 'dub.log.water',
  LOG_CAFFEINE: 'dub.log.caffeine',
  LOG_WORKOUT: 'dub.log.workout',
  LOG_STRENGTH: 'dub.log.strength',
  LOG_STEPS: 'dub.log.steps',
  LOG_BODY: 'dub.log.body',
  LOG_SLEEP: 'dub.log.sleep',
  LOG_MOOD: 'dub.log.mood',
  LOG_GRATITUDE: 'dub.log.gratitude',
  LOG_MEDITATION: 'dub.log.meditation',
  LOG_STRESS: 'dub.log.stress',
  LOG_THERAPY: 'dub.log.therapy',
  LOG_SUPPLEMENTS: 'dub.log.supplements',
  LOG_SUBSTANCES: 'dub.log.substances',
  LOG_SEXUAL: 'dub.log.sexual',
  LOG_CYCLE: 'dub.log.cycle',
  LOG_DIGESTIVE: 'dub.log.digestive',
  LOG_PERSONALCARE: 'dub.log.personalcare',
  LOG_INJURY: 'dub.log.injury',
  LOG_BLOODWORK: 'dub.log.bloodwork',
  LOG_GLUCOSE: 'dub.log.glucose',
  LOG_BP: 'dub.log.bp',
  LOG_HABITS: 'dub.log.habits',
  LOG_REPS: 'dub.log.reps',
  LOG_DOCTOR_VISITS: 'dub.log.doctor_visits',
  LOG_ALLERGIES: 'dub.log.allergies',
  LOG_SOCIAL: 'dub.log.social',
  LOG_SUNLIGHT: 'dub.log.sunlight',
  LOG_MOBILITY: 'dub.log.mobility',
  LOG_JOURNAL: 'dub.log.journal',
  LOG_PERIMENOPAUSE: 'dub.log.perimenopause',
  LOG_BREASTFEEDING: 'dub.log.breastfeeding',
  LOG_MIGRAINE: 'dub.log.migraine',
  LOG_MOOD_MENTAL: 'dub.log.mood_mental',
  LOG_BODY_MEASUREMENTS: 'dub.log.body_measurements',
  LOG_MEDICATIONS: 'dub.log.medications',
  LOG_CUSTOM: 'dub.log.custom',

  // Aggregates and Caches
  DAILY_SUMMARY: 'dub.daily.summary',
  WEEKLY_SUMMARY: 'dub.weekly.summary',
  MONTHLY_SUMMARY: 'dub.monthly.summary',
  RECOVERY: 'dub.recovery',
  STREAKS: 'dub.streaks',
  SOBRIETY: 'dub.sobriety',
  FOOD_CACHE: 'dub.food.cache',
  FOOD_FAVORITES: 'dub.food.favorites',
  FOOD_TEMPLATES: 'dub.food.templates',
  FOOD_RECENT: 'dub.food.recent',
  MY_FOODS: 'dub.food.my_foods',
  PANTRY_ITEMS: 'dub.food.pantry',
  SUPPLEMENT_STACKS: 'dub.supplement.stacks',
  MY_SUPPLEMENTS: 'dub.supplement.selected',

  // Coach
  COACH_HISTORY: 'dub.coach.history',
  COACH_PATTERNS: 'dub.coach.patterns',
  FEEDBACK_LOG: 'dub.coach.feedback',

  // Device Sync
  DEVICES_STRAVA: 'dub.devices.strava',
  DEVICES_APPLE: 'dub.devices.apple',
  DEVICES_GOOGLE: 'dub.devices.google',
  DEVICES_OURA: 'dub.devices.oura',
  DEVICES_GARMIN: 'dub.devices.garmin',

  // Log tab favorites and repeat-last
  FAVORITE_TAGS: 'dub.favorite.tags',
  LAST_ENTRY: 'dub.last.entry', // date-keyed by tag ID: dub.last.entry.{tagId}

  // Marketplace
  MARKETPLACE_DISMISSED: 'dub.marketplace.dismissed',
  MARKETPLACE_PURCHASES: 'dub.marketplace.purchases',

  // Milestones (P2-05: earned moments, permanently acknowledged)
  MILESTONES_ACKNOWLEDGED: 'dub.milestones.acknowledged',

  // Mood Resource (48h dismiss state)
  MOOD_RESOURCE_DISMISSED: 'dub.mood_resource.dismissed_at',

  // Notification Preferences
  NOTIFICATION_PREFS: 'dub.notification.prefs',
  EOD_DISMISSED: 'dub.eod.dismissed',

  // Settings
  INGREDIENT_FLAGS: 'dub.settings.ingredient_flags',
  USER_MACROS: 'dub.settings.user_macros',
  SETTINGS_HABITS: 'dub.settings.habits',
  SETTINGS_DAILY_GOALS: 'dub.settings.daily_goals',
  SETTINGS_SLEEP_SCHEDULE: 'dub.settings.sleep_schedule',
  SETTINGS_ENABLED_CATEGORIES: 'dub.settings.enabled_categories',
  SETTINGS_LOG_SECTIONS_COLLAPSED: 'dub.settings.log_sections_collapsed',
  SETTINGS_QUICK_ACCESS: 'dub.settings.quick_access',

  // Compliance
  COMPLIANCE: 'dub.compliance',

  // Recipes
  MY_RECIPES: 'dub.recipes',

  // Allergy Profile
  PROFILE_ALLERGIES: 'dub.profile.allergies',

  // Activity Logger
  RECENT_ACTIVITIES: 'dub.recent_activities',

  // Weather Cache
  WEATHER_CACHE: 'dub.weather.current',

  // Last zip code for migraine weather correlation
  SETTINGS_LAST_ZIP_CODE: 'dub.settings.last_zip_code',

  // Sprint 23: Body Measurement Preferences + Medication List
  SETTINGS_BODY_MEAS_WEIGHT_UNIT: 'dub.settings.body_meas_weight_unit',
  SETTINGS_BODY_MEAS_UNIT: 'dub.settings.body_meas_unit',
  SETTINGS_MEDICATION_LIST: 'dub.settings.medication_list',

  // Sprint 24: Notification Reminders Settings
  SETTINGS_NOTIFICATIONS: 'dub.settings.notifications',

  // Sprint 25: Hydration Goal
  SETTINGS_HYDRATION_GOAL: 'dub.settings.hydration_goal',

  // Sprint 21: Personal Pantry auto-add preference
  SETTINGS_PANTRY_AUTO_ADD: 'dub.settings.pantry_auto_add',

  // Sprint 26: Centralized Unit Preferences
  SETTINGS_UNITS: 'dub.settings.units',

  // Strength Logger
  STRENGTH_MODE_PREF: 'dub.strength.mode_pref',

  // Offline Queue
  OFFLINE_QUEUE: 'dub.offline.queue',

  // Caches
  BARCODE_CACHE: 'dub.cache.barcode',
  FOOD_SEARCH_CACHE: 'dub.cache.food_search',

  // Auth Tokens
  FATSECRET_TOKEN: 'dub.auth.fatsecret_token',

  // Photos
  PHOTOS_PROGRESS: 'dub.photos.progress',

  // EOD skip counts (adaptive suppression)
  EOD_SKIP_COUNTS: 'dub.eod.skip_counts',

  // Sprint 27: Previously missing keys (magic string audit)
  LOCK_TIMEOUT: 'dub.lock_timeout',
  THEME_MODE: 'dub.settings.theme_mode',
  AUDIT_PREFIX: 'dub.audit',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// ============================================================
// Date-keyed helper
// ============================================================

export function dateKey(baseKey: string, date: string): string {
  return `${baseKey}.${date}`;
}

// ============================================================
// Typed Storage Error
// ============================================================

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly key: string,
    public readonly operation: 'get' | 'set' | 'delete' | 'list',
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// ============================================================
// Size Monitoring (MASTER-06)
// Android CursorWindow has a 2MB limit per key.
// ============================================================

const SIZE_WARN_THRESHOLD = 1024 * 1024;       // 1 MB
const SIZE_BLOCK_THRESHOLD = 1.5 * 1024 * 1024; // 1.5 MB

// Per-key item caps for high-risk keys (MASTER-06)
const KEY_ITEM_CAPS: Record<string, number> = {
  [STORAGE_KEYS.COACH_HISTORY]: 200,
  [STORAGE_KEYS.FOOD_CACHE]: 500,
  [STORAGE_KEYS.FOOD_RECENT]: 50,
};

/**
 * Enforce item cap on array values for high-risk keys.
 * Coach history: trim oldest. Food cache/recent: evict oldest (LRU).
 */
function enforceItemCap<T>(key: string, value: T): T {
  const cap = KEY_ITEM_CAPS[key];
  if (cap == null || !Array.isArray(value)) return value;
  if (value.length <= cap) return value;
  // Trim from the front (oldest items) to enforce cap
  return value.slice(-cap) as unknown as T;
}

// ============================================================
// Key Cache for storageList (MASTER-60)
// ============================================================

let cachedKeys: string[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

function invalidateKeyCache(): void {
  cachedKeys = null;
}

// ============================================================
// Write Lock for Atomicity (MASTER-67)
// ============================================================

const writeLocks = new Map<string, Promise<void>>();

// ============================================================
// Timeout Wrapper (release-build storage hang fix)
// ============================================================

/**
 * Race a promise against a timeout. If the timeout wins, return the fallback
 * value and log a warning. Used to prevent storage reads from hanging
 * indefinitely in release builds.
 *
 * Uses BOTH setTimeout AND requestAnimationFrame polling to guarantee the
 * timeout fires even when the Hermes timer module is non-responsive during
 * cold start in release builds.
 */
export async function asyncWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label?: string,
): Promise<T> {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let rafId: number | null = null;

  const timeout = new Promise<T>((resolve) => {
    const start = Date.now();

    function onTimeout(source: string) {
      if (settled) return;
      settled = true;
      console.warn(`[Storage] ${source} TIMEOUT after ${ms}ms${label ? ` (${label})` : ''} — using fallback`);
      resolve(fallback);
    }

    // Primary: setTimeout (works in most environments)
    timer = setTimeout(() => onTimeout('setTimeout'), ms);

    // Backup: requestAnimationFrame polling (works when setTimeout doesn't
    // fire in Hermes release builds, as long as the UI thread is rendering)
    function rafCheck() {
      if (settled) return;
      if (Date.now() - start >= ms) {
        onTimeout('raf');
        return;
      }
      rafId = requestAnimationFrame(rafCheck);
    }
    rafId = requestAnimationFrame(rafCheck);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    settled = true;
    if (timer !== null) clearTimeout(timer);
    if (rafId !== null) cancelAnimationFrame(rafId);
  }
}

/** Default timeout for storage reads in milliseconds */
export const STORAGE_READ_TIMEOUT = 3000;

// ============================================================
// Typed Storage Operations
// ============================================================

/**
 * Get a typed value from AsyncStorage.
 * Returns null if key doesn't exist. Throws StorageError on parse/read failure.
 */
export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await asyncWithTimeout(
      AsyncStorage.getItem(key),
      STORAGE_READ_TIMEOUT,
      null,
      `storageGet(${key})`,
    );
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new StorageError(
      `Failed to get key "${key}"`,
      key,
      'get',
      error,
    );
  }
}

/**
 * Set a typed value in AsyncStorage.
 * Throws StorageError on write failure.
 */
export async function storageSet<T>(key: string, value: T): Promise<void> {
  try {
    // MASTER-06: Enforce item caps for high-risk array keys
    const capped = enforceItemCap(key, value);
    const raw = JSON.stringify(capped);

    // MASTER-06: Size monitoring — rough UTF-16 byte estimate
    const byteSize = raw.length * 2;

    if (byteSize > SIZE_BLOCK_THRESHOLD) {
      throw new StorageError(
        `BLOCKED: Key "${key}" exceeds 1.5MB (${(byteSize / 1024 / 1024).toFixed(2)}MB). Write rejected.`,
        key,
        'set',
      );
    }

    if (byteSize > SIZE_WARN_THRESHOLD) {
      console.warn(`[Storage] WARNING: Key "${key}" is ${(byteSize / 1024 / 1024).toFixed(2)}MB. Approaching 2MB limit.`);
    }

    await AsyncStorage.setItem(key, raw);

    // MASTER-60: Invalidate key cache on write
    invalidateKeyCache();
  } catch (error) {
    if (error instanceof StorageError) throw error;
    throw new StorageError(
      `Failed to set key "${key}"`,
      key,
      'set',
      error,
    );
  }
}

/**
 * Delete a key from AsyncStorage.
 * Throws StorageError on failure.
 */
export async function storageDelete(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
    // MASTER-60: Invalidate key cache on delete
    invalidateKeyCache();
  } catch (error) {
    throw new StorageError(
      `Failed to delete key "${key}"`,
      key,
      'delete',
      error,
    );
  }
}

/**
 * List all keys matching a prefix.
 * Returns an array of matching key strings.
 */
export async function storageList(prefix: string): Promise<string[]> {
  try {
    // MASTER-60: Use cached keys with 5-second TTL
    const now = Date.now();
    if (!cachedKeys || now - cacheTimestamp > CACHE_TTL) {
      cachedKeys = await AsyncStorage.getAllKeys() as string[];
      cacheTimestamp = now;
    }
    return cachedKeys.filter((k) => k.startsWith(prefix));
  } catch (error) {
    throw new StorageError(
      `Failed to list keys with prefix "${prefix}"`,
      prefix,
      'list',
      error,
    );
  }
}

/**
 * Get multiple typed values by their keys.
 * Returns a Map of key to parsed value (null for missing keys).
 */
export async function storageGetMultiple<T>(keys: string[]): Promise<Map<string, T | null>> {
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const result = new Map<string, T | null>();
    for (const [key, raw] of pairs) {
      if (raw === null) {
        result.set(key, null);
      } else {
        result.set(key, JSON.parse(raw) as T);
      }
    }
    return result;
  } catch (error) {
    throw new StorageError(
      `Failed to get multiple keys`,
      keys.join(', '),
      'get',
      error,
    );
  }
}

/**
 * Delete multiple keys from AsyncStorage.
 */
export async function storageDeleteMultiple(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
    invalidateKeyCache();
  } catch (error) {
    throw new StorageError(
      `Failed to delete multiple keys`,
      keys.join(', '),
      'delete',
      error,
    );
  }
}

/**
 * Clear all DUB_AI keys from storage.
 * Used for "Delete My Data" feature.
 */
export async function storageClearAll(): Promise<void> {
  try {
    const dubKeys = await storageList('dub.');
    // Retain audit logs per compliance policy (audit.ts line 9)
    const keysToDelete = dubKeys.filter((k) => !k.startsWith('dub.audit.'));
    if (keysToDelete.length > 0) {
      await AsyncStorage.multiRemove(keysToDelete);
    }
    invalidateKeyCache();
  } catch (error) {
    throw new StorageError(
      'Failed to clear all DUB_AI data',
      'dub.*',
      'delete',
      error,
    );
  }
}

/**
 * Atomically append an item to an array stored at key (MASTER-67).
 * Uses a per-key write lock to prevent read-modify-write races
 * (e.g., two rapid food log entries clobbering each other).
 */
export async function storageAppend<T>(key: string, item: T): Promise<void> {
  // Capture any pending write SYNCHRONOUSLY before the first await,
  // then set our own promise as the new lock immediately so that
  // concurrent callers in the same tick will queue behind us.
  const pending = writeLocks.get(key);

  const writePromise = (async () => {
    if (pending) await pending;
    const existing = (await storageGet<T[]>(key)) ?? [];
    existing.push(item);
    await storageSet(key, existing);
  })();

  writeLocks.set(key, writePromise);
  try {
    await writePromise;
  } finally {
    // Only delete if we're still the latest lock holder
    if (writeLocks.get(key) === writePromise) {
      writeLocks.delete(key);
    }
  }
}
