// Profile data hook for onboarding
// Phase 3: Onboarding Flow

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import type { UserProfile, ConsentRecord, AppSettings, EngagementTier } from '../types/profile';

interface UseProfileResult {
  profile: Partial<UserProfile> | null;
  consent: ConsentRecord | null;
  settings: Partial<AppSettings> | null;
  tier: EngagementTier | null;
  enabledTags: string[] | null;
  loading: boolean;
  saveProfile: (update: Partial<UserProfile>) => Promise<void>;
  saveConsent: (consent: ConsentRecord) => Promise<void>;
  saveSettings: (update: Partial<AppSettings>) => Promise<void>;
  saveTier: (tier: EngagementTier) => Promise<void>;
  saveEnabledTags: (tags: string[]) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [settings, setSettings] = useState<Partial<AppSettings> | null>(null);
  const [tier, setTier] = useState<EngagementTier | null>(null);
  const [enabledTags, setEnabledTags] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, s, t, tags] = await Promise.all([
          storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE),
          storageGet<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS),
          storageGet<EngagementTier>(STORAGE_KEYS.TIER),
          storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED),
        ]);
        setProfile(p);
        setSettings(s);
        setTier(t);
        setEnabledTags(tags);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveProfile = useCallback(async (update: Partial<UserProfile>) => {
    const merged = { ...profile, ...update };
    await storageSet(STORAGE_KEYS.PROFILE, merged);
    setProfile(merged);
  }, [profile]);

  const saveConsent = useCallback(async (record: ConsentRecord) => {
    await storageSet(STORAGE_KEYS.SETTINGS, {
      ...settings,
      consent_date: record.consent_date,
      consent_version: record.consent_version,
    });
    setConsent(record);
    setSettings((prev) => ({
      ...prev,
      consent_date: record.consent_date,
      consent_version: record.consent_version,
    }));
  }, [settings]);

  const saveSettings = useCallback(async (update: Partial<AppSettings>) => {
    const merged = { ...settings, ...update };
    await storageSet(STORAGE_KEYS.SETTINGS, merged);
    setSettings(merged);
  }, [settings]);

  const saveTier = useCallback(async (newTier: EngagementTier) => {
    await storageSet(STORAGE_KEYS.TIER, newTier);
    setTier(newTier);
  }, []);

  const saveEnabledTags = useCallback(async (tags: string[]) => {
    await storageSet(STORAGE_KEYS.TAGS_ENABLED, tags);
    setEnabledTags(tags);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await Promise.all([
      storageSet(STORAGE_KEYS.ONBOARDING_COMPLETE, true),
      storageSet(STORAGE_KEYS.ONBOARDING_DATE, new Date().toISOString()),
    ]);
  }, []);

  return {
    profile,
    consent,
    settings,
    tier,
    enabledTags,
    loading,
    saveProfile,
    saveConsent,
    saveSettings,
    saveTier,
    saveEnabledTags,
    completeOnboarding,
  };
}
