// Unified storage service — sensitive data in SecureStore, preferences in AsyncStorage
// Task A: Prompt 07 v2

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================
// SENSITIVE — stored in SecureStore (encrypted, hardware-backed)
// API keys, auth credentials, PHI, consent records
// ============================================================
export const SECURE_KEYS = {
  ANTHROPIC_API_KEY: 'dub_ai_anthropic_api_key',
  APP_LOCK_ENABLED: 'dub_ai_app_lock_enabled',
  AUTH_PIN_HASH: 'dub_ai_auth_pin_hash',
  AUTH_METHOD: 'dub_ai_auth_method',
  USER_SEX: 'dub_ai_user_sex',
  ONBOARDING_COMPLETE: 'dub_ai_onboarding_complete',
  CONSENT_RECORD: 'dub_ai_consent_record',
} as const;

// ============================================================
// NON-SENSITIVE — stored in AsyncStorage (unencrypted)
// UI prefs, dismissed prompts, feature flags
// ============================================================
export const PREF_KEYS = {
  AUTH_TIMEOUT_MINUTES: '@dub_ai_auth_timeout_minutes',
  ONBOARDING_COMPLETE: '@dub_ai_onboarding_complete',
  WEIGHT_PROMPT_DISMISSED: '@dub_ai_weight_prompt_dismissed',
  USER_ZIP: '@dub_ai_user_zip',
  USER_AGE_RANGE: '@dub_ai_user_age_range',
  USER_HEIGHT_INCHES: '@dub_ai_user_height_inches',
  THEME: '@dub_ai_theme',
  AFFILIATE_BANNER_DISMISSED: '@dub_ai_affiliate_banner_dismissed',
} as const;

// ============================================================
// Secure Storage (expo-secure-store)
// ============================================================

export async function getSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecure(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}

// ============================================================
// Preference Storage (AsyncStorage)
// ============================================================

export async function getPreference(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(key, value);
}
