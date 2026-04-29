// Strava token storage — SecureStore-backed.
//
// All Strava token persistence (read AND write) goes through this
// module. Legacy AsyncStorage DEVICES_STRAVA is touched ONLY by the
// one-shot migration helper in stravaTokenMigration.ts.
//
// Each write is a single SecureStore call so concurrent writers
// can never observe a torn state — the SecureStore key either holds
// the old JSON or the new JSON, never a mix.

import * as SecureStore from 'expo-secure-store';

export const STRAVA_TOKENS_KEY = 'strava_tokens';

export interface StravaTokenState {
  access_token: string;
  refresh_token: string;
  /** Unix timestamp seconds. 0 = unknown / forces refresh on next call. */
  expires_at: number;
  connected: boolean;
  /** Unix timestamp ms (preserved from legacy schema). null if never synced. */
  last_sync: number | null;
}

export async function readStravaTokens(): Promise<StravaTokenState | null> {
  try {
    const raw = await SecureStore.getItemAsync(STRAVA_TOKENS_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as StravaTokenState;
    return parsed;
  } catch {
    // Malformed JSON or read error -> caller treats as "no tokens".
    return null;
  }
}

export async function writeStravaTokens(state: StravaTokenState): Promise<void> {
  await SecureStore.setItemAsync(STRAVA_TOKENS_KEY, JSON.stringify(state));
}

export async function clearStravaTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STRAVA_TOKENS_KEY);
}
