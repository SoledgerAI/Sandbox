// Strava OAuth (PKCE) + activity pull service
// Sprint 11: original Strava integration
// Sprint S34-A: migrated from client_secret OAuth to PKCE on
// expo-crypto. Tokens persist in SecureStore via stravaTokenStorage.
// All non-strava.ts consumers must read sync state through
// getStravaSyncState() — direct AsyncStorage DEVICES_STRAVA reads
// are gone (the legacy AsyncStorage row is migrated once on first
// launch by stravaTokenMigration.ts).

import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { storageGet, storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { logAuditEvent } from '../utils/audit';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../utils/pkce';
import {
  readStravaTokens,
  writeStravaTokens,
  clearStravaTokens,
} from './stravaTokenStorage';
import type { DeviceSyncState } from '../types/profile';
import type { WorkoutEntry } from '../types';
import {
  STRAVA_CLIENT_ID as CONFIG_CLIENT_ID,
  STRAVA_REDIRECT_URI,
} from '../config/strava';

// ============================================================
// Strava API constants
// ============================================================

const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/mobile/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';

// S34-A PQ-A10: scope tightened from 'read,activity:read_all' to 'read'.
// Matches the Strava console registration; principle of least privilege.
const STRAVA_SCOPES = 'read';

const REDIRECT_URI = STRAVA_REDIRECT_URI;
const PKCE_PENDING_KEY = 'strava_pkce_pending';

// Refresh proactively when the access token has <= this many seconds left.
// Eliminates the reactive 401 on activity fetches in the common case.
const REFRESH_BUFFER_SECONDS = 30;

let stravaClientId = CONFIG_CLIENT_ID !== 'PLACEHOLDER' ? CONFIG_CLIENT_ID : '';

/** Test-only: override the client ID at runtime. */
export function __setStravaClientIdForTests(id: string): void {
  stravaClientId = id;
}

/** Check if Strava credentials are configured. */
export function isStravaConfigured(): boolean {
  return stravaClientId.length > 0 && stravaClientId !== 'PLACEHOLDER';
}

// ============================================================
// Strava error
// ============================================================

export type StravaErrorCode =
  | 'NO_CLIENT_ID'
  | 'CANNOT_OPEN_URL'
  | 'STATE_MISMATCH'
  | 'NETWORK'
  | 'INVALID_CODE'
  | 'INVALID_VERIFIER'
  | 'RATE_LIMITED'
  | 'STRAVA_5XX'
  | 'MALFORMED_TOKEN_RESPONSE'
  | 'NOT_CONNECTED'
  | 'FETCH_FAILED'
  | 'REFRESH_FAILED';

export class StravaError extends Error {
  constructor(
    message: string,
    public readonly code: StravaErrorCode,
  ) {
    super(message);
    this.name = 'StravaError';
  }
}

// ============================================================
// Strava API types (preserved per S34-A scope-lock)
// ============================================================

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp seconds
  athlete?: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  average_heartrate?: number;
  max_heartrate?: number;
  kilojoules?: number;
  calories?: number;
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
}

// ============================================================
// Activity type mapping (preserved per S34-A scope-lock)
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
// PKCE pending state (verifier + state, persisted in SecureStore)
// ============================================================

interface PkcePending {
  verifier: string;
  state: string;
  created_at: number; // ms
}

async function persistPkcePending(p: PkcePending): Promise<void> {
  await SecureStore.setItemAsync(PKCE_PENDING_KEY, JSON.stringify(p));
}

async function readPkcePending(): Promise<PkcePending | null> {
  try {
    const raw = await SecureStore.getItemAsync(PKCE_PENDING_KEY);
    return raw ? (JSON.parse(raw) as PkcePending) : null;
  } catch {
    return null;
  }
}

async function clearPkcePending(): Promise<void> {
  await SecureStore.deleteItemAsync(PKCE_PENDING_KEY);
}

// ============================================================
// Module-scope state: refresh mutex + in-flight code tracking
// ============================================================

let refreshInFlight: Promise<string> | null = null;
const codeInFlight = new Set<string>();

// ============================================================
// OAuth flow — initiate
// ============================================================

/**
 * Initiate Strava OAuth authorization with PKCE.
 * Generates a fresh verifier + state, persists them, and opens
 * Strava's mobile authorization page.
 */
