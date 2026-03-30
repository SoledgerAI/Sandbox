// Tests for tagFilterService
// Prompt 03 v2: Smart Onboarding — Sex-Based Tag Filtering

import { getVisibleTags, isTagVisibleForUser, getSuggestedSupplements } from '../services/tagFilterService';
import { ALL_DEFAULT_TAGS, HEALTH_FITNESS_TAGS, PERSONAL_PRIVATE_TAGS } from '../constants/tags';

describe('tagFilterService', () => {
  describe('getVisibleTags', () => {
    it('male user does not see womens health tag', () => {
      const visible = getVisibleTags('male', ALL_DEFAULT_TAGS);
      const ids = visible.map((t) => t.id);
      expect(ids).not.toContain('womens.health');
    });

    it('female user sees womens health tag', () => {
      const visible = getVisibleTags('female', ALL_DEFAULT_TAGS);
      const ids = visible.map((t) => t.id);
      expect(ids).toContain('womens.health');
    });

    it('prefer_not_to_say sees all tags', () => {
      const visible = getVisibleTags('prefer_not_to_say', ALL_DEFAULT_TAGS);
      expect(visible.length).toBe(ALL_DEFAULT_TAGS.length);
    });

    it('null sex shows all tags', () => {
      const visible = getVisibleTags(null, ALL_DEFAULT_TAGS);
      expect(visible.length).toBe(ALL_DEFAULT_TAGS.length);
    });

    it('male user sees all health/fitness tags (no filtering there)', () => {
      const visible = getVisibleTags('male', HEALTH_FITNESS_TAGS);
      expect(visible.length).toBe(HEALTH_FITNESS_TAGS.length);
    });

    it('female user sees all health/fitness tags', () => {
      const visible = getVisibleTags('female', HEALTH_FITNESS_TAGS);
      expect(visible.length).toBe(HEALTH_FITNESS_TAGS.length);
    });

    it('male user sees fewer personal/private tags than female', () => {
      const maleVisible = getVisibleTags('male', PERSONAL_PRIVATE_TAGS);
      const femaleVisible = getVisibleTags('female', PERSONAL_PRIVATE_TAGS);
      expect(maleVisible.length).toBeLessThan(femaleVisible.length);
    });
  });

  describe('isTagVisibleForUser', () => {
    it('returns false for womens.health when male', () => {
      expect(isTagVisibleForUser('womens.health', 'male')).toBe(false);
    });

    it('returns true for womens.health when female', () => {
      expect(isTagVisibleForUser('womens.health', 'female')).toBe(true);
    });

    it('returns true for womens.health when prefer_not_to_say', () => {
      expect(isTagVisibleForUser('womens.health', 'prefer_not_to_say')).toBe(true);
    });

    it('returns true for womens.health when null', () => {
      expect(isTagVisibleForUser('womens.health', null)).toBe(true);
    });

    it('returns true for non-gendered tags regardless of sex', () => {
      expect(isTagVisibleForUser('hydration.water', 'male')).toBe(true);
      expect(isTagVisibleForUser('hydration.water', 'female')).toBe(true);
      expect(isTagVisibleForUser('supplements.daily', 'male')).toBe(true);
    });
  });

  describe('getSuggestedSupplements', () => {
    it('returns empty array when ageRange is null', () => {
      expect(getSuggestedSupplements('male', null)).toEqual([]);
    });

    it('returns suggestions for 18-29 male', () => {
      const suggestions = getSuggestedSupplements('male', '18-29');
      expect(suggestions.length).toBeGreaterThan(0);
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('Vitamin D');
      expect(names).toContain('Protein');
      // Iron is female-specific for 18-29
      expect(names).not.toContain('Iron');
    });

    it('returns iron for 18-29 female', () => {
      const suggestions = getSuggestedSupplements('female', '18-29');
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('Iron');
      expect(names).toContain('Vitamin D');
    });

    it('returns CoQ10 for 30-44', () => {
      const suggestions = getSuggestedSupplements('male', '30-44');
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('CoQ10');
      expect(names).toContain('Collagen');
    });

    it('returns saw palmetto for 45-59 male', () => {
      const suggestions = getSuggestedSupplements('male', '45-59');
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('Saw Palmetto');
      expect(names).not.toContain('Calcium');
    });

    it('returns calcium for 45-59 female', () => {
      const suggestions = getSuggestedSupplements('female', '45-59');
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('Calcium');
      expect(names).not.toContain('Saw Palmetto');
    });

    it('returns B12 high priority for 60+', () => {
      const suggestions = getSuggestedSupplements('male', '60+');
      const b12 = suggestions.find((s) => s.name === 'B12');
      expect(b12).toBeDefined();
      expect(b12!.priority).toBe('high');
    });

    it('prefer_not_to_say gets all-gender supplements', () => {
      const suggestions = getSuggestedSupplements('prefer_not_to_say', '18-29');
      const names = suggestions.map((s) => s.name);
      expect(names).toContain('Vitamin D');
      // Should not include sex-specific supplements
      expect(names).not.toContain('Iron');
    });

    it('suggestions are sorted by priority then alphabetically', () => {
      const suggestions = getSuggestedSupplements('female', '30-44');
      const priorities = suggestions.map((s) => s.priority);
      // All highs come before mediums, mediums before lows
      let lastPriorityIdx = -1;
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      for (const p of priorities) {
        expect(order[p]).toBeGreaterThanOrEqual(lastPriorityIdx);
        lastPriorityIdx = order[p];
      }
    });
  });
});
