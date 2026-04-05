// Last-entry persistence hook -- save and load last entry per tag for repeat-last functionality
// Wave 2 P1: Repeat Last Entry (Global)

import { useEffect, useState, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

function lastEntryKey(tagId: string): string {
  return `${STORAGE_KEYS.LAST_ENTRY}.${tagId}`;
}

export function useLastEntry<T>(tagId: string) {
  const [lastEntry, setLastEntry] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    storageGet<T>(lastEntryKey(tagId)).then((data) => {
      if (mounted) {
        setLastEntry(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [tagId]);

  const saveAsLast = useCallback(
    async (entry: T) => {
      await storageSet(lastEntryKey(tagId), entry);
      setLastEntry(entry);
    },
    [tagId],
  );

  return { lastEntry, loading, saveAsLast };
}