export async function initiateStravaAuth(): Promise<void> {
  if (!stravaClientId) {
    throw new StravaError('Strava client ID not configured.', 'NO_CLIENT_ID');
  }

  const verifier = await generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const csrfState = await generateState();

  await persistPkcePending({
    verifier,
    state: csrfState,
    created_at: Date.now(),
  });

  const params = new URLSearchParams({
    client_id: stravaClientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state: csrfState,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const authUrl = `${STRAVA_AUTH_URL}?${params.toString()}`;

  const supported = await Linking.canOpenURL(authUrl);
  if (!supported) {
    throw new StravaError('Cannot open Strava authorization page.', 'CANNOT_OPEN_URL');
  }

  await Linking.openURL(authUrl);
  await logAuditEvent('STRAVA_AUTH_INITIATED', {});
}

// ============================================================
// OAuth flow — handle callback (PKCE exchange)
// ============================================================

interface StravaTokenApiResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function isValidTokenResponse(data: unknown): data is StravaTokenApiResponse {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.access_token === 'string' &&
    d.access_token.length > 0 &&
    typeof d.refresh_token === 'string' &&
    d.refresh_token.length > 0 &&
    typeof d.expires_at === 'number' &&
    Number.isFinite(d.expires_at)
  );
}

/**
 * Exchange the OAuth authorization code for tokens.
 * Validates the returned `state` parameter against the stored CSRF
 * token before exchanging. Throws a typed StravaError on failure.
 *
 * Single-use: a duplicate callback for the same code is ignored.
 */
export async function handleStravaCallback(
  code: string,
  returnedState: string | null,
): Promise<boolean> {
  if (!stravaClientId) {
    throw new StravaError('Strava client ID not configured.', 'NO_CLIENT_ID');
  }

  if (codeInFlight.has(code)) {
    return false;
  }
  codeInFlight.add(code);

  try {
    const pending = await readPkcePending();
    if (!pending) {
      await logAuditEvent('STRAVA_PKCE_STATE_MISMATCH', { reason: 'no_pending' });
      throw new StravaError('Authorization session expired.', 'STATE_MISMATCH');
    }

    if (returnedState == null || returnedState !== pending.state) {
      await logAuditEvent('STRAVA_PKCE_STATE_MISMATCH', { reason: 'mismatch' });
      await clearPkcePending();
      throw new StravaError('OAuth state mismatch.', 'STATE_MISMATCH');
    }

    let response: Response;
    try {
      response = await fetch(STRAVA_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: stravaClientId,
          code,
          code_verifier: pending.verifier,
          grant_type: 'authorization_code',
        }),
      });
    } catch {
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', { code: 'NETWORK' });
      throw new StravaError('Network error during token exchange.', 'NETWORK');
    }

    if (response.status === 429) {
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', { code: 'RATE_LIMITED' });
      throw new StravaError('Strava rate limit exceeded.', 'RATE_LIMITED');
    }
    if (response.status >= 500) {
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', {
        code: 'STRAVA_5XX',
        http_status: response.status,
      });
      throw new StravaError('Strava server error.', 'STRAVA_5XX');
    }
    if (!response.ok) {
      // 4xx — distinguish invalid verifier from invalid code when Strava
      // tells us. Strava's error response uses { error, error_description }.
      let errorCode: StravaErrorCode = 'INVALID_CODE';
      try {
        const body = await response.clone().json();
        const blob = JSON.stringify(body).toLowerCase();
        if (blob.includes('verifier')) errorCode = 'INVALID_VERIFIER';
      } catch {
        // Best effort; keep the default.
      }
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', { code: errorCode });
      throw new StravaError('Token exchange rejected.', errorCode);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', {
        code: 'MALFORMED_TOKEN_RESPONSE',
      });
      throw new StravaError('Malformed token response.', 'MALFORMED_TOKEN_RESPONSE');
    }
    if (!isValidTokenResponse(data)) {
      await logAuditEvent('STRAVA_TOKEN_EXCHANGE_FAILED', {
        code: 'MALFORMED_TOKEN_RESPONSE',
      });
      throw new StravaError('Malformed token response.', 'MALFORMED_TOKEN_RESPONSE');
    }

    await writeStravaTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      connected: true,
      last_sync: null,
    });

    await clearPkcePending();
    await logAuditEvent('DEVICE_CONNECTED', { device: 'strava', stage: 'connected' });
    return true;
  } finally {
    codeInFlight.delete(code);
  }
}

