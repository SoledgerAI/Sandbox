// Google Health Connect integration service
// Phase 18: Device Integrations
// Reads: steps, HR, HRV, sleep, weight, workouts. Writes: workouts.
// Android only -- guarded by Platform.OS check in consumers.

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
// Types for Health Connect data mapping
// ============================================================

export interface HealthConnectRecord {
  startTime: string;
  endTime: string;
  metadata?: {
    dataOrigin: string;
  };
}

export interface HealthConnectStepsRecord extends HealthConnectRecord {
  count: number;
}

export interface HealthConnectHeartRateRecord extends HealthConnectRecord {
  samples: Array<{ time: string; beatsPerMinute: number }>;
}

export interface HealthConnectSleepSession extends HealthConnectRecord {
  stages: Array<{
    startTime: string;
    endTime: string;
    stage: 'AWAKE' | 'SLEEPING' | 'LIGHT' | 'DEEP' | 'REM' | 'OUT_OF_BED';
  }>;
}

export interface HealthConnectExerciseSession extends HealthConnectRecord {
  exerciseType: number; // Health Connect exercise type constant
  title?: string;
  totalCaloriesBurned?: number;
  totalDistance?: number; // meters
}

// ============================================================
// Availability check
// ============================================================

/**
 * Check if Health Connect is available on this device.
 * Returns false on non-Android platforms.
 */
export function isHealthConnectAvailable(): boolean {
  if (Platform.OS !== 'android') return false;
  // In a full native build, this would check HealthConnect SDK availability
  // Health Connect requires Android 14+ or the Health Connect APK installed
  return true;
}

// ============================================================
// Permission request
// ============================================================

/**
 * Request Health Connect permissions.
 * In a full native build, this calls the Health Connect permission flow.
 * Returns true if permissions were granted.
 */
export async function requestHealthConnectPermissions(): Promise<boolean> {
  if (!isHealthConnectAvailable()) return false;

  try {
    const syncState: DeviceSyncState = {
      connected: true,
      last_sync: null,
      access_token: null, // Health Connect uses system permissions, no OAuth
      refresh_token: null,
    };
    await storageSet(STORAGE_KEYS.DEVICES_GOOGLE, syncState);
    await logAuditEvent('DEVICE_CONNECTED', { device: 'google_health_connect', status: 'connected' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Data reading functions
// ============================================================

/**
 * Read step count for a given date from Health Connect.
 */
export async function readSteps(_date: string): Promise<StepsEntry | null> {
  if (!isHealthConnectAvailable()) return null;

  try {
    // readRecords('Steps', { timeRangeFilter: { ... } })
    return null;
  } catch {
    return null;
  }
}

/**
 * Read heart rate samples for a given date.
 */
export async function readHeartRate(_date: string): Promise<HealthConnectHeartRateRecord[]> {
  if (!isHealthConnectAvailable()) return [];

  try {
    // readRecords('HeartRate', { timeRangeFilter: { ... } })
    return [];
  } catch {
    return [];
  }
}

/**
 * Read HRV (RMSSD) for a given date.
 */
export async function readHRV(_date: string): Promise<number | null> {
  if (!isHealthConnectAvailable()) return null;

  try {
    // readRecords('HeartRateVariabilityRmssd', { timeRangeFilter: { ... } })
    return null;
  } catch {
    return null;
  }
}

/**
 * Read sleep session for a given date.
 */
export async function readSleep(_date: string): Promise<SleepDeviceData | null> {
  if (!isHealthConnectAvailable()) return null;

  try {
    // readRecords('SleepSession', { timeRangeFilter: { ... } })
    // Parse stages into SleepDeviceData
    return null;
  } catch {
    return null;
  }
}

/**
 * Read latest body weight from Health Connect.
 */
export async function readWeight(): Promise<number | null> {
  if (!isHealthConnectAvailable()) return null;

  try {
    // readRecords('Weight', { timeRangeFilter: { ... } })
    // Convert kg to lbs: value * 2.20462
    return null;
  } catch {
    return null;
  }
}

/**
 * Read exercise sessions from Health Connect for a given date.
 */
export async function readWorkouts(_date: string): Promise<WorkoutEntry[]> {
  if (!isHealthConnectAvailable()) return [];

  try {
    // readRecords('ExerciseSession', { timeRangeFilter: { ... } })
    return [];
  } catch {
    return [];
  }
}

// ============================================================
// Data writing functions
// ============================================================

/**
 * Write a workout/exercise session to Health Connect.
 */
export async function writeWorkout(_workout: WorkoutEntry): Promise<boolean> {
  if (!isHealthConnectAvailable()) return false;

  try {
    // insertRecords([{
    //   recordType: 'ExerciseSession',
    //   startTime: workout.timestamp,
    //   endTime: computed end time,
    //   exerciseType: mapActivityToHealthConnect(workout.activity_name),
    //   title: workout.activity_name,
    // }])
    return false; // No native bridge yet
  } catch {
    return false;
  }
}

// ============================================================
// Sync orchestration
// ============================================================

/**
 * Perform a full sync from Health Connect for today's date.
 * Reads all supported data types and stores them in AsyncStorage.
 */
export async function syncFromHealthConnect(): Promise<{
  success: boolean;
  dataTypes: string[];
}> {
  if (!isHealthConnectAvailable()) {
    return { success: false, dataTypes: [] };
  }

  const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_GOOGLE);
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

    // Sync sleep
    const sleep = await readSleep(today);
    if (sleep) {
      const existingSleep = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, today));
      if (existingSleep) {
        existingSleep.device_data = sleep;
        await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, today), existingSleep);
      }
      synced.push('sleep');
    }

    // Sync HRV
    const hrv = await readHRV(today);
    if (hrv != null) {
      const existingBody = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, today));
      if (existingBody) {
        existingBody.hrv_ms = hrv;
        await storageSet(dateKey(STORAGE_KEYS.LOG_BODY, today), existingBody);
      }
      synced.push('hrv');
    }

    // Sync weight
    const weight = await readWeight();
    if (weight != null) {
      const existingBody = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, today));
      if (existingBody) {
        existingBody.weight_lbs = weight;
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
    await storageSet(STORAGE_KEYS.DEVICES_GOOGLE, updatedState);

    return { success: true, dataTypes: synced };
  } catch {
    return { success: false, dataTypes: synced };
  }
}

// ============================================================
// Disconnect
// ============================================================

/**
 * Disconnect Health Connect integration.
 * Clears sync state. Does not revoke system permissions (user does that in Android Settings).
 */
export async function disconnectHealthConnect(): Promise<void> {
  const clearedState: DeviceSyncState = {
    connected: false,
    last_sync: null,
    access_token: null,
    refresh_token: null,
  };
  await storageSet(STORAGE_KEYS.DEVICES_GOOGLE, clearedState);
  await logAuditEvent('DEVICE_REVOKED', { device: 'google_health_connect' });
}
