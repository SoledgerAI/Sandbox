// PKCE module tests (S34-A step 1).
//
// The global jest.setup.js mock for expo-crypto returns `hash_${data}`
// regardless of algorithm and lacks CryptoEncoding. We override it here
// with a real SHA-256 implementation so the RFC 7636 test vector passes.

jest.mock('expo-crypto', () => {
  const nodeCrypto = jest.requireActual('crypto');
  return {
    digestStringAsync: jest.fn((_algo, data, opts) => {
      const encoding = opts?.encoding === 'base64' ? 'base64' : 'hex';
      const hash = nodeCrypto.createHash('sha256').update(data, 'utf8').digest(encoding);
      return Promise.resolve(hash);
    }),
    getRandomBytesAsync: jest.fn((n) => {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = i;
      return Promise.resolve(bytes);
    }),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { BASE64: 'base64', HEX: 'hex' },
  };
});

import {
  base64ToBase64url,
  bytesToBase64url,
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from '../utils/pkce';

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

describe('base64ToBase64url', () => {
  it('replaces + with -', () => {
    expect(base64ToBase64url('a+b+c')).toBe('a-b-c');
  });
  it('replaces / with _', () => {
    expect(base64ToBase64url('a/b/c')).toBe('a_b_c');
  });
  it('strips trailing = padding', () => {
    expect(base64ToBase64url('abc==')).toBe('abc');
    expect(base64ToBase64url('abcd=')).toBe('abcd');
  });
  it('combines all three transforms', () => {
    expect(base64ToBase64url('a+b/c==')).toBe('a-b_c');
  });
});

describe('bytesToBase64url', () => {
  it('encodes a known byte sequence', () => {
    // 'M' 'a' 'n' = 0x4d 0x61 0x6e -> base64 'TWFu'
    expect(bytesToBase64url(new Uint8Array([0x4d, 0x61, 0x6e]))).toBe('TWFu');
  });
  it('produces no padding', () => {
    // 'A' = 0x41 -> base64 'QQ==' -> base64url 'QQ'
    expect(bytesToBase64url(new Uint8Array([0x41]))).toBe('QQ');
  });
  it('uses url-safe alphabet (no + or /)', () => {
    // bytes that produce + and / in base64
    const bytes = new Uint8Array([0xfb, 0xff, 0xfe]);
    const out = bytesToBase64url(bytes);
    expect(out).not.toContain('+');
    expect(out).not.toContain('/');
    expect(out).toMatch(BASE64URL_RE);
  });
});

describe('generateCodeVerifier', () => {
  it('returns a base64url string of at least 43 chars', async () => {
    const v = await generateCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v).toMatch(BASE64URL_RE);
  });
  it('contains no padding or url-unsafe characters', async () => {
    const v = await generateCodeVerifier();
    expect(v).not.toContain('=');
    expect(v).not.toContain('+');
    expect(v).not.toContain('/');
  });
});

describe('generateCodeChallenge', () => {
  it('matches the RFC 7636 Appendix B test vector', async () => {
    // Per RFC 7636 Appendix B:
    //   verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    //   SHA-256(verifier) base64url = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toBe(expected);
  });
  it('yields a base64url string with no padding', async () => {
    const challenge = await generateCodeChallenge('any-verifier');
    expect(challenge).toMatch(BASE64URL_RE);
    expect(challenge).not.toContain('=');
  });
});

describe('generateState', () => {
  it('returns a 22-character base64url string', async () => {
    const s = await generateState();
    expect(s.length).toBe(22);
    expect(s).toMatch(BASE64URL_RE);
  });
});
