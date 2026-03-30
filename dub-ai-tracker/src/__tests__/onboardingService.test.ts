// Tests for onboardingService
// Prompt 03 v2: Smart Onboarding

import {
  isOnboardingComplete,
  completeOnboarding,
  resetOnboarding,
  getUserSex,
  setUserSex,
  getUserZip,
  setUserZip,
  getUserAgeRange,
  setUserAgeRange,
} from '../services/onboardingService';

describe('onboardingService', () => {
  describe('isOnboardingComplete', () => {
    it('returns false by default', async () => {
      expect(await isOnboardingComplete()).toBe(false);
    });

    it('returns true after completeOnboarding()', async () => {
      await completeOnboarding();
      expect(await isOnboardingComplete()).toBe(true);
    });

    it('returns false after resetOnboarding()', async () => {
      await completeOnboarding();
      await resetOnboarding();
      expect(await isOnboardingComplete()).toBe(false);
    });
  });

  describe('getUserSex / setUserSex', () => {
    it('returns null by default', async () => {
      expect(await getUserSex()).toBeNull();
    });

    it('round-trips male', async () => {
      await setUserSex('male');
      expect(await getUserSex()).toBe('male');
    });

    it('round-trips female', async () => {
      await setUserSex('female');
      expect(await getUserSex()).toBe('female');
    });

    it('round-trips prefer_not_to_say', async () => {
      await setUserSex('prefer_not_to_say');
      expect(await getUserSex()).toBe('prefer_not_to_say');
    });
  });

  describe('getUserZip / setUserZip', () => {
    it('returns null by default', async () => {
      expect(await getUserZip()).toBeNull();
    });

    it('round-trips a valid zip', async () => {
      await setUserZip('90210');
      expect(await getUserZip()).toBe('90210');
    });

    it('rejects invalid zip format', async () => {
      await expect(setUserZip('1234')).rejects.toThrow('ZIP code must be exactly 5 digits');
      await expect(setUserZip('abcde')).rejects.toThrow('ZIP code must be exactly 5 digits');
      await expect(setUserZip('123456')).rejects.toThrow('ZIP code must be exactly 5 digits');
    });
  });

  describe('getUserAgeRange / setUserAgeRange', () => {
    it('returns null by default', async () => {
      expect(await getUserAgeRange()).toBeNull();
    });

    it('round-trips 18-29', async () => {
      await setUserAgeRange('18-29');
      expect(await getUserAgeRange()).toBe('18-29');
    });

    it('round-trips 30-44', async () => {
      await setUserAgeRange('30-44');
      expect(await getUserAgeRange()).toBe('30-44');
    });

    it('round-trips 45-59', async () => {
      await setUserAgeRange('45-59');
      expect(await getUserAgeRange()).toBe('45-59');
    });

    it('round-trips 60+', async () => {
      await setUserAgeRange('60+');
      expect(await getUserAgeRange()).toBe('60+');
    });
  });
});
