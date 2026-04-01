// AsyncStorage implementation of DataRepository (MASTER-12)
// Wraps existing storage.ts functions behind the DataRepository interface.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DataRepository } from './repository';
import {
  storageGet,
  storageSet,
  storageDelete,
  storageList,
  dateKey,
} from '../utils/storage';

export class AsyncStorageRepository implements DataRepository {
  async get<T>(key: string): Promise<T | null> {
    return storageGet<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    return storageSet(key, value);
  }

  async delete(key: string): Promise<void> {
    return storageDelete(key);
  }

  async list(prefix: string): Promise<string[]> {
    return storageList(prefix);
  }

  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, T | null> = {};
    for (const [key, raw] of pairs) {
      result[key] = raw != null ? (JSON.parse(raw) as T) : null;
    }
    return result;
  }

  async setMultiple<T>(entries: Record<string, T>): Promise<void> {
    const pairs: [string, string][] = Object.entries(entries).map(
      ([key, value]) => [key, JSON.stringify(value)],
    );
    await AsyncStorage.multiSet(pairs);
  }

  async getForDate<T>(prefix: string, date: string): Promise<T | null> {
    return storageGet<T>(dateKey(prefix, date));
  }

  async setForDate<T>(prefix: string, date: string, value: T): Promise<void> {
    return storageSet(dateKey(prefix, date), value);
  }

  async getDateRange<T>(
    prefix: string,
    startDate: string,
    endDate: string,
  ): Promise<Record<string, T>> {
    const keys: string[] = [];
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      dates.push(dateStr);
      keys.push(dateKey(prefix, dateStr));
      current.setDate(current.getDate() + 1);
    }

    const pairs = await AsyncStorage.multiGet(keys);
    const result: Record<string, T> = {};
    for (let i = 0; i < pairs.length; i++) {
      const [, raw] = pairs[i];
      if (raw != null) {
        result[dates[i]] = JSON.parse(raw) as T;
      }
    }
    return result;
  }
}