// ============================================================
// Refresh access token (with mutex)
// ============================================================

async function performRefresh(): Promise<string> {
  if (!stravaClientId) {
    throw new StravaError('Strava client ID not configured.', 'NO_CLIENT_ID');
  }
  const tokens = await readStravaTokens();
  if (!tokens || !tokens.refresh_token) {
    throw new StravaError('No refresh token available.', 'NOT_CONNECTED');
  }

  let response: Response;
  try {
    response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: stravaClientId,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });
  } catch {
    await logAuditEvent('STRAVA_REFRESH_FAILED', { code: 'NETWORK' });
    throw new StravaError('Network error during token refresh.', 'NETWORK');
  }

  // 401/400 on refresh = revocation. Silent disconnect (PQ-A4).
  if (response.status === 401 || response.status === 400) {
    await clearStravaTokens();
    await logAuditEvent('STRAVA_REVOKED', { http_status: response.status });
    throw new StravaError('Strava session revoked.', 'REFRESH_FAILED');
  }
  if (response.status === 429) {
    await logAuditEvent('STRAVA_REFRESH_FAILED', {
      code: 'RATE_LIMITED',
      http_status: 429,
    });
    throw new StravaError('Strava rate limit exceeded.', 'RATE_LIMITED');
  }
  if (response.status >= 500) {
    await logAuditEvent('STRAVA_REFRESH_FAILED', {
      code: 'STRAVA_5XX',
      http_status: response.status,
    });
    throw new StravaError('Strava server error.', 'STRAVA_5XX');
  }
  if (!response.ok) {
    await logAuditEvent('STRAVA_REFRESH_FAILED', {
      code: 'REFRESH_FAILED',
      http_status: response.status,
    });
    throw new StravaError('Token refresh failed.', 'REFRESH_FAILED');
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    await logAuditEvent('STRAVA_REFRESH_FAILED', {
      code: 'MALFORMED_TOKEN_RESPONSE',
    });
    throw new StravaError('Malformed refresh response.', 'MALFORMED_TOKEN_RESPONSE');
  }
  if (!isValidTokenResponse(data)) {
    await logAuditEvent('STRAVA_REFRESH_FAILED', {
      code: 'MALFORMED_TOKEN_RESPONSE',
    });
    throw new StravaError('Malformed refresh response.', 'MALFORMED_TOKEN_RESPONSE');
  }

  await writeStravaTokens({
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    connected: true,
  });

  return data.access_token;
}

/**
 * Refresh the access token. Concurrent callers share a single
 * in-flight promise so we never fire two refresh exchanges at once
 * (the second would race on the same refresh_token and fail).
 */
async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;
  const promise = (async () => {
    try {
      return await performRefresh();
    } finally {
      refreshInFlight = null;
    }
  })();
  refreshInFlight = promise;
  return promise;
}

// ============================================================
// Get a valid access token (proactive refresh)
// ============================================================

async function getValidToken(): Promise<string> {
  const tokens = await readStravaTokens();
  if (!tokens || !tokens.connected || !tokens.access_token) {
    throw new StravaError('Strava not connected.', 'NOT_CONNECTED');
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expires_at <= nowSec + REFRESH_BUFFER_SECONDS) {
    return refreshAccessToken();
  }
  return tokens.access_token;
}

// ============================================================
// Public sync state (PQ-A7) — canonical read for non-strava.ts code
// ============================================================

/**
 * Read Strava connection status as a DeviceSyncState — the public
 * shape used by the device picker, Log tab, and useHealth. Tokens
 * themselves are not exposed via this surface.
 */
export async function getStravaSyncState(): Promise<DeviceSyncState> {
  const tokens = await readStravaTokens();
  if (!tokens) {
    return {
      connected: false,
      last_sync: null,
      access_token: null,
      refresh_token: null,
    };
  }
  return {
    connected: tokens.connected,
    last_sync:
      tokens.last_sync != null ? new Date(tokens.last_sync).toISOString() : null,
    access_token: null,
    refresh_token: null,
    expires_at: tokens.expires_at,
  };
}

// ============================================================
// Activity fetching
// ============================================================

/**
 * Fetch recent activities. Uses a proactive refresh when the token
 * is near expiry; falls back to a reactive refresh on a 401.
 */
