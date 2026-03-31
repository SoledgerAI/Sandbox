// Strava OAuth + activity pull service
// Phase 18: Device Integrations
// OAuth flow, token management, activity sync mapped to DUB_AI fitness tags.

import { Linking } from 'react-native';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { logAuditEvent } from '../utils/audit';
import type { DeviceSyncState } from '../types/profile';
import type { WorkoutEntry } from '../types';

// ============================================================
// Strava API constants
// ============================================================

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const STRAVA_SCOPES = 'read,activity:read_all';
const REDIRECT_URI = 'dubai://strava/callback';

// These must be set by the user or via app config
// In production, client_secret should be handled server-side
let stravaClientId = '';
let stravaClientSecret = '';

export function setStravaCredentials(clientId: string, clientSecret: string): void {
  stravaClientId = clientId;
  stravaClientSecret = clientSecret;
}

// ============================================================
// Strava API types
// ============================================================

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string; // Run, Ride, Swim, Hike, Walk, etc.
  sport_type: string;
  start_date: string; // ISO datetime
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  total_elevation_gain: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  kilojoules?: number; // cycling power-based calories
  calories?: number;
  average_speed: number; // m/s
  max_speed: number; // m/s
  has_heartrate: boolean;
}

// ============================================================
// Activity type mapping: Strava type -> DUB_AI activity ID + MET
// Activity IDs reference src/data/activities.ts
// ============================================================

const STRAVA_TYPE_MAP: Record<string, { met: number; intensity: 'light' | 'moderate' | 'vigorous'; compendiumCode: string }> = {
  Run: { met: 9.8, intensity: 'vigorous', compendiumCode: 'run_outdoor' },
  TrailRun: { met: 10.0, intensity: 'vigorous', compendiumCode: 'trail_run' },
  Ride: { met: 7.5, intensity: 'vigorous', compendiumCode: 'ride_outdoor' },
  MountainBikeRide: { met: 8.5, intensity: 'vigorous', compendiumCode: 'mountain_bike' },
  EBikeRide: { met: 4.0, intensity: 'light', compendiumCode: 'ebike' },
  Swim: { met: 7.0, intensity: 'moderate', compendiumCode: 'swim_pool' },
  Walk: { met: 3.5, intensity: 'light', compendiumCode: 'walk' },
  Hike: { met: 6.0, intensity: 'moderate', compendiumCode: 'hike' },
  Elliptical: { met: 5.0, intensity: 'moderate', compendiumCode: 'elliptical' },
  Rowing: { met: 7.0, intensity: 'vigorous', compendiumCode: 'rowing' },
  StairStepper: { met: 9.0, intensity: 'vigorous', compendiumCode: 'stair_climber' },
  WeightTraining: { met: 5.0, intensity: 'moderate', compendiumCode: 'weight_training' },
  CrossFit: { met: 8.0, intensity: 'vigorous', compendiumCode: 'crossfit_hiit' },
  Yoga: { met: 3.0, intensity: 'light', compendiumCode: 'yoga' },
  Pilates: { met: 3.5, intensity: 'light', compendiumCode: 'pilates' },
  Soccer: { met: 7.0, intensity: 'vigorous', compendiumCode: 'soccer' },
  Tennis: { met: 7.3, intensity: 'vigorous', compendiumCode: 'tennis' },
  Pickleball: { met: 5.5, intensity: 'moderate', compendiumCode: 'pickleball' },
  Golf: { met: 4.3, intensity: 'light', compendiumCode: 'golf' },
  Workout: { met: 4.0, intensity: 'moderate', compendiumCode: 'other' },
  VirtualRide: { met: 6.8, intensity: 'vigorous', compendiumCode: 'ride_indoor' },
  VirtualRun: { met: 9.0, intensity: 'vigorous', compendiumCode: 'run_treadmill' },
};

function getDefaultMapping() {
  return { met: 4.0, intensity: 'moderate' as const, compendiumCode: 'other' };
}

// ============================================================
// OAuth flow
// ============================================================

/**
 * Initiate Strava OAuth authorization.
 * Opens the Strava authorization page in the browser.
 */
export async function initiateStravaAuth(): Promise<void> {
  if (!stravaClientId) {
    throw new StravaError('Strava client ID not configured. Set credentials in app config.', 'NO_CLIENT_ID');
  }

  const authUrl =
    `${STRAVA_AUTH_URL}?client_id=${stravaClientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${STRAVA_SCOPES}` +
    `&approval_prompt=auto`;

  const supported = await Linking.canOpenURL(authUrl);
  if (!supported) {
    throw new StravaError('Cannot open Strava authorization page.', 'CANNOT_OPEN_URL');
  }

  await Linking.openURL(authUrl);
  await logAuditEvent('DEVICE_CONNECTED', { device: 'strava', status: 'auth_initiated' });
}

/**
 * Handle the OAuth callback with authorization code.
 * Exchanges code for access + refresh tokens.
 */
export async function handleStravaCallback(code: string): Promise<boolean> {
  if (!stravaClientId || !stravaClientSecret) {
    throw new StravaError('Strava credentials not configured.', 'NO_CREDENTIALS');
  }

  try {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      throw new StravaError(`Token exchange failed: ${response.status}`, 'TOKEN_EXCHANGE_FAILED');
    }

    const data: StravaTokenResponse = await response.json();

    const syncState: DeviceSyncState = {
      connected: true,
      last_sync: null,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, syncState);
    await logAuditEvent('DEVICE_CONNECTED', { device: 'strava', status: 'connected' });

    return true;
  } catch (error) {
    if (error instanceof StravaError) throw error;
    throw new StravaError('Failed to complete Strava authorization.', 'AUTH_FAILED');
  }
}

