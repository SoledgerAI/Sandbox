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
