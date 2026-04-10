// Sprint 21: Elect-In Category System
// Manages which optional categories are enabled/disabled
// Disabling preserves data — only hides from UI and Coach context

import { storageGet, storageSet, STORAGE_KEYS } from './storage';
import type { ElectInCategoryId } from '../types';

/**
 * Get the list of currently enabled elect-in category IDs.
 * Returns empty array if nothing stored (all OFF by default).
 */
export async function getEnabledCategories(): Promise<ElectInCategoryId[]> {
  const stored = await storageGet<ElectInCategoryId[]>(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES);
  return stored ?? [];
}

/**
 * Save the full list of enabled elect-in category IDs.
 */
export async function setEnabledCategories(categories: ElectInCategoryId[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_ENABLED_CATEGORIES, categories);
}

/**
 * Check if a specific category is enabled.
 */
export async function isCategoryEnabled(categoryId: ElectInCategoryId): Promise<boolean> {
  const enabled = await getEnabledCategories();
  return enabled.includes(categoryId);
}

/**
 * Enable a single category (idempotent — won't duplicate).
 */
export async function enableCategory(categoryId: ElectInCategoryId): Promise<void> {
  const enabled = await getEnabledCategories();
  if (!enabled.includes(categoryId)) {
    await setEnabledCategories([...enabled, categoryId]);
  }
}

/**
 * Disable a single category (idempotent). Does NOT delete any data.
 */
export async function disableCategory(categoryId: ElectInCategoryId): Promise<void> {
  const enabled = await getEnabledCategories();
  await setEnabledCategories(enabled.filter((id) => id !== categoryId));
}

/**
 * Toggle a category on/off. Returns the new enabled state.
 */
export async function toggleCategory(categoryId: ElectInCategoryId): Promise<boolean> {
  const enabled = await getEnabledCategories();
  const isOn = enabled.includes(categoryId);
  if (isOn) {
    await setEnabledCategories(enabled.filter((id) => id !== categoryId));
  } else {
    await setEnabledCategories([...enabled, categoryId]);
  }
  return !isOn;
}

/**
 * Get quick access category IDs. Defaults to common categories.
 */
export async function getQuickAccessCategories(): Promise<string[]> {
  const stored = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_QUICK_ACCESS);
  return stored ?? ['food', 'water', 'workout', 'mood', 'habits'];
}

/**
 * Save quick access category IDs.
 */
export async function setQuickAccessCategories(categories: string[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_QUICK_ACCESS, categories);
}

/**
 * Get collapsed section IDs for the Log tab.
 */
export async function getCollapsedSections(): Promise<string[]> {
  const stored = await storageGet<string[]>(STORAGE_KEYS.SETTINGS_LOG_SECTIONS_COLLAPSED);
  return stored ?? [];
}

/**
 * Save collapsed section IDs for the Log tab.
 */
export async function setCollapsedSections(sections: string[]): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_LOG_SECTIONS_COLLAPSED, sections);
}

/**
 * Toggle a section's collapsed state. Returns the new collapsed state.
 */
export async function toggleSectionCollapsed(sectionId: string): Promise<boolean> {
  const collapsed = await getCollapsedSections();
  const isCollapsed = collapsed.includes(sectionId);
  if (isCollapsed) {
    await setCollapsedSections(collapsed.filter((id) => id !== sectionId));
  } else {
    await setCollapsedSections([...collapsed, sectionId]);
  }
  return !isCollapsed;
}

/**
 * Apply sex-aware defaults during onboarding.
 * Female: auto-enable cycle_tracking
 * Male / Prefer not to say: no auto-enables
 */
export async function applySexAwareDefaults(sex: string): Promise<{ autoEnabled: ElectInCategoryId[]; showPrompt: boolean }> {
  if (sex === 'female') {
    await enableCategory('cycle_tracking');
    return { autoEnabled: ['cycle_tracking'], showPrompt: true };
  }
  return { autoEnabled: [], showPrompt: false };
}
