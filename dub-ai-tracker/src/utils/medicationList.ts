// Sprint 23: Medication list management utility
// Users define their medication list once; daily log pre-populates from it

import { storageGet, storageSet, STORAGE_KEYS } from './storage';
import type { MedicationDefinition } from '../types';

/**
 * Get the user's saved medication list.
 */
export async function getMedicationList(): Promise<MedicationDefinition[]> {
  const list = await storageGet<MedicationDefinition[]>(STORAGE_KEYS.SETTINGS_MEDICATION_LIST);
  return list ?? [];
}

/**
 * Save the user's medication list.
 */
export async function saveMedicationList(list: MedicationDefinition[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_MEDICATION_LIST, list);
}

/**
 * Add a medication to the list.
 */
export async function addMedication(medication: MedicationDefinition): Promise<void> {
  const list = await getMedicationList();
  list.push(medication);
  await saveMedicationList(list);
}

/**
 * Update a medication in the list.
 */
export async function updateMedication(id: string, updates: Partial<MedicationDefinition>): Promise<void> {
  const list = await getMedicationList();
  const idx = list.findIndex((m) => m.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    await saveMedicationList(list);
  }
}

/**
 * Remove a medication from the list.
 * Note: historical daily entries referencing this medication remain untouched.
 */
export async function removeMedication(id: string): Promise<void> {
  const list = await getMedicationList();
  await saveMedicationList(list.filter((m) => m.id !== id));
}
