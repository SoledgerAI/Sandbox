// Mood trend hook — runs detector on dashboard load, manages 48h dismiss
// Wave 2 P1: Automated mood-trend detection
//
// SAFETY: Dismiss state is ephemeral (AsyncStorage only, not in exportable data).
// After 48 hours, the detector re-evaluates. If triggers still fire, card reappears.

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import { evaluateMoodTrend } from '../utils/mood_trend';
import type { MoodTrendResult } from '../utils/mood_trend';
import type { UserProfile } from '../types/profile';

const DISMISS_KEY = STORAGE_KEYS.MOOD_RESOURCE_DISMISSED;
const DISMISS_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

interface UseMoodTrendReturn {
  /** Whether to show the resource card */
  showCard: boolean;
  /** Whether to show the Veterans Crisis Line */
  showVeteransLine: boolean;
  /** Trigger types (for Coach context) */
  triggers: MoodTrendResult['triggers'];
  /** Dismiss for 48 hours */
  dismiss: () => void;
}

export function useMoodTrend(): UseMoodTrendReturn {
  const [trendResult, setTrendResult] = useState<MoodTrendResult>({ triggered: false, triggers: [] });
  const [dismissed, setDismissed] = useState(true); // default hidden until evaluated
  const [showVeteransLine, setShowVeteransLine] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Check dismiss state
      const dismissedAt = await storageGet<string>(DISMISS_KEY);
      if (dismissedAt) {
        const elapsed = Date.now() - new Date(dismissedAt).getTime();
        if (elapsed < DISMISS_DURATION_MS) {
          // Still within 48h dismiss window
          if (mounted) setDismissed(true);
          return;
        }
      }

      // Run mood trend detection
      const result = await evaluateMoodTrend();
      if (!mounted) return;

      setTrendResult(result);
      setDismissed(!result.triggered);

      // Check profile for veteran/recovery indicators
      const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
      if (mounted && profile?.main_goal === 'support_recovery') {
        setShowVeteransLine(true);
      }
    })();

    return () => { mounted = false; };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    storageSet(DISMISS_KEY, new Date().toISOString());
  }, []);

  return {
    showCard: trendResult.triggered && !dismissed,
    showVeteransLine,
    triggers: trendResult.triggers,
    dismiss,
  };
}
