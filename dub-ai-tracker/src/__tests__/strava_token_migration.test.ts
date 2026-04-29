// S34-A step 4: One-shot AsyncStorage -> SecureStore migration for Strava tokens.

import * as SecureStore from 'expo-secure-store';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import { migrateStravaTokensToSecureStore } from '../utils/stravaTokenMigration';
import {
  readStravaTokens,
  STRAVA_TOKENS_KEY,
} from '../services/stravaTokenStorage';
import type { DeviceSyncState } from '../types/profile';

const legacyConnected: DeviceSyncState = {
  connected: true,
  last_sync: '2026-04-28T12:34:56.000Z',
  access_token: 'legacy_access',
  refresh_token: 'legacy_refresh',
};

describe('strava token migration (one-shot)', () => {
  it('first-launch with legacy tokens: tokens migrated, AsyncStorage cleared, marker set', async () => {
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacyConnected);

    await migrateStravaTokensToSecureStore();

    // SecureStore now holds the tokens.
    const secure = await readStravaTokens();
    expect(secure).not.toBeNull();
    expect(secure?.access_token).toBe('legacy_access');
    expect(secure?.refresh_token).toBe('legacy_refresh');
    expect(secure?.connected).toBe(true);
    // expires_at = 0 forces refresh on next call.
    expect(secure?.expires_at).toBe(0);
    // last_sync converted from ISO to Unix ms.
    expect(secure?.last_sync).toBe(Date.parse('2026-04-28T12:34:56.000Z'));

    // Legacy AsyncStorage cleared.
    const legacy = await storageGet(STORAGE_KEYS.DEVICES_STRAVA);
    expect(legacy).toBeNull();

    // Marker set.
    const marker = await storageGet<boolean>(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE);
    expect(marker).toBe(true);
  });

  it('first-launch with no AsyncStorage tokens: no-op, marker set', async () => {
    await migrateStravaTokensToSecureStore();

    const secure = await readStravaTokens();
    expect(secure).toBeNull();

    const marker = await storageGet<boolean>(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE);
    expect(marker).toBe(true);
  });

  it('first-launch with disconnected legacy state: no-op, marker set', async () => {
    const disconnected: DeviceSyncState = {
      connected: false,
      last_sync: null,
      access_token: null,
      refresh_token: null,
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, disconnected);

    await migrateStravaTokensToSecureStore();

    const secure = await readStravaTokens();
    expect(secure).toBeNull();

    const marker = await storageGet<boolean>(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE);
    expect(marker).toBe(true);
  });

  it('re-run after successful migration (marker present): no-op', async () => {
    await storageSet(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE, true);
    // Place legacy tokens that the migration must NOT touch.
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacyConnected);

    await migrateStravaTokensToSecureStore();

    // SecureStore should still be empty.
    const secure = await readStravaTokens();
    expect(secure).toBeNull();
    // Legacy still present, untouched.
    const legacy = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    expect(legacy).not.toBeNull();
    expect(legacy?.access_token).toBe('legacy_access');
  });

  it('SecureStore write fails: AsyncStorage NOT cleared, marker NOT set', async () => {
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacyConnected);

    const original = SecureStore.setItemAsync as jest.Mock;
    const failingMock = jest.fn(() => Promise.reject(new Error('SecureStore boom')));
    (SecureStore.setItemAsync as unknown as jest.Mock) = failingMock;

    await expect(migrateStravaTokensToSecureStore()).rejects.toThrow('SecureStore boom');

    // Restore mock so subsequent assertions can read state via SecureStore again.
    (SecureStore.setItemAsync as unknown as jest.Mock) = original;

    // Legacy still in place.
    const legacy = await storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA);
    expect(legacy?.access_token).toBe('legacy_access');

    // Marker NOT set — migration will retry next launch.
    const marker = await storageGet<boolean>(STORAGE_KEYS.MIGRATION_STRAVA_TOKENS_DONE);
    expect(marker).toBeNull();
  });

  it('idempotent across multiple re-runs', async () => {
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacyConnected);

    await migrateStravaTokensToSecureStore();
    const firstSecure = await readStravaTokens();
    await migrateStravaTokensToSecureStore();
    const secondSecure = await readStravaTokens();
    await migrateStravaTokensToSecureStore();
    const thirdSecure = await readStravaTokens();

    expect(secondSecure).toEqual(firstSecure);
    expect(thirdSecure).toEqual(firstSecure);
  });

  it('legacy state with null last_sync produces null in SecureStore', async () => {
    const legacy: DeviceSyncState = {
      ...legacyConnected,
      last_sync: null,
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacy);

    await migrateStravaTokensToSecureStore();

    const secure = await readStravaTokens();
    expect(secure?.last_sync).toBeNull();
  });

  it('legacy state with malformed last_sync ISO string falls back to null', async () => {
    const legacy: DeviceSyncState = {
      ...legacyConnected,
      last_sync: 'not-a-date',
    };
    await storageSet(STORAGE_KEYS.DEVICES_STRAVA, legacy);

    await migrateStravaTokensToSecureStore();

    const secure = await readStravaTokens();
    expect(secure?.last_sync).toBeNull();
  });

  it('SecureStore key for tokens is "strava_tokens"', () => {
    // Lock the key name so we never accidentally rename it without
    // also touching the migration helper that depends on it.
    expect(STRAVA_TOKENS_KEY).toBe('strava_tokens');
  });
});
