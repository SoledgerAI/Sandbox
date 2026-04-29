// S34-A step 5: getStravaSyncState — canonical read for non-strava.ts callers.

import { getStravaSyncState } from '../services/strava';
import {
  writeStravaTokens,
  type StravaTokenState,
} from '../services/stravaTokenStorage';

describe('getStravaSyncState', () => {
  it('returns disconnected default when no tokens exist', async () => {
    const state = await getStravaSyncState();
    expect(state).toEqual({
      connected: false,
      last_sync: null,
      access_token: null,
      refresh_token: null,
    });
  });

  it('returns connected=true and ISO last_sync when tokens are present', async () => {
    const tokens: StravaTokenState = {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1_900_000_000,
      connected: true,
      last_sync: Date.parse('2026-04-28T10:00:00.000Z'),
    };
    await writeStravaTokens(tokens);

    const state = await getStravaSyncState();
    expect(state.connected).toBe(true);
    expect(state.last_sync).toBe('2026-04-28T10:00:00.000Z');
    expect(state.expires_at).toBe(1_900_000_000);
    // Tokens themselves are NOT exposed via this surface.
    expect(state.access_token).toBeNull();
    expect(state.refresh_token).toBeNull();
  });

  it('returns null last_sync when never synced', async () => {
    const tokens: StravaTokenState = {
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 1_900_000_000,
      connected: true,
      last_sync: null,
    };
    await writeStravaTokens(tokens);

    const state = await getStravaSyncState();
    expect(state.last_sync).toBeNull();
  });
});
