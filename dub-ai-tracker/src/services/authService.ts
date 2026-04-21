// Auth service: app lock state, biometric auth, PIN fallback
// Prompt 01 v2: App Lock & Biometric Authentication

import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import {
  SECURE_KEYS,
  getSecure,
  setSecure,
  deleteSecure,
} from './secureStorageService';

export type AuthMethod = 'biometric' | 'pin' | 'both';

// ============================================================
// Lock state
// ============================================================

export async function isLockEnabled(): Promise<boolean> {
  const val = await getSecure(SECURE_KEYS.APP_LOCK_ENABLED);
  return val === 'true';
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  await setSecure(SECURE_KEYS.APP_LOCK_ENABLED, enabled ? 'true' : 'false');
}

// ============================================================
// Auth method
// ============================================================

export async function getAuthMethod(): Promise<AuthMethod> {
  const val = await getSecure(SECURE_KEYS.AUTH_METHOD);
  if (val === 'pin' || val === 'biometric' || val === 'both') return val;
  return 'biometric';
}

export async function setAuthMethod(method: AuthMethod): Promise<void> {
  await setSecure(SECURE_KEYS.AUTH_METHOD, method);
}

// ============================================================
// Biometric
// ============================================================

export async function isBiometricAvailable(): Promise<{
  available: boolean;
  biometryType: string | null;
}> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (!hasHardware || !isEnrolled) {
    return { available: false, biometryType: null };
  }

  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  let biometryType: string | null = null;
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    biometryType = 'Face ID';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    biometryType = 'Touch ID';
  }

  return { available: true, biometryType };
}

export async function authenticateBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock DUB_AI Tracker',
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return result.success;
}

// ============================================================
// PIN
// ============================================================
// Hash scheme: SHA-256(hexSalt + pin), salt is 32 random bytes
// stored in SecureStore. SHA-256 (not bcrypt/scrypt) is fine here —
// PIN is 4 digits, so rate-limiting at the AuthGate is the real
// defense, not hash cost. Random salt still prevents rainbow tables
// across devices.

// Legacy static salt — ONLY referenced inside legacyHashPIN for the
// one-shot migration from v1.0 builds. Do not use for new hashes.
const LEGACY_STATIC_SALT_PREFIX = 'dub_ai_pin_salt_';

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return bytesToHex(bytes);
}

async function hashPINWithSalt(salt: string, pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + pin,
  );
}

async function legacyHashPIN(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${LEGACY_STATIC_SALT_PREFIX}${pin}`,
  );
}

async function storeNewSaltAndHash(pin: string): Promise<void> {
  const salt = await generateSalt();
  const hash = await hashPINWithSalt(salt, pin);
  await setSecure(SECURE_KEYS.AUTH_PIN_SALT, salt);
  await setSecure(SECURE_KEYS.AUTH_PIN_HASH, hash);
  await setSecure(SECURE_KEYS.AUTH_PIN_MIGRATED, 'true');
}

export async function setPIN(pin: string): Promise<void> {
  await storeNewSaltAndHash(pin);
}

export async function verifyPIN(pin: string): Promise<boolean> {
  const stored = await getSecure(SECURE_KEYS.AUTH_PIN_HASH);
  if (!stored) return false;

  const migrated = (await getSecure(SECURE_KEYS.AUTH_PIN_MIGRATED)) === 'true';

  if (migrated) {
    const salt = await getSecure(SECURE_KEYS.AUTH_PIN_SALT);
    if (!salt) return false;
    const hash = await hashPINWithSalt(salt, pin);
    return hash === stored;
  }

  const legacyHash = await legacyHashPIN(pin);
  if (legacyHash !== stored) return false;

  // Legacy hash matched — upgrade in-place before returning success.
  await storeNewSaltAndHash(pin);
  return true;
}

export async function hasPIN(): Promise<boolean> {
  const stored = await getSecure(SECURE_KEYS.AUTH_PIN_HASH);
  return stored !== null;
}

// ============================================================
// Manual lock trigger
// ============================================================

type LockListener = () => void;
const lockListeners: Set<LockListener> = new Set();

/** Register a listener that fires when lockApp() is called */
export function onLockRequested(listener: LockListener): () => void {
  lockListeners.add(listener);
  return () => { lockListeners.delete(listener); };
}

/** Trigger app lock from anywhere (e.g., Settings "Lock App Now" button) */
export function lockApp(): void {
  lockListeners.forEach((fn) => fn());
}

// ============================================================
// Lock timeout configuration
// ============================================================

export type LockTimeout = 0 | 60 | 300 | 900; // seconds: immediately, 1min, 5min, 15min

export async function getLockTimeout(): Promise<LockTimeout> {
  const val = await getSecure('dub.lock_timeout' as any);
  if (val === '0') return 0;
  if (val === '60') return 60;
  if (val === '900') return 900;
  return 300; // default: 5 minutes — prevents doom loop on quick app switches
}

export async function setLockTimeout(timeout: LockTimeout): Promise<void> {
  await setSecure('dub.lock_timeout' as any, String(timeout));
}

// ============================================================
// Clear all auth data (used when disabling lock)
// ============================================================

export async function clearAuthData(): Promise<void> {
  await deleteSecure(SECURE_KEYS.APP_LOCK_ENABLED);
  await deleteSecure(SECURE_KEYS.AUTH_PIN_HASH);
  await deleteSecure(SECURE_KEYS.AUTH_PIN_SALT);
  await deleteSecure(SECURE_KEYS.AUTH_PIN_MIGRATED);
  await deleteSecure(SECURE_KEYS.AUTH_METHOD);
}
