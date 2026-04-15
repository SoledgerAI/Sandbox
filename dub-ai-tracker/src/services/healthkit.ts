// NOT WIRED UP — scheduled for future sprint
// Apple Health (HealthKit) integration service
// Phase 18: Device Integrations
// Reads: steps, HR, HRV, sleep, weight, workouts. Writes: workouts.
// iOS only -- guarded by Platform.OS check in consumers.

import { Platform } from 'react-native';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { logAuditEvent } from '../utils/audit';
import type { DeviceSyncState } from '../types/profile';
import type {
  BodyEntry,
  SleepEntry,
  SleepDeviceData,
  StepsEntry,
  WorkoutEntry,
} from '../types';

// ============================================================
// Types for HealthKit data mapping
// ============================================================

export interface HealthKitSample {
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  sourceName?: string;
}

export interface HealthKitWorkout {
  activityType: string;
  startDate: string;
  endDate: string;
  duration: number; // seconds
  totalEnergyBurned?: number; // kcal
  totalDistance?: number; // meters
  sourceName?: string;
}

export interface HealthKitSleepSample {
  startDate: string;
  endDate: string;
  value: 'INBED' | 'ASLEEP' | 'AWAKE' | 'CORE' | 'DEEP' | 'REM';
}

// ============================================================
// Availability check
// ============================================================

/**
 * Check if Apple Health is available on this device.
 * Returns false on non-iOS platforms.
 */
export function isHealthKitAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  // In a full native build, this would check AppleHealthKit.isAvailable()
  // For now, return true on iOS to enable the UI flow
  return true;
}

// ============================================================
// Permission request
// ============================================================

/**
 * Request HealthKit permissions.
 * In a full native build, this calls AppleHealthKit.initHealthKit().
 * Returns true if permissions were granted.
 */