// ============================================================
// Token refresh
// ============================================================

/**
 * Refresh the Strava access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!stravaClientId || !stravaClientSecret) {
    throw new StravaError('Strava credentials not configured.', 'NO_CREDENTIALS');
  }

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new StravaError('Token refresh failed. Please reconnect Strava.', 'REFRESH_FAILED');
  }

  const data: StravaTokenResponse = await response.json();

  // Update stored tokens
  const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
  if (state) {
    state.access_token = data.access_token;
    state.refresh_token = data.refresh_token;
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, state);
  }

  return data.access_token;
}

/**
 * Get a valid access token, refreshing if needed.
 */
async function getValidToken(): Promise<string> {
  const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
  if (!state?.connected || !state.access_token) {
    throw new StravaError('Strava not connected.', 'NOT_CONNECTED');
  }

  // Try to use existing token first; if 401, refresh
  return state.access_token;
}

// ============================================================
// Activity fetching
// ============================================================

/**
 * Fetch recent activities from Strava API.
 * Returns the last 30 activities or activities after a given epoch.
 */
export async function fetchActivities(afterEpoch?: number): Promise<StravaActivity[]> {
  let token = await getValidToken();

  const params = new URLSearchParams({ per_page: '30' });
  if (afterEpoch) {
    params.set('after', String(afterEpoch));
  }

  let response = await fetch(`${STRAVA_ACTIVITIES_URL}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // If unauthorized, try refreshing the token
  if (response.status === 401) {
    const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    if (state?.refresh_token) {
      token = await refreshAccessToken(state.refresh_token);
      response = await fetch(`${STRAVA_ACTIVITIES_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!response.ok) {
    throw new StravaError(`Failed to fetch activities: ${response.status}`, 'FETCH_FAILED');
  }

  return response.json();
}

/**
 * Map a Strava activity to a DUB_AI WorkoutEntry.
 */
export function mapStravaActivity(activity: StravaActivity, userWeightKg: number): WorkoutEntry {
  const mapping = STRAVA_TYPE_MAP[activity.type] ?? getDefaultMapping();
  const durationMinutes = Math.round(activity.moving_time / 60);
  const durationHours = durationMinutes / 60;

  // Prefer Strava's calorie data if available, otherwise compute from MET
  const calories = activity.calories
    ? Math.round(activity.calories)
    : Math.round(mapping.met * userWeightKg * durationHours);

  // Convert distance from meters
  const distanceMiles = activity.distance > 0
    ? parseFloat((activity.distance / 1609.344).toFixed(2))
    : null;

  return {
    id: `strava_${activity.id}`,
    timestamp: activity.start_date,
    activity_name: activity.name || activity.type,
    compendium_code: mapping.compendiumCode,
    met_value: mapping.met,
    duration_minutes: durationMinutes,
    intensity: mapping.intensity,
    calories_burned: calories,
    distance: distanceMiles,
    distance_unit: distanceMiles != null ? 'miles' : null,
    environmental: {
      elevation_gain_ft: activity.total_elevation_gain > 0
        ? Math.round(activity.total_elevation_gain * 3.28084)
        : null,
      elevation_loss_ft: null,
      altitude_ft: null,
      temperature_f: null,
    },
    biometric: {
      avg_heart_rate_bpm: activity.average_heartrate ?? null,
      max_heart_rate_bpm: activity.max_heartrate ?? null,
      heart_rate_zones: null,
    },
    notes: `Synced from Strava`,
    source: 'strava',
  };
}

// ============================================================
// Sync orchestration
// ============================================================

/**
 * Sync activities from Strava and store as workout entries.
 * Fetches activities since last sync.
 */
export async function syncFromStrava(userWeightLbs: number): Promise<{
  success: boolean;
  activitiesImported: number;
}> {
  const state = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
  if (!state?.connected || !state.access_token) {
    return { success: false, activitiesImported: 0 };
  }

  const userWeightKg = userWeightLbs / 2.20462;

  try {
    // Fetch activities since last sync, or last 30 days
    const afterEpoch = state.last_sync
      ? Math.floor(new Date(state.last_sync).getTime() / 1000)
      : Math.floor((Date.now() - 30 * 86400000) / 1000);

    const activities = await fetchActivities(afterEpoch);
    let imported = 0;

    for (const activity of activities) {
      const workout = mapStravaActivity(activity, userWeightKg);
      const actDate = workout.timestamp.split('T')[0];
      const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, actDate);

      const existing = await storageGet<WorkoutEntry[]>(key) ?? [];
      // Skip if already imported (by strava ID)
      if (existing.some((e) => e.id === workout.id)) continue;

      existing.push(workout);
      await storageSet(key, existing);
      imported++;
    }

    // Update sync state
    const updatedState: DeviceSyncState = {
      ...state,
      last_sync: new Date().toISOString(),
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, updatedState);

    return { success: true, activitiesImported: imported };
  } catch {
    return { success: false, activitiesImported: 0 };
  }
}

// ============================================================
// Disconnect
// ============================================================

/**
 * Disconnect Strava integration.
 * Clears sync state and tokens.
 */
export async function disconnectStrava(): Promise<void> {
  const clearedState: DeviceSyncState = {
    connected: false,
    last_sync: null,
    access_token: null,
    refresh_token: null,
  };
  await storageSet(STORAGE_KEYS.DEVICES_STRAVA, clearedState);
  await logAuditEvent('DEVICE_REVOKED', { device: 'strava' });
}

// ============================================================
// Error class
// ============================================================

export class StravaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'StravaError';
  }
}
