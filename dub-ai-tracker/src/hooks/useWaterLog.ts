import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/theme';
import { getTodayKey } from '../utils/date';
import type { WaterEntry, DailyLog } from '../types';

const WATER_GOAL = 100; // oz

function getStorageKey(date: string): string {
  return `${STORAGE_KEYS.logs}/${date}`;
}

export function useWaterLog() {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const todayKey = getTodayKey();

  const loadEntries = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(getStorageKey(todayKey));
      if (raw) {
        const log: DailyLog = JSON.parse(raw);
        setEntries(log.water || []);
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.error('Failed to load water log:', e);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const saveEntries = useCallback(async (newEntries: WaterEntry[]) => {
    const log: DailyLog = { date: todayKey, water: newEntries };
    await AsyncStorage.setItem(getStorageKey(todayKey), JSON.stringify(log));
  }, [todayKey]);

  const addWater = useCallback(async (amount: number) => {
    const entry: WaterEntry = {
      id: Date.now().toString(),
      amount,
      timestamp: new Date().toISOString(),
    };
    const newEntries = [...entries, entry];
    setEntries(newEntries);
    await saveEntries(newEntries);
  }, [entries, saveEntries]);

  const undoLast = useCallback(async () => {
    if (entries.length === 0) return;
    const newEntries = entries.slice(0, -1);
    setEntries(newEntries);
    await saveEntries(newEntries);
  }, [entries, saveEntries]);

  const totalOz = entries.reduce((sum, e) => sum + e.amount, 0);
  const progress = Math.min(totalOz / WATER_GOAL, 1);

  return {
    entries,
    totalOz,
    goal: WATER_GOAL,
    progress,
    loading,
    addWater,
    undoLast,
  };
}
