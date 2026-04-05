// Offline queue manager (MASTER-62)
// FIFO processing with retry logic and automatic reconnect handling.

import { storageGet, storageSet } from './storage';
import { STORAGE_KEYS } from './storage';
import { textSearchWaterfall } from './foodwaterfall';
import { offBarcodeLookup } from '../services/openfoodfacts';
import { sendMessage } from '../services/anthropic';
import type { AnthropicMessage } from '../services/anthropic';
import type { EngagementTier } from '../types/profile';

export interface QueueItem {
  id: string;
  type: 'food_search' | 'coach_message' | 'barcode_lookup' | 'weather';
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
 * Returns true on success (remove from queue), false on failure (retry).
 */
async function processItem(item: QueueItem): Promise<boolean> {
  switch (item.type) {
    case 'food_search': {
      const { query } = item.payload as { query: string };
      try {
        const result = await textSearchWaterfall(query);
        await storageSet(
          `${STORAGE_KEYS.FOOD_SEARCH_CACHE}_${query}`,
          JSON.stringify(result),
        );
        return true;
      } catch {
        return false;
      }
    }
    case 'coach_message': {
      const { message, context, tier } = item.payload as {
        message: string;
        context: { systemPrompt: string; messages: AnthropicMessage[] };
        tier: EngagementTier;
      };
      try {
        const response = await sendMessage({
          systemPrompt: context.systemPrompt,
          messages: [...context.messages, { role: 'user', content: message }],
          tier,
        });
        // Append assistant response to coach history
        const history = (await storageGet<Array<{ role: string; content: string }>>(
          STORAGE_KEYS.COACH_HISTORY,
        )) ?? [];
        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: response });
        await storageSet(STORAGE_KEYS.COACH_HISTORY, history);
        return true;
      } catch {
        return false;
      }
    }
    case 'barcode_lookup': {
      const { barcode } = item.payload as { barcode: string };
      try {
        const result = await offBarcodeLookup(barcode);
        if (result) {
          await storageSet(
            `${STORAGE_KEYS.BARCODE_CACHE}_${barcode}`,
            JSON.stringify({ data: result, _cachedAt: Date.now() }),
          );
        }
        return true;
      } catch {
        return false;
      }
    }
    case 'weather':
      // Weather retries are low-priority; remove stale weather requests
      return true;
    default: {
      console.warn(`[Offline] Unknown queue item type: ${(item as QueueItem).type}`);
      return true;
    }
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
  const success = await processItem(item);
  if (success) {
    queue.shift();
    await storageSet(STORAGE_KEYS.OFFLINE_QUEUE, queue);

    // Continue processing remaining items recursively
    if (queue.length > 0) {
      await processQueue();
    }
  } else {
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
