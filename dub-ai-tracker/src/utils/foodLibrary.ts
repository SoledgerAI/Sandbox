// My Foods library — saved foods with usage tracking
// Sprint 10: Food Scanning MVP

import { storageGet, storageSet, STORAGE_KEYS } from './storage';

export interface SavedFood {
  id: string;
  createdAt: string; // ISO timestamp
  timesLogged: number;
  lastLogged: string; // ISO timestamp
  foodName: string;
  brand?: string;
  servingSize: string;
  photoUri?: string;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    addedSugar: number;
    fiber: number;
  };
}

export async function getSavedFoods(): Promise<SavedFood[]> {
  const foods = await storageGet<SavedFood[]>(STORAGE_KEYS.MY_FOODS);
  if (!foods) return [];
  // Sort by most frequently logged
  return [...foods].sort((a, b) => b.timesLogged - a.timesLogged);
}

export async function saveFood(food: SavedFood): Promise<void> {
  const existing = await storageGet<SavedFood[]>(STORAGE_KEYS.MY_FOODS) ?? [];
  // Dedupe by id
  const filtered = existing.filter((f) => f.id !== food.id);
  await storageSet(STORAGE_KEYS.MY_FOODS, [food, ...filtered]);
}

export async function deleteSavedFood(id: string): Promise<void> {
  const existing = await storageGet<SavedFood[]>(STORAGE_KEYS.MY_FOODS) ?? [];
  await storageSet(STORAGE_KEYS.MY_FOODS, existing.filter((f) => f.id !== id));
}

export async function incrementTimesLogged(id: string): Promise<void> {
  const existing = await storageGet<SavedFood[]>(STORAGE_KEYS.MY_FOODS) ?? [];
  const updated = existing.map((f) =>
    f.id === id
      ? { ...f, timesLogged: f.timesLogged + 1, lastLogged: new Date().toISOString() }
      : f,
  );
  await storageSet(STORAGE_KEYS.MY_FOODS, updated);
}
