// S34-A step 5: PKCE token exchange + state validation + single-use code.

// Override expo-crypto with a real SHA-256 implementation so digest
// calls produce deterministic output we can assert against.
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

import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  handleStravaCallback,
  initiateStravaAuth,
  StravaError,
  __setStravaClientIdForTests,
  __resetStravaServiceForTests,
} from '../services/strava';
import { readStravaTokens } from '../services/stravaTokenStorage';

const PKCE_PENDING_KEY = 'strava_pkce_pending';

beforeEach(() => {
  __setStravaClientIdForTests('222782');
  __resetStravaServiceForTests();
  // Linking is auto-mocked by jest-expo; ensure canOpenURL returns true.
  jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('initiateStravaAuth', () => {
  it('generates verifier+state, persists pending, opens URL with PKCE params', async () => {
    await initiateStravaAuth();

    const pendingRaw = await SecureStore.getItemAsync(PKCE_PENDING_KEY);
    expect(pendingRaw).not.toBeNull();
    const pending = JSON.parse(pendingRaw!);
    expect(typeof pending.verifier).toBe('string');
    expect(pending.verifier.length).toBeGreaterThanOrEqual(43);
    expect(typeof pending.state).toBe('string');
    expect(pending.state.length).toBeGreaterThanOrEqual(20);

    const openSpy = Linking.openURL as jest.Mock;
    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0] as string;
    expect(url).toContain('client_id=222782');
    expect(url).toContain('response_type=code');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('scope=read');
    expect(url).not.toContain('activity%3Aread_all');
    expect(url).toContain(`state=${encodeURIComponent(pending.state).replace(/%2B/g, '%2B')}`);
    expect(url).toContain('code_challenge=');
  });

  it('throws NO_CLIENT_ID when client id is empty', async () => {
    __setStravaClientIdForTests('');
    await expect(initiateStravaAuth()).rejects.toMatchObject({ code: 'NO_CLIENT_ID' });
  });
});

describe('handleStravaCallback — happy path', () => {
  it('exchanges code, persists tokens with expires_at, clears pending', async () => {
    await initiateStravaAuth();
    const pending = JSON.parse((await SecureStore.getItemAsync(PKCE_PENDING_KEY))!);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'a_token',
        refresh_token: 'r_token',
        expires_at: 1_900_000_000,
      }),
      clone() { return this; },
    });

    const result = await handleStravaCallback('auth_code_1', pending.state);
    expect(result).toBe(true);

    const stored = await readStravaTokens();
    expect(stored).toEqual({
      access_token: 'a_token',
      refresh_token: 'r_token',
      expires_at: 1_900_000_000,
      connected: true,
      last_sync: null,
    });

    const cleared = await SecureStore.getItemAsync(PKCE_PENDING_KEY);
    expect(cleared).toBeNull();

    // Token-exchange request body carries code_verifier, NO client_secret.
    const fetchMock = global.fetch as jest.Mock;
    const req = fetchMock.mock.calls[0];
    const body = JSON.parse(req[1].body);
    expect(body.code_verifier).toBe(pending.verifier);
    expect(body.client_id).toBe('222782');
    expect(body.grant_type).toBe('authorization_code');
    expect(body.client_secret).toBeUndefined();
  });
});

describe('handleStravaCallback — state validation', () => {
  it('throws STATE_MISMATCH when returned state differs from stored', async () => {
    await initiateStravaAuth();

    await expect(
      handleStravaCallback('auth_code_2', 'wrong_state'),
    ).rejects.toMatchObject({ code: 'STATE_MISMATCH' });

    // Token exchange must NOT have fired.
    expect(global.fetch).not.toHaveBeenCalled();
    // Pending cleared after a mismatch.
    const cleared = await SecureStore.getItemAsync(PKCE_PENDING_KEY);
    expect(cleared).toBeNull();
  });

  it('throws STATE_MISMATCH when no pending state exists', async () => {
    await expect(
      handleStravaCallback('auth_code_3', 'any_state'),
    ).rejects.toMatchObject({ code: 'STATE_MISMATCH' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('throws STATE_MISMATCH when returned state is null', async () => {
    await initiateStravaAuth();
    await expect(
      handleStravaCallback('auth_code_4', null),
    ).rejects.toMatchObject({ code: 'STATE_MISMATCH' });
  });
});

describe('handleStravaCallback — six error codes', () => {
  async function setupCallback() {
    await initiateStravaAuth();
    const pending = JSON.parse((await SecureStore.getItemAsync(PKCE_PENDING_KEY))!);
    return pending;
  }

  it('NETWORK on fetch rejection', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(
      handleStravaCallback('c1', pending.state),
    ).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('INVALID_CODE on 4xx without verifier hint', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant' }),
      clone() { return this; },
    });
    await expect(
      handleStravaCallback('c2', pending.state),
    ).rejects.toMatchObject({ code: 'INVALID_CODE' });
  });

  it('INVALID_VERIFIER on 4xx with verifier hint', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_request', error_description: 'code_verifier mismatch' }),
      clone() { return this; },
    });
    await expect(
      handleStravaCallback('c3', pending.state),
    ).rejects.toMatchObject({ code: 'INVALID_VERIFIER' });
  });

  it('RATE_LIMITED on 429', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
      clone() { return this; },
    });
    await expect(
      handleStravaCallback('c4', pending.state),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('STRAVA_5XX on 502', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({}),
      clone() { return this; },
    });
    await expect(
      handleStravaCallback('c5', pending.state),
    ).rejects.toMatchObject({ code: 'STRAVA_5XX' });
  });

  it('MALFORMED_TOKEN_RESPONSE when shape is invalid', async () => {
    const pending = await setupCallback();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'a' /* missing refresh_token, expires_at */ }),
      clone() { return this; },
    });
    await expect(
      handleStravaCallback('c6', pending.state),
    ).rejects.toMatchObject({ code: 'MALFORMED_TOKEN_RESPONSE' });
  });
});

describe('handleStravaCallback — single-use code', () => {
  it('duplicate callback for the same code is ignored', async () => {
    await initiateStravaAuth();
    const pending = JSON.parse((await SecureStore.getItemAsync(PKCE_PENDING_KEY))!);

    let resolveExchange!: (v: unknown) => void;
    const pendingFetch = new Promise((r) => { resolveExchange = r; });
    (global.fetch as jest.Mock).mockReturnValueOnce(pendingFetch);

    const first = handleStravaCallback('same_code', pending.state);
    const second = handleStravaCallback('same_code', pending.state);

    // Resolve the first call's fetch.
    resolveExchange({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'a',
        refresh_token: 'r',
        expires_at: 1_900_000_000,
      }),
      clone() { return this; },
    });

    expect(await first).toBe(true);
    expect(await second).toBe(false);
    // Only one fetch ever fired.
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
  });
});

describe('StravaError type', () => {
  it('preserves the code field', () => {
    const e = new StravaError('msg', 'NETWORK');
    expect(e.code).toBe('NETWORK');
    expect(e.name).toBe('StravaError');
    expect(e.message).toBe('msg');
  });
});
