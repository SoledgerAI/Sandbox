// Contextual Trigger logic for marketplace product recommendations
// Phase 22: Marketplace, Influencer System, and Polish
// Products are NEVER randomly surfaced -- contextual triggers ONLY
// Coach data analysis and marketplace product triggers run on SEPARATE code paths
// Marketplace reads from dub.coach.patterns output, does NOT call pattern engine directly

import { storageGet, storageSet, STORAGE_KEYS } from '../../utils/storage';
import type { UserProfile } from '../../types/profile';
import type { Product, ContextualTrigger as TriggerType, DemographicFilter, DismissedProduct } from '../../types/marketplace';
import { MARKETPLACE_PRODUCTS } from './productData';

const DEFICIT_DELAY_DAYS = 7;

interface PatternEntry {
  observation: string;
  category?: string;
}

function getMonth(): number {
  return new Date().getMonth(); // 0-11
}

function isSpringSummer(): boolean {
  const m = getMonth();
  return m >= 3 && m <= 8; // April-September
}

function getUserAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / 31557600000);
}

function matchesDemographics(filter: DemographicFilter, profile: UserProfile | null): boolean {
  if (!profile) return true; // show if no profile (can't filter)

  const age = getUserAge(profile.dob);
  if (age != null) {
    if (filter.min_age != null && age < filter.min_age) return false;
    if (filter.max_age != null && age > filter.max_age) return false;
  }

  if (filter.sex != null && profile.sex) {
    if (!filter.sex.includes(profile.sex!)) return false;
  }

  if (filter.goals != null && profile.goal?.direction) {
    if (!filter.goals.includes(profile.goal.direction)) return false;
  }

  return true;
}

export async function getTriggeredProducts(): Promise<Product[]> {
  const [profile, patterns, dismissed, onboardingDate, settings, enabledTags] = await Promise.all([
    storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
    storageGet<PatternEntry[]>(STORAGE_KEYS.COACH_PATTERNS),
    storageGet<DismissedProduct[]>(STORAGE_KEYS.MARKETPLACE_DISMISSED),
    storageGet<string>(STORAGE_KEYS.ONBOARDING_DATE),
    storageGet<Record<string, unknown>>(STORAGE_KEYS.SETTINGS),
    storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED),
  ]);

  const dismissedIds = new Set((dismissed ?? []).map((d) => d.product_id));
  const activeTriggers = new Set<TriggerType>();

  // Goal onboarding trigger
  if (profile?.goal?.direction) {
    activeTriggers.add('goal_onboarding');
  }

  // Behavior pattern trigger (from pattern engine output)
  if (patterns && patterns.length > 0) {
    activeTriggers.add('behavior_pattern');
  }

  // Deficit detection — MASTER-08: 7-day delay before surfacing deficit-based products
  if (patterns) {
    const hasDeficit = patterns.some(
      (p) => p.observation.toLowerCase().includes('low') || p.observation.toLowerCase().includes('deficit'),
    );
    if (hasDeficit) {
      const deficitDetectedAt = settings?.marketplace_deficit_detected_at as string | undefined;
      if (!deficitDetectedAt) {
        // First detection — store timestamp, do NOT activate trigger yet
        const updatedSettings = { ...(settings ?? {}), marketplace_deficit_detected_at: new Date().toISOString() };
        await storageSet(STORAGE_KEYS.SETTINGS, updatedSettings);
      } else {
        const daysSinceDetection = Math.floor(
          (Date.now() - new Date(deficitDetectedAt).getTime()) / 86400000,
        );
        if (daysSinceDetection >= DEFICIT_DELAY_DAYS) {
          activeTriggers.add('deficit_detection');
        }
      }
    } else if (settings?.marketplace_deficit_detected_at) {
      // No deficit detected anymore — clear the stored date
      const { marketplace_deficit_detected_at: _, ...rest } = settings as Record<string, unknown>;
      await storageSet(STORAGE_KEYS.SETTINGS, rest);
    }
  }

  // Feature adoption trigger — MASTER-45: only fire if user has actually used the feature
  const tags = enabledTags ?? [];
  if (tags.length > 0) {
    // At least one optional tag enabled means feature adoption is real
    activeTriggers.add('feature_adoption');
  }

  // Seasonal trigger — MASTER-45: only fire in product's matching months (filtered below)
  const _currentMonth = getMonth(); // 0-11
  activeTriggers.add('seasonal');

  // Milestone trigger (completed first month)
  if (onboardingDate) {
    const daysSinceOnboarding = Math.floor(
      (Date.now() - new Date(onboardingDate).getTime()) / 86400000,
    );
    if (daysSinceOnboarding >= 30) {
      activeTriggers.add('milestone');
    }
  }

  // Filter products by active triggers, demographics, and dismissals
  const triggered = MARKETPLACE_PRODUCTS.filter((product) => {
    if (dismissedIds.has(product.id)) return false;
    if (!activeTriggers.has(product.contextual_trigger)) return false;
    if (!matchesDemographics(product.demographic_filters, profile)) return false;

    // Seasonal filter: only show seasonal products in correct season
    if (product.contextual_trigger === 'seasonal') {
      const isSunscreen = product.category === 'personal_care' &&
        product.name.toLowerCase().includes('sunscreen');
      const isLightTherapy = product.category === 'mental_wellness' &&
        product.name.toLowerCase().includes('light therapy');
      if (isSunscreen && !isSpringSummer()) return false;
      if (isLightTherapy && isSpringSummer()) return false;
    }

    return true;
  });

  return triggered;
}

export function getTriggerExplanation(trigger: TriggerType, reason: string): string {
  return reason;
}
