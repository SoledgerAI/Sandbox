// PKCE (Proof Key for Code Exchange) helpers — RFC 7636
//
// Hand-rolled on top of expo-crypto. Used by the Strava OAuth flow
// (S34-A) to authenticate without a client_secret. The flow is:
//
//   1. Client generates a random code_verifier.
//   2. Client derives code_challenge = base64url(SHA-256(verifier)).
//   3. Authorization request carries code_challenge + S256 method.
//   4. Token exchange carries the original code_verifier; the
//      authorization server verifies SHA-256(verifier) === challenge.
//
// State is generated alongside the verifier and round-trips through
// the redirect to defeat CSRF. Both values are persisted in
// SecureStore until the redirect resolves, then cleared.

import * as Crypto from 'expo-crypto';

const VERIFIER_BYTES = 32; // 32 bytes -> 43 base64url chars (RFC 7636 minimum)
const STATE_BYTES = 16;    // 16 bytes -> 22 base64url chars

/**
 * Strip base64 padding and translate the URL-unsafe alphabet
 * (`+/`) to the URL-safe alphabet (`-_`).
 */
export function base64ToBase64url(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Convert a Uint8Array to a base64url string.
 * Uses btoa (available in Hermes; see fatsecret.ts:46 for precedent).
 * Falls back to Buffer in Node test environments.
 */
export function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');
  return base64ToBase64url(b64);
}

/**
 * Generate a fresh PKCE code_verifier. 32 random bytes,
 * base64url-encoded — yields 43 characters of [A-Za-z0-9-_].
 */
export async function generateCodeVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(VERIFIER_BYTES);
  return bytesToBase64url(bytes);
}

/**
 * Derive the PKCE code_challenge from a verifier.
 * challenge = base64url(SHA-256(verifier)).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digestB64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  return base64ToBase64url(digestB64);
}

/**
 * Generate a fresh CSRF state token. 16 random bytes,
 * base64url-encoded — yields 22 characters.
 */
export async function generateState(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(STATE_BYTES);
  return bytesToBase64url(bytes);
}
