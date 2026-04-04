// Deferred setup card state management
// P1-08: Express onboarding — deferred setup prompts on Dashboard Days 1-4
// Each prompt: [Set Up] or [Not Now], retry next day, max 3 dismissals

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

export interface DeferredItem {
  shown_count: number;
  completed: boolean;
  dismissed_date: string | null;
}

export interface DeferredSetupState {
  onboarding_date: string; // ISO date (YYYY-MM-DD)
  tag_selection: DeferredItem;
  calorie_target: DeferredItem;
  device_connect: DeferredItem;
  reminders: DeferredItem;
}

export type DeferredSetupKey = 'tag_selection' | 'calorie_target' | 'device_connect' | 'reminders';

const DEFERRED_ITEMS: { key: DeferredSetupKey; day: number; title: string; description: string; icon: string; route: string }[] = [
  { key: 'tag_selection', day: 0, title: 'Choose what you track', description: 'Pick the health categories that matter to you.', icon: 'grid-outline', route: '/settings/tags' },
  { key: 'calorie_target', day: 1, title: 'Set a calorie target?', description: 'Add your weight goal and activity level for accurate targets.', icon: 'flame-outline', route: '/settings/profile' },
  { key: 'device_connect', day: 2, title: 'Connect a device?', description: 'Sync data from Apple Health or Google Health Connect.', icon: 'watch-outline', route: '/settings/devices' },
  { key: 'reminders', day: 3, title: 'Set up reminders?', description: 'Get gentle nudges to log your meals and workouts.', icon: 'notifications-outline', route: '/settings/notifications' },
];

const MAX_DISMISSALS = 3;

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / 86400000);
}

function makeDefaultState(): DeferredSetupState {
  const defaultItem: DeferredItem = { shown_count: 0, completed: false, dismissed_date: null };
  return {
    onboarding_date: todayDateString(),
    tag_selection: { ...defaultItem },
    calorie_target: { ...defaultItem },
    device_connect: { ...defaultItem },
    reminders: { ...defaultItem },
  };
}

export function useDeferredSetup() {
  const [state, setState] = useState<DeferredSetupState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storageGet<DeferredSetupState>(STORAGE_KEYS.DEFERRED_SETUP).then((stored) => {
      setState(stored);
      setLoading(false);
    });
  }, []);

  const initDeferred = useCallback(async () => {
    const newState = makeDefaultState();
    await storageSet(STORAGE_KEYS.DEFERRED_SETUP, newState);
    setState(newState);
  }, []);

  const dismissItem = useCallback(async (key: DeferredSetupKey) => {
    if (!state) return;
    const updated = {
      ...state,
      [key]: {
        ...state[key],
        shown_count: state[key].shown_count + 1,
        dismissed_date: todayDateString(),
      },
    };
    await storageSet(STORAGE_KEYS.DEFERRED_SETUP, updated);
    setState(updated);
  }, [state]);

  const completeItem = useCallback(async (key: DeferredSetupKey) => {
    if (!state) return;
    const updated = {
      ...state,
      [key]: { ...state[key], completed: true },
    };
    await storageSet(STORAGE_KEYS.DEFERRED_SETUP, updated);
    setState(updated);
  }, [state]);

  // Determine which card to show (at most one at a time)
  let activeCard: typeof DEFERRED_ITEMS[number] | null = null;
  if (state) {
    const elapsed = daysSince(state.onboarding_date);
    const today = todayDateString();

    for (const item of DEFERRED_ITEMS) {
      const itemState = state[item.key];
      if (itemState.completed) continue;
      if (itemState.shown_count >= MAX_DISMISSALS) continue;
      if (elapsed < item.day) continue;
      // Don't show same card twice in one day
      if (itemState.dismissed_date === today) continue;
      activeCard = item;
      break;
    }
  }

  return {
    loading,
    state,
    activeCard,
    initDeferred,
    dismissItem,
    completeItem,
  };
}
