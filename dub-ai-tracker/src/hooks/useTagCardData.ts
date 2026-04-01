// Load 7-day tag card data for Dashboard
// MASTER-53: Populate tag cards with real data instead of empty shells
// MASTER-56: Only load data for visible tags (called per-card)

import { useState, useEffect } from 'react';
import { storageGet, storageGetMultiple, STORAGE_KEYS, dateKey } from '../utils/storage';
import type { FoodEntry, WaterEntry, CaffeineEntry } from '../types';
import type { WorkoutEntry } from '../types/workout';

export interface TagCardData {
  loading: boolean;
  todaySummary: string | null;
  sparkData: number[];
  hasDataToday: boolean;
}

// Map tag IDs to their storage key and value extractor
const TAG_CONFIG: Record<string, {
  storageKey: string;
  extractValue: (data: unknown) => number;
  formatToday: (data: unknown) => string;
}> = {
  'nutrition.food': {
    storageKey: STORAGE_KEYS.LOG_FOOD,
    extractValue: (data) => {
      const entries = data as FoodEntry[] | null;
      return entries?.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0) ?? 0;
    },
    formatToday: (data) => {
      const entries = data as FoodEntry[] | null;
      const cal = entries?.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0) ?? 0;
      return `${Math.round(cal).toLocaleString()} cal`;
    },
  },
  'hydration.water': {
    storageKey: STORAGE_KEYS.LOG_WATER,
    extractValue: (data) => {
      const entries = data as WaterEntry[] | null;
      return entries?.reduce((s, w) => s + w.amount_oz, 0) ?? 0;
    },
    formatToday: (data) => {
      const entries = data as WaterEntry[] | null;
      const oz = entries?.reduce((s, w) => s + w.amount_oz, 0) ?? 0;
      return `${oz} oz`;
    },
  },
  'fitness.workout': {
    storageKey: STORAGE_KEYS.LOG_WORKOUT,
    extractValue: (data) => {
      const entries = data as WorkoutEntry[] | null;
      return entries?.reduce((s, w) => s + (w.duration_minutes ?? 0), 0) ?? 0;
    },
    formatToday: (data) => {
      const entries = data as WorkoutEntry[] | null;
      const mins = entries?.reduce((s, w) => s + (w.duration_minutes ?? 0), 0) ?? 0;
      return `${mins} min`;
    },
  },
  'supplements.daily': {
    storageKey: STORAGE_KEYS.LOG_SUPPLEMENTS,
    extractValue: (data) => {
      const entries = data as { taken: boolean }[] | null;
      return entries?.filter((e) => e.taken).length ?? 0;
    },
    formatToday: (data) => {
      const entries = data as { taken: boolean }[] | null;
      const count = entries?.filter((e) => e.taken).length ?? 0;
      return `${count} taken`;
    },
  },
  'sleep.tracking': {
    storageKey: STORAGE_KEYS.LOG_SLEEP,
    extractValue: (data) => {
      const entry = data as { bedtime?: string; wake_time?: string } | null;
      if (!entry?.bedtime || !entry?.wake_time) return 0;
      const h = (new Date(entry.wake_time).getTime() - new Date(entry.bedtime).getTime()) / 3600000;
      return h > 0 && h < 24 ? h : 0;
    },
    formatToday: (data) => {
      const entry = data as { bedtime?: string; wake_time?: string } | null;
      if (!entry?.bedtime || !entry?.wake_time) return '';
      const h = (new Date(entry.wake_time).getTime() - new Date(entry.bedtime).getTime()) / 3600000;
      return h > 0 ? `${h.toFixed(1)} hrs` : '';
    },
  },
  'mental.wellness': {
    storageKey: STORAGE_KEYS.LOG_MOOD,
    extractValue: (data) => {
      const entries = data as { score: number }[] | null;
      if (!entries || entries.length === 0) return 0;
      return entries.reduce((s, m) => s + m.score, 0) / entries.length;
    },
    formatToday: (data) => {
      const entries = data as { score: number }[] | null;
      if (!entries || entries.length === 0) return '';
      const avg = entries.reduce((s, m) => s + m.score, 0) / entries.length;
      const labels = ['', 'Bad', 'Poor', 'OK', 'Good', 'Great'];
      return labels[Math.round(avg)] ?? `${avg.toFixed(1)}/5`;
    },
  },
  'body.measurements': {
    storageKey: STORAGE_KEYS.LOG_BODY,
    extractValue: (data) => {
      const entry = data as { weight_lbs?: number } | null;
      return entry?.weight_lbs ?? 0;
    },
    formatToday: (data) => {
      const entry = data as { weight_lbs?: number } | null;
      return entry?.weight_lbs ? `${entry.weight_lbs} lbs` : '';
    },
  },
  'substances.tracking': {
    storageKey: STORAGE_KEYS.LOG_SUBSTANCES,
    extractValue: (data) => {
      const entries = data as unknown[] | null;
      return entries?.length ?? 0;
    },
    formatToday: (data) => {
      const entries = data as unknown[] | null;
      const count = entries?.length ?? 0;
      return count > 0 ? `${count} logged` : '';
    },
  },
};

function pastDateStrings(count: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return dates;
}

export function useTagCardData(tagId: string): TagCardData {
  const [state, setState] = useState<TagCardData>({
    loading: true,
    todaySummary: null,
    sparkData: [],
    hasDataToday: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const config = TAG_CONFIG[tagId];
      if (!config) {
        setState({ loading: false, todaySummary: null, sparkData: [], hasDataToday: false });
        return;
      }

      const dates = pastDateStrings(7);
      const keys = dates.map((d) => dateKey(config.storageKey, d));

      // Batch read all 7 days in one multiGet call
      const results = await storageGetMultiple(keys);

      const sparkData: number[] = [];
      let todaySummary: string | null = null;
      let hasDataToday = false;

      // Iterate oldest-first for sparkline ordering
      for (let i = dates.length - 1; i >= 0; i--) {
        const key = keys[i];
        const data = results.get(key);
        const value = config.extractValue(data);
        sparkData.push(value);

        if (i === 0) {
          // Today
          hasDataToday = value > 0;
          const formatted = config.formatToday(data);
          todaySummary = formatted || null;
        }
      }

      if (!cancelled) {
        setState({ loading: false, todaySummary, sparkData, hasDataToday });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tagId]);

  return state;
}