export async function requestHealthKitPermissions(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;

  try {
    const syncState: DeviceSyncState = {
      connected: true,
      last_sync: null,
      access_token: null, // HealthKit uses system permissions, no OAuth
      refresh_token: null,
    };
    await storageSet(STORAGE_KEYS.DEVICES_APPLE, syncState);
    await logAuditEvent('DEVICE_CONNECTED', { device: 'apple_health', status: 'connected' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Data reading functions
// ============================================================

/**
 * Read step count for a given date from HealthKit.
 */
export async function readSteps(_date: string): Promise<StepsEntry | null> {
  if (!isHealthKitAvailable()) return null;

  try {
    // In full native build:
    // const steps = await AppleHealthKit.getStepCount({ date });
    // For now, return null to indicate no native bridge available
    return null;
  } catch {
    return null;
  }
}

/**
 * Read heart rate samples for a given date.
 */
export async function readHeartRate(_date: string): Promise<HealthKitSample[]> {
  if (!isHealthKitAvailable()) return [];

  try {
    // AppleHealthKit.getHeartRateSamples({ startDate, endDate })
    return [];
  } catch {
    return [];
  }
}

/**
 * Read HRV (SDNN) for a given date.
 */
export async function readHRV(_date: string): Promise<number | null> {
  if (!isHealthKitAvailable()) return null;

  try {
    // AppleHealthKit.getHeartRateVariabilitySamples({ startDate, endDate })
    return null;
  } catch {
    return null;
  }
}

/**
 * Read sleep analysis for a given date.
 */
export async function readSleep(_date: string): Promise<SleepDeviceData | null> {
  if (!isHealthKitAvailable()) return null;

  try {
    // AppleHealthKit.getSleepSamples({ startDate, endDate })
    // Parse CORE/DEEP/REM/AWAKE categories into SleepDeviceData
    return null;
  } catch {
    return null;
  }
}

/**
 * Read latest body weight from HealthKit.
 */
export async function readWeight(): Promise<number | null> {
  if (!isHealthKitAvailable()) return null;

  try {
    // AppleHealthKit.getLatestWeight()
    return null;
  } catch {
    return null;
  }
}

/**
 * Read workouts from HealthKit for a given date.
 */
export async function readWorkouts(_date: string): Promise<WorkoutEntry[]> {
  if (!isHealthKitAvailable()) return [];

  try {
    // AppleHealthKit.getSamples({ type: 'Workout', startDate, endDate })
    return [];
  } catch {
    return [];
  }
}

// ============================================================
// Data writing functions
// ============================================================

/**
 * Write a workout to HealthKit.
 */
export async function writeWorkout(_workout: WorkoutEntry): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;

  try {
    // AppleHealthKit.saveWorkout({
    //   type: mapActivityToHealthKit(workout.activity_name),
    //   startDate: workout.timestamp,
    //   endDate: new Date(new Date(workout.timestamp).getTime() + workout.duration_minutes * 60000).toISOString(),
    //   energyBurned: workout.calories_burned,
    //   energyBurnedUnit: 'calorie',
    // });
    return false; // No native bridge yet
  } catch {
    return false;
  }
}

// ============================================================
// Sync orchestration
// ============================================================

/**
 * Perform a full sync from Apple Health for today's date.
 * Reads all supported data types and stores them in AsyncStorage.
 */
export async function syncFromHealthKit(): Promise<{
  success: boolean;
  dataTypes: string[];
}> {
  if (!isHealthKitAvailable()) {
    return { success: false, dataTypes: [] };
  }

  const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_APPLE);
  if (!state?.connected) {
    return { success: false, dataTypes: [] };
  }

  const today = new Date().toISOString().split('T')[0];
  const synced: string[] = [];

  try {
    // Sync steps
    const steps = await readSteps(today);
    if (steps) {
      await storageSet(dateKey(STORAGE_KEYS.LOG_STEPS, today), steps);
      synced.push('steps');
    }

    // Sync sleep — manual-wins: do not overwrite manual bedtime/wake with device data
    const sleep = await readSleep(today);
    if (sleep) {
      const existingSleep = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, today));
      if (existingSleep) {
        if (existingSleep.source !== 'manual') {
          existingSleep.device_data = { ...sleep, source: 'apple_health' };
          existingSleep.source = 'apple_health';
        } else {
          // Manual entry exists — only add device stage data, keep manual bedtime/wake
          existingSleep.device_data = { ...sleep, source: 'apple_health' };
        }
        await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), existingSleep);
      }
      synced.push('sleep');
    }

    // Sync heart rate / HRV — manual-wins conflict resolution
    const hrv = await readHRV(today);
    if (hrv != null) {
      const existingBody = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, today));
      if (existingBody) {
        if (existingBody.hrv_ms != null && existingBody.source === 'manual') {
          // Manual entry exists — store device value as secondary
          existingBody.device_hrv_ms = hrv;
        } else {
          existingBody.hrv_ms = hrv;
          existingBody.source = 'apple_health';
        }
        await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, today), existingBody);
      }
      synced.push('hrv');
    }

    // Sync weight — manual-wins conflict resolution
    const weight = await readWeight();
    if (weight != null) {
      const existingBody = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, today));
      if (existingBody) {
        if (existingBody.weight_lbs != null && existingBody.source === 'manual') {
          // Manual entry exists — store device value as secondary
          existingBody.device_weight_lbs = weight;
        } else {
          existingBody.weight_lbs = weight;
          existingBody.source = 'apple_health';
        }
        await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, today), existingBody);
      }
      synced.push('weight');
    }

    // Sync workouts
    const workouts = await readWorkouts(today);
    if (workouts.length > 0) {
      const existing = await storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, today)) ?? [];
      const merged = [...existing, ...workouts.filter(
        (w) => !existing.some((e) => e.id === w.id),
      )];
      await storageSet(dateKey(STORAGE_KEYS.LOG_WORKOUT, today), merged);
      synced.push('workouts');
    }

    // Update sync state
    const updatedState: DeviceSyncState = {
      ...state,
      last_sync: new Date().toISOString(),
    };
    await storageSet(STORAGE_KEYS.DEVICES_APPLE, updatedState);

    return { success: true, dataTypes: synced };
  } catch {
    return { success: false, dataTypes: synced };
  }
}

// ============================================================
// Disconnect
// ============================================================

/**
 * Disconnect Apple Health integration.
 * Clears sync state. Does not revoke system permissions (user must do that in iOS Settings).
 */
export async function disconnectHealthKit(): Promise<void> {
  const clearedState: DeviceSyncState = {
    connected: false,
    last_sync: null,
    access_token: null,
    refresh_token: null,
  };
  await storageSet(STORAGE_KEYS.DEVICES_APPLE, clearedState);
  await logAuditEvent('DEVICE_REVOKED', { device: 'apple_health' });
}
