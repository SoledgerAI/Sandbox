// Demographic supplement suggestions
// Prompt 03 v2: Smart Onboarding — Age/Sex-Based Supplement Recommendations

import type { BiologicalSex } from '../types/profile';
import type { AgeRange } from '../services/onboardingService';

export interface SupplementSuggestion {
  name: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

interface DemographicRule {
  ageRanges: AgeRange[];
  sex: BiologicalSex[] | 'all';
  supplements: SupplementSuggestion[];
}

// Rules are evaluated in order; all matching rules contribute suggestions.
// When the same supplement appears in multiple rules, the first (higher) priority wins.
export const SUPPLEMENT_RULES: DemographicRule[] = [
  // ── 18-29 ──
  {
    ageRanges: ['18-29'],
    sex: 'all',
    supplements: [
      { name: 'Vitamin D', reason: 'Supports bone health and immune function', priority: 'high' },
      { name: 'Protein', reason: 'Supports muscle recovery and growth', priority: 'high' },
      { name: 'B12', reason: 'Supports energy and nervous system', priority: 'medium' },
      { name: 'Omega-3', reason: 'Supports heart and brain health', priority: 'medium' },
      { name: 'Magnesium', reason: 'Supports muscle and nerve function', priority: 'medium' },
    ],
  },
  {
    ageRanges: ['18-29'],
    sex: ['female'],
    supplements: [
      { name: 'Iron', reason: 'Supports healthy blood levels during menstruation', priority: 'high' },
    ],
  },

  // ── 30-44 ──
  {
    ageRanges: ['30-44'],
    sex: 'all',
    supplements: [
      { name: 'Vitamin D', reason: 'Supports bone health and immune function', priority: 'high' },
      { name: 'Omega-3', reason: 'Supports heart and brain health', priority: 'high' },
      { name: 'Magnesium', reason: 'Supports muscle and nerve function', priority: 'medium' },
      { name: 'CoQ10', reason: 'Supports cellular energy production', priority: 'medium' },
      { name: 'Collagen', reason: 'Supports skin, joint, and connective tissue health', priority: 'medium' },
      { name: 'Probiotics', reason: 'Supports gut health and digestion', priority: 'medium' },
      { name: 'Vitamin K2', reason: 'Supports calcium metabolism and heart health', priority: 'low' },
      { name: 'Glucosamine', reason: 'Supports joint health and mobility', priority: 'low' },
    ],
  },
  {
    ageRanges: ['30-44'],
    sex: ['female'],
    supplements: [
      { name: 'Iron', reason: 'Supports healthy blood levels during menstruation', priority: 'high' },
    ],
  },

  // ── 45-59 ──
  {
    ageRanges: ['45-59'],
    sex: 'all',
    supplements: [
      { name: 'Vitamin D', reason: 'Supports bone density and immune function', priority: 'high' },
      { name: 'Omega-3', reason: 'Supports cardiovascular health', priority: 'high' },
      { name: 'CoQ10', reason: 'Supports cellular energy as natural production declines', priority: 'medium' },
      { name: 'Lutein', reason: 'Supports eye health and macular protection', priority: 'medium' },
      { name: 'Fiber Supplement', reason: 'Supports digestive regularity and cholesterol', priority: 'medium' },
      { name: 'Turmeric / Curcumin', reason: 'Supports joint comfort and inflammation response', priority: 'medium' },
      { name: 'Probiotics', reason: 'Supports gut health and immune function', priority: 'low' },
    ],
  },
  {
    ageRanges: ['45-59'],
    sex: ['female'],
    supplements: [
      { name: 'Calcium', reason: 'Supports bone density during perimenopause/menopause', priority: 'high' },
    ],
  },
  {
    ageRanges: ['45-59'],
    sex: ['male'],
    supplements: [
      { name: 'Saw Palmetto', reason: 'Supports prostate health', priority: 'medium' },
    ],
  },

  // ── 60+ ──
  {
    ageRanges: ['60+'],
    sex: 'all',
    supplements: [
      { name: 'Vitamin D', reason: 'Higher doses recommended for bone and immune support', priority: 'high' },
      { name: 'B12', reason: 'Absorption decreases with age; supports nerve function', priority: 'high' },
      { name: 'Calcium', reason: 'Critical for maintaining bone density', priority: 'high' },
      { name: 'Fish Oil', reason: 'Supports heart health and cognitive function', priority: 'high' },
      { name: "Lion's Mane", reason: 'Supports memory and cognitive health', priority: 'medium' },
      { name: 'CoQ10', reason: 'Supports heart health and energy', priority: 'medium' },
      { name: 'Lutein', reason: 'Supports age-related eye health', priority: 'medium' },
      { name: 'Fiber Supplement', reason: 'Supports digestive health and cholesterol', priority: 'low' },
    ],
  },
];
