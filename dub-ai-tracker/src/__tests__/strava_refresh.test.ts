// S34-A step 5: refresh access token + mutex + proactive refresh +
// silent disconnect on 401.

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  let counter = 0;
  return {
    digestStringAsync: jest.fn((_algo, data, opts) => {
      const enc = opts?.encoding === 'base64' ? 'base64' : 'hex';
      return Promise.resolve(
        nodeCrypto.createHash('sha256').update(data, 'utf8').digest(enc),
      );
    }),
    getRandomBytesAsync: jest.fn((n: number) => {
      counter = (counter + 1) & 0xffff;
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (i + counter) & 0xff;
      return Promise.resolve(bytes);
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64', HEX: 'hex' },
  };
});

import {
  fetchActivities,
  __setStravaClientIdForTests,
  __resetStravaServiceForTests,
} from '../services/strava';
import {
  readStravaTokens,
  writeStravaTokens,
  type StravaTokenState,
} from '../services/stravaTokenStorage';

const NOW_SEC = 1_800_000_000;

function nowSecToken(extra: Partial<StravaTokenState> = {}): StravaTokenState {
  return {
    access_token: 'access_old',
    refresh_token: 'refresh_old',
    expires_at: NOW_SEC + 3600,
    connected: true,
    last_sync: null,
    ...extra,
  };
}

beforeEach(() => {
  __setStravaClientIdForTests('222782');
  __resetStravaServiceForTests();
  jest.spyOn(Date, 'now').mockReturnValue(NOW_SEC * 1000);
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

describe('proactive refresh', () => {
  it('refreshes when expires_at is within the buffer window', async () => {
    // Token expires in 10 seconds — inside the 30s buffer.
    await writeStravaTokens(nowSecToken({ expires_at: NOW_SEC + 10 }));

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    // First fetch = refresh (token URL); second fetch = activities.
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access_new',
          refresh_token: 'refresh_new',
          expires_at: NOW_SEC + 21600,
        }),
        clone() { return this; },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        clone() { return this; },
      });

    await fetchActivities();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const refreshCall = fetchMock.mock.calls[0];
    expect(refreshCall[0]).toBe('https://www.strava.com/oauth/token');
    const refreshBody = JSON.parse(refreshCall[1].body);
    expect(refreshBody.grant_type).toBe('refresh_token');
    expect(refreshBody.refresh_token).toBe('refresh_old');
    expect(refreshBody.client_id).toBe('222782');
    expect(refreshBody.client_secret).toBeUndefined();

    // Activities call uses the new access token.
    const activitiesCall = fetchMock.mock.calls[1];
    expect(activitiesCall[1].headers.Authorization).toBe('Bearer access_new');

    // Tokens persisted with the new values.
    const stored = await readStravaTokens();
    expect(stored?.access_token).toBe('access_new');
    expect(stored?.refresh_token).toBe('refresh_new');
    expect(stored?.expires_at).toBe(NOW_SEC + 21600);
  });

  it('skips refresh when token is well within validity', async () => {
    await writeStravaTokens(nowSecToken({ expires_at: NOW_SEC + 7200 }));

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
      clone() { return this; },
    });

    await fetchActivities();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('athlete/activities');
  });
});

describe('reactive refresh on 401', () => {
  it('refreshes after a 401 from the activities endpoint and retries', async () => {
    await writeStravaTokens(nowSecToken({ expires_at: NOW_SEC + 7200 }));

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock
      // First activities call returns 401.
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
        clone() { return this; },
      })
      // Refresh succeeds.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'access_new',
          refresh_token: 'refresh_new',
          expires_at: NOW_SEC + 21600,
        }),
        clone() { return this; },
      })
      // Retry with new token.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
        clone() { return this; },
      });

    const result = await fetchActivities();
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Retry uses Bearer access_new.
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer access_new');
  });
});

describe('refresh mutex', () => {
  it('concurrent activity fetches share a single refresh', async () => {
    await writeStravaTokens(nowSecToken({ expires_at: NOW_SEC + 5 }));

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();

    // Refresh and activity calls — count refresh calls separately.
    let refreshCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://www.strava.com/oauth/token') {
        refreshCalls++;
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              json: async () => ({
                access_token: 'access_new',
                refresh_token: 'refresh_new',
                expires_at: NOW_SEC + 21600,
              }),
              clone() { return this; },
            });
          }, 5);
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [],
        clone() { return this; },
      });
    });

    await Promise.all([fetchActivities(), fetchActivities(), fetchActivities()]);

    expect(refreshCalls).toBe(1);
  });
});

describe('silent disconnect on revocation', () => {
  it('clears tokens and throws when refresh returns 401', async () => {
    await writeStravaTokens(nowSecToken({ expires_at: NOW_SEC + 5 }));

    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
      clone() { return this; },
    });

    await expect(fetchActivities()).rejects.toMatchObject({ code: 'REFRESH_FAILED' });

    // Tokens cleared from SecureStore (silent disconnect).
    const stored = await readStravaTokens();
    expect(stored).toBeNull();
  });
});
