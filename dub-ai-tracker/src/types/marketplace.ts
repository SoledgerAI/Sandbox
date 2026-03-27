// Marketplace types for DUB_AI Tracker
// Phase 2: Type System and Storage Layer
// Per Section 12: Product Marketplace and Influencer Marketplace

export type ProductCategory =
  | 'body_composition'
  | 'nutrition_tools'
  | 'supplements'
  | 'hydration'
  | 'strength_equipment'
  | 'cardio_equipment'
  | 'wearables'
  | 'recovery'
  | 'sleep'
  | 'personal_care'
  | 'kitchen'
  | 'mental_wellness'
  | 'food_delivery'
  | 'apparel'
  | 'books'
  | 'outdoor';

export type ContextualTrigger =
  | 'goal_onboarding'
  | 'behavior_pattern'
  | 'deficit_detection'
  | 'feature_adoption'
  | 'seasonal'
  | 'milestone';

export interface Disclosure {
  type: 'affiliate' | 'influencer_brand' | 'platform_commission';
  text: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  brand: string;
  image_uri: string | null;
  affiliate_url: string;
  affiliate_partner: string; // e.g., "amazon", "target", "walmart"
  price: number | null;
  price_currency: string;
  contextual_trigger: ContextualTrigger;
  trigger_reason: string; // human-readable "Why am I seeing this?" text
  disclosures: Disclosure[];
  demographic_filters: DemographicFilter;
  created_at: string; // ISO datetime
}

export interface DemographicFilter {
  min_age: number | null;
  max_age: number | null;
  sex: Array<'male' | 'female' | 'prefer_not_to_say'> | null;
  tiers: string[] | null;
  goals: string[] | null;
}

export interface Influencer {
  id: string;
  name: string;
  partner_code: string;
  niche: string[];
  storefront_name: string;
  bio: string;
  profile_image_uri: string | null;
  commission_rate: number; // 0-1 decimal
  platform_cut_rate: number; // 0-1 decimal (15-20% at launch)
  products: InfluencerProduct[];
  approved: boolean;
  approved_date: string | null;
  violation_count: number;
}

export interface InfluencerProduct {
  product_id: string;
  product: Product;
  influencer_affiliate_code: string;
  influencer_disclosure: Disclosure;
  platform_disclosure: Disclosure;
}

export interface MarketplacePurchaseEvent {
  id: string;
  product_id: string;
  influencer_id: string | null;
  affiliate_partner: string;
  clicked_at: string; // ISO datetime
  trigger: ContextualTrigger;
}

export interface DismissedProduct {
  product_id: string;
  dismissed_at: string;
}
