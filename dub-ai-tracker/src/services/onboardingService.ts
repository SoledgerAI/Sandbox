// Personalization onboarding service
// Prompt 03 v2: Smart Onboarding (Sex-Based Tag Filtering + Demographic Vitamins)
// FORENSIC FIX: Reads AsyncStorage first (fast, no Keychain), writes to BOTH stores.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, asyncWithTimeout, STORAGE_READ_TIMEOUT } from '../utils/storage';
import {
  SECURE_KEYS,
  PREF_KEYS,
  getSecure,
  setSecure,
  deleteSecure,
  getPreference,
  setPreference,
} from './secureStorageService';
import type { BiologicalSex } from '../types/profile';

export type AgeRange = '18-29' | '30-44' | '45-59' | '60+';

export async function isOnboardingComplete(): Promise<boolean> {
  // PRIMARY: AsyncStorage — fast, SQLite-backed, no Keychain dependency
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE);
    if (raw !== null) {
      try { return JSON.parse(raw) === true; } catch { /* no-op */ return false; }
    }
  } catch { /* no-op */ }

  // FALLBACK: SecureStore — for data written before this fix (migration path)
  try {
    const value = await getSecure(SECURE_KEYS.ONBOARDING_COMPLETE);
    if (value === 'true') {
      // Migrate to AsyncStorage for faster reads on next launch
      AsyncStorage.setItem(
        STORAGE_KEYS.ONBOARDING_COMPLETE,
        JSON.stringify(true),
      ).catch(() => {});
      return true;
    }
  } catch { /* no-op */ }

  return false;
}

export async function completeOnboarding(): Promise<void> {
  if (__DEV__) console.log('[ONBOARD-03] completeOnboarding: writing flags...');
  // Write to BOTH stores — eliminates split-brain between code paths
  // Both writes are timeout-protected to prevent indefinite hang
  await Promise.all([
    setSecure(SECURE_KEYS.ONBOARDING_COMPLETE, 'true'),
    asyncWithTimeout(
      AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, JSON.stringify(true)),
      STORAGE_READ_TIMEOUT,
      undefined as void,
      'completeOnboarding(AsyncStorage)',
    ),
  ]);
  if (__DEV__) console.log('[ONBOARD-04] completeOnboarding: flags written');
}

export async function resetOnboarding(): Promise<void> {
  await Promise.all([
    deleteSecure(SECURE_KEYS.ONBOARDING_COMPLETE),
    AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETE).catch(() => {}),
  ]);
}

export async function getUserSex(): Promise<BiologicalSex | null> {
  const value = await getSecure(SECURE_KEYS.USER_SEX);
  if (value === 'male' || value === 'female' || value === 'intersex' || value === 'prefer_not_to_say') {
    return value;
  }
  return null;
}

export async function setUserSex(sex: BiologicalSex): Promise<void> {
  await setSecure(SECURE_KEYS.USER_SEX, sex);
}

export async function getUserZip(): Promise<string | null> {
  return getPreference(PREF_KEYS.USER_ZIP);
}

export async function setUserZip(zip: string): Promise<void> {
  if (!/^\d{5}$/.test(zip)) {
    throw new Error('ZIP code must be exactly 5 digits');
  }
  await setPreference(PREF_KEYS.USER_ZIP, zip);
}

export async function getUserAgeRange(): Promise<AgeRange | null> {
  const value = await getPreference(PREF_KEYS.USER_AGE_RANGE);
  if (value === '18-29' || value === '30-44' || value === '45-59' || value === '60+') {
    return value;
  }
  return null;
}

export async function setUserAgeRange(range: AgeRange): Promise<void> {
  await setPreference(PREF_KEYS.USER_AGE_RANGE, range);
}
