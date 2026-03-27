// Recovery score hook
// Phase 12: Recovery Score v1.0

import { useState, useEffect, useCallback } from 'react';
import { computeRecoveryScore } from '../utils/recovery';
import { storageGet, storageSet, dateKey, STORAGE_KEYS } from '../utils/storage';
import type { RecoveryScore } from '../types';

interface UseRecoveryResult {
  recovery: RecoveryScore | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to compute and cache recovery score for a given date.
 * Computes on mount and caches result to AsyncStorage.
 */
export function useRecovery(date: string): UseRecoveryResult {
  const [recovery, setRecovery] = useState<RecoveryScore | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try cache first
      const cacheKey = dateKey(STORAGE_KEYS.RECOVERY, date);
      const cached = await storageGet<RecoveryScore>(cacheKey);
      if (cached != null) {
        setRecovery(cached);
        setLoading(false);
        return;
      }

      // Compute fresh
      const score = await computeRecoveryScore(date);
      setRecovery(score);

      // Cache result
      await storageSet(cacheKey, score);
    } catch {
      setRecovery(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const refresh = useCallback(async () => {
    // Force recompute by computing fresh
    try {
      const score = await computeRecoveryScore(date);
      setRecovery(score);
      await storageSet(dateKey(STORAGE_KEYS.RECOVERY, date), score);
    } catch {
      // keep existing state
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  return { recovery, loading, refresh };
}
