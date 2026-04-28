// S33-A: rep preset persistence — per-exercise saved schemes.
//
// Storage layout:
//   dub.strength.rep_presets.<exercise_id> = RepPreset[]
//
// Sort rule at read time: times_used desc, then created_at desc as
// tiebreaker (newer presets surface above old unused ones).

import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import type { RepPreset } from '../types';

function presetsKey(exerciseId: string): string {
  return `${STORAGE_KEYS.REP_PRESETS_PREFIX}.${exerciseId}`;
}

function genId(): string {
  return `pre_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sortPresets(list: RepPreset[]): RepPreset[] {
  return list.slice().sort((a, b) => {
    if (b.times_used !== a.times_used) return b.times_used - a.times_used;
    return b.created_at - a.created_at;
  });
}

export async function getPresetsForExercise(exerciseId: string): Promise<RepPreset[]> {
  const stored = await storageGet<RepPreset[]>(presetsKey(exerciseId));
  return sortPresets(Array.isArray(stored) ? stored : []);
}

export async function savePreset(
  exerciseId: string,
  draft: Omit<RepPreset, 'id' | 'created_at' | 'times_used'>,
): Promise<RepPreset> {
  const list = (await storageGet<RepPreset[]>(presetsKey(exerciseId))) ?? [];
  const created: RepPreset = {
    id: genId(),
    created_at: Date.now(),
    times_used: 0,
    ...draft,
  };
  await storageSet(presetsKey(exerciseId), [...list, created]);
  return created;
}

export async function updatePreset(
  exerciseId: string,
  presetId: string,
  patch: Partial<Omit<RepPreset, 'id' | 'created_at'>>,
): Promise<RepPreset | null> {
  const list = (await storageGet<RepPreset[]>(presetsKey(exerciseId))) ?? [];
  let updated: RepPreset | null = null;
  const next = list.map((p) => {
    if (p.id !== presetId) return p;
    updated = { ...p, ...patch, id: p.id, created_at: p.created_at };
    return updated;
  });
  if (updated) await storageSet(presetsKey(exerciseId), next);
  return updated;
}

export async function deletePreset(exerciseId: string, presetId: string): Promise<void> {
  const list = (await storageGet<RepPreset[]>(presetsKey(exerciseId))) ?? [];
  const next = list.filter((p) => p.id !== presetId);
  await storageSet(presetsKey(exerciseId), next);
}

/** Increment times_used for the named preset. Called when the user TAPS
 *  the chip (autofills the form), then commits the entry. NOT called on
 *  edit-then-commit — see saveSession contract in StrengthLogger. */
export async function incrementPresetUsage(
  exerciseId: string,
  presetId: string,
): Promise<RepPreset | null> {
  const list = (await storageGet<RepPreset[]>(presetsKey(exerciseId))) ?? [];
  let updated: RepPreset | null = null;
  const next = list.map((p) => {
    if (p.id !== presetId) return p;
    updated = { ...p, times_used: p.times_used + 1 };
    return updated;
  });
  if (updated) await storageSet(presetsKey(exerciseId), next);
  return updated;
}
