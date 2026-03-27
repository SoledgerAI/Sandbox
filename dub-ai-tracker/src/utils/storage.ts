// Typed AsyncStorage wrapper for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 7: AsyncStorage Key Structure

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

  // Coach
  COACH_HISTORY: 'dub.coach.history',
  COACH_PATTERNS: 'dub.coach.patterns',

  // Device Sync
  DEVICES_STRAVA: 'dub.devices.strava',
  DEVICES_APPLE: 'dub.devices.apple',
  DEVICES_GOOGLE: 'dub.devices.google',
  DEVICES_OURA: 'dub.devices.oura',
  DEVICES_GARMIN: 'dub.devices.garmin',

  // Marketplace
  MARKETPLACE_DISMISSED: 'dub.marketplace.dismissed',
  MARKETPLACE_PURCHASES: 'dub.marketplace.purchases',

  // Offline Queue
  OFFLINE_QUEUE: 'dub.offline.queue',

  // Photos
  PHOTOS_PROGRESS: 'dub.photos.progress',
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
// Typed Storage Operations
// ============================================================

/**
 * Get a typed value from AsyncStorage.
 * Returns null if key doesn't exist. Throws StorageError on parse/read failure.
 */
export async function storageGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
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
    const raw = JSON.stringify(value);
    await AsyncStorage.setItem(key, raw);
  } catch (error) {
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
    const allKeys = await AsyncStorage.getAllKeys();
    return allKeys.filter((k) => k.startsWith(prefix));
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
    if (dubKeys.length > 0) {
      await AsyncStorage.multiRemove(dubKeys);
    }
  } catch (error) {
    throw new StorageError(
      'Failed to clear all DUB_AI data',
      'dub.*',
      'delete',
      error,
    );
  }
}
