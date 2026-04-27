// S29-C: React hook that re-runs a callback whenever any of the
// supplied storage keys change. Used by the dashboard so that a write
// from Coach DUB tool-use (or any other surface) immediately surfaces
// without forcing the user to navigate away and back.

import { useEffect, useRef } from 'react';
import { storageSubscribe } from '../utils/storage';

interface WatcherOptions {
  /** When true, also notify on writes to dated children of each key
   *  (e.g. dub.log.body.2026-04-27 when watching dub.log.body). */
  prefix?: boolean;
}

export function useStorageWatcher(
  keys: readonly string[],
  onChange: () => void,
  options: WatcherOptions = {},
): void {
  // Stash the latest callback in a ref so listeners stay stable for the
  // life of the subscription — re-subscribing on every render would
  // thrash the listener set.
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; }, [onChange]);

  // Stable signature: re-subscribe only when the actual key list changes.
  const signature = keys.join('|');

  useEffect(() => {
    const unsubs = keys.map((k) =>
      storageSubscribe(k, () => cbRef.current(), { prefix: options.prefix }),
    );
    return () => { for (const u of unsubs) u(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, options.prefix]);
}
