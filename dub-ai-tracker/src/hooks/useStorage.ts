// React hook for typed AsyncStorage operations
// Phase 2: Type System and Storage Layer

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, storageDelete, StorageError } from '../utils/storage';

interface UseStorageResult<T> {
  data: T | null;
  loading: boolean;
  error: StorageError | null;
  setValue: (value: T) => Promise<void>;
  removeValue: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * React hook for typed AsyncStorage operations.
 * Provides get/set/delete with loading and error state.
 *
 * @param key - The AsyncStorage key
 * @param defaultValue - Optional default value if key doesn't exist
 */
export function useStorage<T>(key: string, defaultValue?: T): UseStorageResult<T> {
  const [data, setData] = useState<T | null>(defaultValue ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StorageError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const value = await storageGet<T>(key);
      setData(value ?? defaultValue ?? null);
    } catch (e) {
      if (e instanceof StorageError) {
        setError(e);
      } else {
        setError(new StorageError(
          `Unexpected error reading "${key}"`,
          key,
          'get',
          e,
        ));
      }
    } finally {
      setLoading(false);
    }
  }, [key, defaultValue]);

  useEffect(() => {
    load();
  }, [load]);

  const setValue = useCallback(async (value: T) => {
    setError(null);
    try {
      await storageSet<T>(key, value);
      setData(value);
    } catch (e) {
      if (e instanceof StorageError) {
        setError(e);
        throw e;
      }
      const storageErr = new StorageError(
        `Unexpected error writing "${key}"`,
        key,
        'set',
        e,
      );
      setError(storageErr);
      throw storageErr;
    }
  }, [key]);

  const removeValue = useCallback(async () => {
    setError(null);
    try {
      await storageDelete(key);
      setData(defaultValue ?? null);
    } catch (e) {
      if (e instanceof StorageError) {
        setError(e);
        throw e;
      }
      const storageErr = new StorageError(
        `Unexpected error deleting "${key}"`,
        key,
        'delete',
        e,
      );
      setError(storageErr);
      throw storageErr;
    }
  }, [key, defaultValue]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { data, loading, error, setValue, removeValue, refresh };
}
