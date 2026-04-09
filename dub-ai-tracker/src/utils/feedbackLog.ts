// Feedback Log — Sprint 12 Feature 6
// @dub exclusive: structured feedback from users via Coach chat.
// Stored in AsyncStorage, exportable as CSV.

import { storageGet, storageSet, STORAGE_KEYS } from './storage';
import type { FeedbackEntry } from '../types/coach';

function generateId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function logFeedback(params: {
  type: FeedbackEntry['type'];
  description: string;
  screen: string;
  userMessage: string;
}): Promise<FeedbackEntry> {
  const entry: FeedbackEntry = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: params.type,
    description: params.description,
    screen: params.screen,
    userMessage: params.userMessage,
    resolved: false,
  };

  const existing = (await storageGet<FeedbackEntry[]>(STORAGE_KEYS.FEEDBACK_LOG)) ?? [];
  existing.push(entry);
  await storageSet(STORAGE_KEYS.FEEDBACK_LOG, existing);

  return entry;
}

export async function getFeedbackLog(): Promise<FeedbackEntry[]> {
  return (await storageGet<FeedbackEntry[]>(STORAGE_KEYS.FEEDBACK_LOG)) ?? [];
}

export async function exportFeedbackLog(): Promise<string> {
  const entries = await getFeedbackLog();
  const header = 'id,timestamp,type,description,screen,userMessage,resolved';
  const rows = entries.map((e) => {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      e.id,
      e.timestamp,
      e.type,
      escape(e.description),
      escape(e.screen),
      escape(e.userMessage),
      String(e.resolved),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