export async function fetchActivities(afterEpoch?: number): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ per_page: '30' });
  if (afterEpoch) {
    params.set('after', String(afterEpoch));
  }
  const url = `${STRAVA_ACTIVITIES_URL}?${params.toString()}`;

  let token = await getValidToken();
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    token = await refreshAccessToken();
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!response.ok) {
    throw new StravaError(
      `Failed to fetch activities: ${response.status}`,
      'FETCH_FAILED',
    );
  }
  return response.json();
}

// ============================================================
// Activity mapping (preserved per S34-A scope-lock)
// ============================================================

/**
 * Map a Strava activity to a DUB_AI WorkoutEntry.
 */
export function mapStravaActivity(activity: StravaActivity, userWeightKg: number): WorkoutEntry {
  const mapping = STRAVA_TYPE_MAP[activity.type] ?? getDefaultMapping();
  const durationMinutes = Math.round(activity.moving_time / 60);
  const durationHours = durationMinutes / 60;

  const calories = activity.calories
    ? Math.round(activity.calories)
    : Math.round(mapping.met * userWeightKg * durationHours);

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
    rpe: null,
    notes: `Synced from Strava`,
    source: 'strava',
  };
}

// ============================================================
// Sync orchestration
// ============================================================

export async function syncFromStrava(userWeightLbs: number): Promise<{
  success: boolean;
  activitiesImported: number;
}> {
  const tokens = await readStravaTokens();
  if (!tokens || !tokens.connected) {
    return { success: false, activitiesImported: 0 };
  }

  const userWeightKg = userWeightLbs / 2.20462;

  try {
    const afterEpoch =
      tokens.last_sync != null
        ? Math.floor(tokens.last_sync / 1000)
        : Math.floor((Date.now() - 30 * 86400000) / 1000);

    const activities = await fetchActivities(afterEpoch);
    let imported = 0;

    for (const activity of activities) {
      const workout = mapStravaActivity(activity, userWeightKg);
      const actDate = workout.timestamp.split('T')[0];
      const key = dateKey(STORAGE_KEYS.LOG_WORKOUT, actDate);

      const existing = (await storageGet<WorkoutEntry[]>(key)) ?? [];
      if (existing.some((e) => e.id === workout.id)) continue;
      existing.push(workout);
      await storageSet(key, existing);
      imported++;
    }

    // Re-read after the fetch loop in case a refresh updated tokens.
    const fresh = await readStravaTokens();
    if (fresh) {
      await writeStravaTokens({ ...fresh, last_sync: Date.now() });
    }

    return { success: true, activitiesImported: imported };
  } catch {
    return { success: false, activitiesImported: 0 };
  }
}

// ============================================================
// Disconnect
// ============================================================

/**
 * User-initiated disconnect. Clears tokens and any pending PKCE
 * state. Distinct from STRAVA_REVOKED (silent disconnect on 401).
 */
export async function disconnectStrava(): Promise<void> {
  await clearStravaTokens();
  await clearPkcePending();
  await logAuditEvent('DEVICE_REVOKED', { device: 'strava' });
}

// ============================================================
// User-facing error copy (PQ-A5: hybrid)
// ============================================================

/**
 * Map a StravaError to user-facing copy. Detailed for actionable
 * cases (timeout, rate limit, security check); generic for the rest.
 */
export function stravaErrorToUserCopy(err: StravaError): string {
  switch (err.code) {
    case 'INVALID_CODE':
      return 'Connection timed out. Please try again.';
    case 'RATE_LIMITED':
      return 'Too many connection attempts. Please wait a few minutes.';
    case 'STATE_MISMATCH':
      return 'Connection security check failed. Please try again.';
    case 'NETWORK':
      return "Couldn't reach Strava. Check your connection and try again.";
    case 'STRAVA_5XX':
      return 'Strava is having issues. Please try again later.';
    case 'INVALID_VERIFIER':
    case 'MALFORMED_TOKEN_RESPONSE':
    case 'CANNOT_OPEN_URL':
    case 'NO_CLIENT_ID':
    case 'NOT_CONNECTED':
    case 'FETCH_FAILED':
    case 'REFRESH_FAILED':
    default:
      return 'Connection failed. Please try again.';
  }
}

// ============================================================
// Test-only resets
// ============================================================

/** Clear in-memory mutex / in-flight tracking. Tests only. */
export function __resetStravaServiceForTests(): void {
  refreshInFlight = null;
  codeInFlight.clear();
}
