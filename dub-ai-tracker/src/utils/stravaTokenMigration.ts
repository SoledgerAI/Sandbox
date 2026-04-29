// One-shot migration that moves Strava tokens from AsyncStorage
// (legacy DEVICES_STRAVA) into SecureStore (new strava_tokens key).
//
// Order of operations is important:
//   1. Write to SecureStore (new home).
//   2. Only after that succeeds, clear AsyncStorage (old home).
//   3. Set the idempotency marker.
//
// If step 1 fails we leave AsyncStorage untouched and skip the marker
// so the migration retries on the next launch. The marker is set even
// in the no-op cases (no legacy tokens, disconnected legacy state) so
// we don't keep re-checking AsyncStorage forever.

import { storageGet, storageDelete, storageSet, STORAGE_KEYS } from './storage';
import {
  writeStravaTokens,
  type StravaTokenState,
} from '../services/stravaTokenStorage';
import type { DeviceSyncState } from '../types/profile';

// At the migration boundary the legacy shape is just DeviceSyncState
// with the original last_sync ISO string. Aliased for read-site clarity.
type LegacyStravaState = DeviceSyncState;

function legacyLastSyncToMs(value: string | null | undefined): number | null {
  if (value == null) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Run the AsyncStorage -> SecureStore migration once per install.
 * Safe to call on every app launch; subsequent calls short-circuit
 * via the AsyncStorage marker.
 */
export async function migrateStravaTokensToSecureStore(): Promise<void> {
  const marker = await storageGet<boolean>(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE);
  if (marker === true) return;

  const legacy = await storageGet<LegacyStravaState>(STORAGE_KEYS.DEVICES_STRAVA);

  // Nothing to migrate: either no record at all, or the user disconnected
  // before this build shipped. Set the marker so we don't keep checking.
  if (
    legacy == null ||
    legacy.connected !== true ||
    !legacy.access_token ||
    !legacy.refresh_token
  ) {
    await storageSet(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE, true);
    return;
  }

  const reshaped: StravaTokenState = {
    access_token: legacy.access_token,
    refresh_token: legacy.refresh_token,
    // 0 forces refresh on first call. Strava returns the real expires_at
    // on refresh, which we then persist.
    expires_at: 0,
    connected: true,
    last_sync: legacyLastSyncToMs(legacy.last_sync),
  };

  // SecureStore write first. If it throws we leave the legacy data alone
  // and skip the marker — next launch retries.
  await writeStravaTokens(reshaped);

  // Clear AsyncStorage only after the SecureStore write settled.
  await storageDelete(STORAGE_KEYS.DEVICES_STRAVA);

  await storageSet(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE, true);
}
