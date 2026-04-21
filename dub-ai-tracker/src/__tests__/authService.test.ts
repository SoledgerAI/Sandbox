// Tests for authService
// Prompt 01 v2: App Lock & Biometric Authentication

import {
  isLockEnabled,
  setLockEnabled,
  getAuthMethod,
  setAuthMethod,
  isBiometricAvailable,
  authenticateBiometric,
  setPIN,
  verifyPIN,
  hasPIN,
  clearAuthData,
} from '../services/authService';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import { SECURE_KEYS } from '../services/secureStorageService';

const secureStore: Map<string, string> = (global as any).__mockSecureStore;

describe('authService', () => {
  describe('isLockEnabled', () => {
    it('returns false by default', async () => {
      expect(await isLockEnabled()).toBe(false);
    });

    it('returns true after setLockEnabled(true)', async () => {
      await setLockEnabled(true);
      expect(await isLockEnabled()).toBe(true);
    });

    it('returns false after setLockEnabled(false)', async () => {
      await setLockEnabled(true);
      await setLockEnabled(false);
      expect(await isLockEnabled()).toBe(false);
    });
  });

  describe('authMethod', () => {
    it('defaults to biometric', async () => {
      expect(await getAuthMethod()).toBe('biometric');
    });

    it('round-trips pin method', async () => {
      await setAuthMethod('pin');
      expect(await getAuthMethod()).toBe('pin');
    });

    it('round-trips both method', async () => {
      await setAuthMethod('both');
      expect(await getAuthMethod()).toBe('both');
    });
  });

  describe('PIN set/verify', () => {
    it('hasPIN returns false by default', async () => {
      expect(await hasPIN()).toBe(false);
    });

    it('setPIN + verifyPIN round-trip succeeds', async () => {
      await setPIN('1234');
      expect(await hasPIN()).toBe(true);
      expect(await verifyPIN('1234')).toBe(true);
    });

    it('verifyPIN returns false for wrong PIN', async () => {
      await setPIN('1234');
      expect(await verifyPIN('5678')).toBe(false);
    });

    it('verifyPIN returns false when no PIN is set', async () => {
      expect(await verifyPIN('1234')).toBe(false);
    });
  });

  describe('PIN salt + migration', () => {
    const LEGACY_PREFIX = 'dub_ai_pin_salt_';

    // Seeds SecureStore as if a v1.0 user with static-salt hash
    const seedLegacyUser = async (pin: string) => {
      const digestMock = Crypto.digestStringAsync as jest.Mock;
      const legacyHash = (await digestMock('SHA-256', `${LEGACY_PREFIX}${pin}`)) as string;
      secureStore.set(SECURE_KEYS.AUTH_PIN_HASH, legacyHash);
      // Deliberately no AUTH_PIN_SALT, no AUTH_PIN_MIGRATED
    };

    it('setPIN stores both a salt and a hash', async () => {
      await setPIN('1234');
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_HASH)).toBeTruthy();
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_SALT)).toBeTruthy();
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBe('true');
    });

    it('new PIN hash is NOT the legacy static-salt hash', async () => {
      const digestMock = Crypto.digestStringAsync as jest.Mock;
      const legacyHash = await digestMock('SHA-256', `${LEGACY_PREFIX}1234`);
      await setPIN('1234');
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_HASH)).not.toBe(legacyHash);
    });

    it('two fresh PIN setups produce different salts', async () => {
      await setPIN('1234');
      const saltA = secureStore.get(SECURE_KEYS.AUTH_PIN_SALT);
      await clearAuthData();
      await setPIN('1234');
      const saltB = secureStore.get(SECURE_KEYS.AUTH_PIN_SALT);
      expect(saltA).toBeTruthy();
      expect(saltB).toBeTruthy();
      expect(saltA).not.toBe(saltB);
    });

    it('verifyPIN auto-migrates a legacy static-salt hash on success', async () => {
      await seedLegacyUser('1234');
      expect(secureStore.has(SECURE_KEYS.AUTH_PIN_SALT)).toBe(false);
      expect(secureStore.has(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBe(false);

      const ok = await verifyPIN('1234');

      expect(ok).toBe(true);
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBe('true');
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_SALT)).toBeTruthy();
      // Hash should now be the new salted form, not the legacy form
      const digestMock = Crypto.digestStringAsync as jest.Mock;
      const legacyHash = await digestMock('SHA-256', `${LEGACY_PREFIX}1234`);
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_HASH)).not.toBe(legacyHash);
    });

    it('after migration, the legacy hash format no longer verifies', async () => {
      await seedLegacyUser('1234');
      const oldHashBeforeMigration = secureStore.get(SECURE_KEYS.AUTH_PIN_HASH);
      expect(await verifyPIN('1234')).toBe(true);

      // The stored hash has been replaced — setting it back should NOT validate,
      // because MIGRATED is now true and verification uses the new salt path.
      secureStore.set(SECURE_KEYS.AUTH_PIN_HASH, oldHashBeforeMigration!);
      // New salt won't reproduce the legacy hash from the correct PIN
      expect(await verifyPIN('1234')).toBe(false);
    });

    it('verifyPIN rejects a wrong PIN both before and after migration', async () => {
      await seedLegacyUser('1234');
      expect(await verifyPIN('9999')).toBe(false);
      // Still unmigrated after failure
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBeUndefined();

      // Successful migration
      expect(await verifyPIN('1234')).toBe(true);
      // Wrong PIN still fails post-migration
      expect(await verifyPIN('9999')).toBe(false);
    });

    it('reset flow (clearAuthData + setPIN) generates a fresh salt + migrated flag', async () => {
      await setPIN('1234');
      const saltA = secureStore.get(SECURE_KEYS.AUTH_PIN_SALT);

      await clearAuthData();
      expect(secureStore.has(SECURE_KEYS.AUTH_PIN_SALT)).toBe(false);
      expect(secureStore.has(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBe(false);

      await setPIN('5678');
      const saltB = secureStore.get(SECURE_KEYS.AUTH_PIN_SALT);
      expect(saltB).toBeTruthy();
      expect(saltB).not.toBe(saltA);
      expect(secureStore.get(SECURE_KEYS.AUTH_PIN_MIGRATED)).toBe('true');
      expect(await verifyPIN('5678')).toBe(true);
      expect(await verifyPIN('1234')).toBe(false);
    });

    it('verifyPIN returns false if salt is missing despite migrated flag', async () => {
      await setPIN('1234');
      secureStore.delete(SECURE_KEYS.AUTH_PIN_SALT);
      expect(await verifyPIN('1234')).toBe(false);
    });
  });

  describe('biometric', () => {
    it('reports availability correctly', async () => {
      const result = await isBiometricAvailable();
      expect(result.available).toBe(true);
      // Mock returns FINGERPRINT type
      expect(result.biometryType).toBe('Touch ID');
    });

    it('reports not available when no hardware', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
      const result = await isBiometricAvailable();
      expect(result.available).toBe(false);
      expect(result.biometryType).toBeNull();
    });

    it('reports Face ID when facial recognition available', async () => {
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock)
        .mockResolvedValueOnce([LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION]);
      const result = await isBiometricAvailable();
      expect(result.biometryType).toBe('Face ID');
    });

    it('authenticateBiometric returns true on success', async () => {
      expect(await authenticateBiometric()).toBe(true);
    });

    it('authenticateBiometric returns false on failure', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
      });
      expect(await authenticateBiometric()).toBe(false);
    });
  });

  describe('clearAuthData', () => {
    it('clears all auth state', async () => {
      await setLockEnabled(true);
      await setAuthMethod('both');
      await setPIN('9999');

      await clearAuthData();

      expect(await isLockEnabled()).toBe(false);
      expect(await getAuthMethod()).toBe('biometric'); // default
      expect(await hasPIN()).toBe(false);
    });
  });
});
