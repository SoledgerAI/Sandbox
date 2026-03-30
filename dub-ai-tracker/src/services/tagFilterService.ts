// Tag filtering service based on user demographics
// Prompt 03 v2: Smart Onboarding — Sex-Based Tag Filtering + Demographic Vitamins

import type { BiologicalSex } from '../types/profile';
import type { AgeRange } from './onboardingService';
import type { TagDefault } from '../constants/tags';
import {
  MALE_HIDDEN_CATEGORIES,
  MALE_HIDDEN_TAG_IDS,
  FEMALE_HIDDEN_CATEGORIES,
  FEMALE_HIDDEN_TAG_IDS,
} from '../constants/healthTags';
import {
  SUPPLEMENT_RULES,
  type SupplementSuggestion,
} from '../constants/supplementSuggestions';

/**
 * Filter the master tag list based on the user's sex.
 * "prefer_not_to_say" shows all tags (no filtering).
 */
export function getVisibleTags(sex: BiologicalSex | null, allTags: TagDefault[]): TagDefault[] {
  if (!sex || sex === 'prefer_not_to_say') return allTags;

  if (sex === 'male') {
    return allTags.filter(
      (tag) =>
        !MALE_HIDDEN_CATEGORIES.includes(tag.category) &&
        !MALE_HIDDEN_TAG_IDS.includes(tag.id),
    );
  }

  if (sex === 'female') {
    return allTags.filter(
      (tag) =>
        !FEMALE_HIDDEN_CATEGORIES.includes(tag.category) &&
        !FEMALE_HIDDEN_TAG_IDS.includes(tag.id),
    );
  }

  return allTags;
}

/**
 * Check if a specific tag should be visible for the given sex.
 */
export function isTagVisibleForUser(tagId: string, sex: BiologicalSex | null): boolean {
  if (!sex || sex === 'prefer_not_to_say') return true;

  if (sex === 'male') {
    return !MALE_HIDDEN_TAG_IDS.includes(tagId);
  }

  if (sex === 'female') {
    return !FEMALE_HIDDEN_TAG_IDS.includes(tagId);
  }

  return true;
}

/**
 * Return ranked supplement suggestions based on demographics.
 * Deduplicates by name, keeping the highest priority.
 */
export function getSuggestedSupplements(
  sex: BiologicalSex | null,
  ageRange: AgeRange | null,
): SupplementSuggestion[] {
  if (!ageRange) return [];

  const effectiveSex = sex ?? 'prefer_not_to_say';

  const matched: SupplementSuggestion[] = [];

  for (const rule of SUPPLEMENT_RULES) {
    if (!rule.ageRanges.includes(ageRange)) continue;

    const sexMatch =
      rule.sex === 'all' || rule.sex.includes(effectiveSex);
    if (!sexMatch) continue;

    matched.push(...rule.supplements);
  }

  // Deduplicate: keep highest priority per supplement name
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const seen = new Map<string, SupplementSuggestion>();

  for (const supp of matched) {
    const existing = seen.get(supp.name);
    if (!existing || priorityOrder[supp.priority] < priorityOrder[existing.priority]) {
      seen.set(supp.name, supp);
    }
  }

  const results = Array.from(seen.values());

  // Sort by priority (high first), then alphabetically
  results.sort((a, b) => {
    const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });

  return results;
}
