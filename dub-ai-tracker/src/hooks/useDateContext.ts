// React hook for dateContextService — Prompt 14
// Subscribes to date context changes so components re-render
// when the active date is switched.

import { useState, useEffect, useCallback } from 'react';
import {
  getActiveDate,
  setActiveDate,
  resetToToday,
  isBackfilling,
  addDateChangeListener,
} from '../services/dateContextService';

export function useDateContext() {
  const [date, setDate] = useState(getActiveDate);
  const [backfilling, setBackfilling] = useState(isBackfilling);

  useEffect(() => {
    const unsubscribe = addDateChangeListener((newDate) => {
      setDate(newDate);
      setBackfilling(isBackfilling());
    });
    return unsubscribe;
  }, []);

  const switchDate = useCallback((newDate: string) => {
    setActiveDate(newDate);
  }, []);

  const reset = useCallback(() => {
    resetToToday();
  }, []);

  return {
    activeDate: date,
    isBackfilling: backfilling,
    setActiveDate: switchDate,
    resetToToday: reset,
  };
}
