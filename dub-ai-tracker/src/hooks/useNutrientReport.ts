// Sprint 22 — Daily nutrient report hook
// Returns the P&L of nutrient intake for the given date, refreshing when
// the host screen regains focus so freshly-logged entries are reflected.

import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import {
  getDailyNutrientReport,
  type DailyNutrientReport,
  type NutrientAlert,
} from '../services/nutrientAggregator';
import type { UserProfile } from '../types/profile';
import { todayDateString } from '../utils/dayBoundary';

interface UseNutrientReportResult {
  report: DailyNutrientReport | null;
  alerts: NutrientAlert[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// Default to 'female' when profile sex isn't set — female RDAs are higher for
// a few nutrients (iron, etc.), which is the safer default for deficiency
// flags and does not affect UL comparisons.
function resolveSex(profile: Partial<UserProfile> | null): 'male' | 'female' {
  return profile?.sex === 'male' ? 'male' : 'female';
}

export function useNutrientReport(date?: string): UseNutrientReportResult {
  const [report, setReport] = useState<DailyNutrientReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetDate = date ?? todayDateString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
      const sex = resolveSex(profile);
      const r = await getDailyNutrientReport(targetDate, sex);
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return {
    report,
    alerts: report?.alerts ?? [],
    loading,
    error,
    refresh: load,
  };
}
