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

async function hashPIN(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `dub_ai_pin_salt_${pin}`,
  );
}

export async function setPIN(pin: string): Promise<void> {
  const hash = await hashPIN(pin);
  await setSecure(SECURE_KEYS.AUTH_PIN_HASH, hash);
}

export async function verifyPIN(pin: string): Promise<boolean> {
  const stored = await getSecure(SECURE_KEYS.AUTH_PIN_HASH);
  if (!stored) return false;
  const hash = await hashPIN(pin);
  return hash === stored;
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
  if (val === '60') return 60;
  if (val === '300') return 300;
  if (val === '900') return 900;
  return 0; // default: immediately
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
  await deleteSecure(SECURE_KEYS.AUTH_METHOD);
}
