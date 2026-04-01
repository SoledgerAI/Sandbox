// Offline queue manager (MASTER-62)
// FIFO processing with retry logic and automatic reconnect handling.

import { storageGet, storageSet } from './storage';
import { STORAGE_KEYS } from './storage';

export interface QueueItem {
  id: string;
  type: 'food_search' | 'coach_message' | 'weather';
  payload: unknown;
  timestamp: string; // ISO 8601
  retryCount: number;
}

const MAX_RETRIES = 3;

async function getQueue(): Promise<QueueItem[]> {
  return (await storageGet<QueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE)) ?? [];
}

/**
 * Add an item to the offline queue for later processing.
 */
export async function enqueue(
  item: Omit<QueueItem, 'id' | 'retryCount'>,
): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    retryCount: 0,
  });
  await storageSet(STORAGE_KEYS.OFFLINE_QUEUE, queue);
}

/**
 * Check if the device appears to be online.
 * Uses a lightweight HEAD request to a known endpoint.
 */
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

/**
 * Process a single queue item by type.
 * Extend the switch cases as API handlers are wired up.
 */
async function processItem(item: QueueItem): Promise<void> {
  switch (item.type) {
    case 'food_search':
      // Re-attempt food API lookup — will be wired to food search service
      break;
    case 'coach_message':
      // Re-attempt Coach API call — will be wired to anthropic service
      break;
    case 'weather':
      // Re-attempt weather API call
      break;
  }
}

/**
 * Process the offline queue in FIFO order.
 * Stops on first failure (preserves ordering guarantee).
 * Call this on network reconnect or app resume.
 */
export async function processQueue(): Promise<void> {
  const online = await isOnline();
  if (!online) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  // FIFO: process from the front
  const item = queue[0];
  try {
    await processItem(item);
    queue.shift();
    await storageSet(STORAGE_KEYS.OFFLINE_QUEUE, queue);

    // Continue processing remaining items recursively
    if (queue.length > 0) {
      await processQueue();
    }
  } catch {
    item.retryCount++;
    if (item.retryCount >= MAX_RETRIES) {
      queue.shift();
      console.warn(`[Offline] Dropped item ${item.id} after ${MAX_RETRIES} retries`);
    }
    await storageSet(STORAGE_KEYS.OFFLINE_QUEUE, queue);
  }
}

/**
 * Get current queue length (for UI badges, etc.)
 */
export async function getQueueLength(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}
