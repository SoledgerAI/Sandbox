// S34-A step 3: SecureStore-backed Strava token storage.

import * as SecureStore from 'expo-secure-store';
import {
  readStravaTokens,
  writeStravaTokens,
  clearStravaTokens,
  STRAVA_TOKENS_KEY,
  type StravaTokenState,
} from '../services/stravaTokenStorage';

const sample: StravaTokenState = {
  access_token: 'access_abc',
  refresh_token: 'refresh_xyz',
  expires_at: 1_800_000_000,
  connected: true,
  last_sync: null,
};

describe('strava token storage', () => {
  it('returns null when no token exists', async () => {
    const state = await readStravaTokens();
    expect(state).toBeNull();
  });

  it('write then read returns the same state', async () => {
    await writeStravaTokens(sample);
    const state = await readStravaTokens();
    expect(state).toEqual(sample);
  });

  it('clear removes the entry; subsequent read returns null', async () => {
    await writeStravaTokens(sample);
    await clearStravaTokens();
    const state = await readStravaTokens();
    expect(state).toBeNull();
  });

  it('concurrent writes are sequenced (no torn state, last write wins)', async () => {
    const a: StravaTokenState = { ...sample, access_token: 'a' };
    const b: StravaTokenState = { ...sample, access_token: 'b' };
    await Promise.all([writeStravaTokens(a), writeStravaTokens(b)]);
    const state = await readStravaTokens();
    expect(state).not.toBeNull();
    expect(['a', 'b']).toContain(state!.access_token);
    // Other fields fully present (no torn state).
    expect(state!.refresh_token).toBe(sample.refresh_token);
    expect(state!.expires_at).toBe(sample.expires_at);
  });

  it('malformed JSON in storage returns null (does not throw)', async () => {
    await SecureStore.setItemAsync(STRAVA_TOKENS_KEY, '{not-valid-json');
    const state = await readStravaTokens();
    expect(state).toBeNull();
  });

  it('preserves last_sync when set to a numeric timestamp', async () => {
    const withSync: StravaTokenState = { ...sample, last_sync: 1_700_000_000_000 };
    await writeStravaTokens(withSync);
    const state = await readStravaTokens();
    expect(state?.last_sync).toBe(1_700_000_000_000);
  });
});
