// AES-256 encryption utility for health data at rest (HIPAA prep)
// Phase 17: Settings and Profile Management
// Per Section 17: Security Architecture
//
// Uses react-native-aes-crypto for AES-256-CBC encryption/decryption.
// Key derivation uses PBKDF2 with minimum 100,000 iterations (SHA-256).
// NOT used for API key storage (that uses expo-secure-store).

import * as Aes from 'react-native-aes-crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 256; // bits
const IV_LENGTH = 16; // bytes (128-bit IV for AES-CBC)
const SALT_LENGTH = 32; // bytes

/**
 * Generate a cryptographically random salt (hex-encoded).
 */
export async function generateSalt(): Promise<string> {
  return Aes.randomKey(SALT_LENGTH);
}

/**
 * Derive an AES-256 key from a user-provided password/PIN using PBKDF2.
 * Returns hex-encoded key.
 *
 * IMPORTANT: Key must be derived from user input, NOT device identifiers.
 * Per Expert 2 Audit finding (Severity: MEDIUM).
 */
export async function deriveKey(
  password: string,
  salt: string,
): Promise<string> {
  return Aes.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt plaintext with AES-256-CBC.
 * Returns { ciphertext, iv } both hex-encoded.
 */
export async function encrypt(
  plaintext: string,
  key: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = await Aes.randomKey(IV_LENGTH);
  const ciphertext = await Aes.encrypt(plaintext, key, iv, 'aes-256-cbc');
  return { ciphertext, iv };
}

/**
 * Decrypt ciphertext with AES-256-CBC.
 * Returns plaintext string.
 */
export async function decrypt(
  ciphertext: string,
  key: string,
  iv: string,
): Promise<string> {
  return Aes.decrypt(ciphertext, key, iv, 'aes-256-cbc');
}

/**
 * Generate a random encryption key (hex-encoded).
 * Used for generating data encryption keys (DEKs) in key-wrapping schemes.
 */
export async function generateRandomKey(): Promise<string> {
  return Aes.randomKey(KEY_LENGTH / 8);
}
