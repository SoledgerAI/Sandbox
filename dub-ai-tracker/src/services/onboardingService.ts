// Personalization onboarding service
// Prompt 03 v2: Smart Onboarding (Sex-Based Tag Filtering + Demographic Vitamins)

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
  const value = await getSecure(SECURE_KEYS.ONBOARDING_COMPLETE);
  return value === 'true';
}

export async function completeOnboarding(): Promise<void> {
  await setSecure(SECURE_KEYS.ONBOARDING_COMPLETE, 'true');
}

export async function resetOnboarding(): Promise<void> {
  await deleteSecure(SECURE_KEYS.ONBOARDING_COMPLETE);
}

export async function getUserSex(): Promise<BiologicalSex | null> {
  const value = await getSecure(SECURE_KEYS.USER_SEX);
  if (value === 'male' || value === 'female' || value === 'prefer_not_to_say') {
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
