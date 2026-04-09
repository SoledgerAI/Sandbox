// Expanded supplement library with timing, categories, and dosage info
// Sprint 11: Supplements overhaul

export type SupplementTiming = 'morning' | 'evening' | 'with_food' | 'empty_stomach' | 'anytime';

export interface SupplementInfo {
  name: string;
  category: 'vitamin' | 'mineral' | 'amino_acid' | 'other';
  commonDosage: string;
  timing: SupplementTiming;
  timingNote: string;
  allowMultipleDoses: boolean;
}

export const SUPPLEMENT_LIBRARY: SupplementInfo[] = [
  // ── Vitamins ──
  { name: 'Multivitamin', category: 'vitamin', commonDosage: '1 tablet', timing: 'morning', timingNote: 'Take with breakfast', allowMultipleDoses: false },
  { name: 'Vitamin A', category: 'vitamin', commonDosage: '900 mcg', timing: 'with_food', timingNote: 'Take with fatty food for absorption', allowMultipleDoses: false },
  { name: 'Vitamin B6', category: 'vitamin', commonDosage: '100 mg', timing: 'morning', timingNote: 'Take in the morning; may cause vivid dreams if taken at night', allowMultipleDoses: false },
  { name: 'Vitamin B12 (Cyanocobalamin)', category: 'vitamin', commonDosage: '1000 mcg', timing: 'morning', timingNote: 'Take in the morning for energy', allowMultipleDoses: true },
  { name: 'Vitamin B12 (Methylcobalamin)', category: 'vitamin', commonDosage: '1000 mcg', timing: 'morning', timingNote: 'Take in the morning for energy; bioactive form', allowMultipleDoses: true },
  { name: 'Vitamin C', category: 'vitamin', commonDosage: '500 mg', timing: 'anytime', timingNote: 'Can be taken any time; split doses for better absorption', allowMultipleDoses: true },
  { name: 'Vitamin D3', category: 'vitamin', commonDosage: '2000 IU', timing: 'with_food', timingNote: 'Take with fatty food for absorption', allowMultipleDoses: false },
  { name: 'Vitamin E', category: 'vitamin', commonDosage: '400 IU', timing: 'with_food', timingNote: 'Take with fatty food for absorption', allowMultipleDoses: false },
  { name: 'Vitamin K2', category: 'vitamin', commonDosage: '100 mcg', timing: 'with_food', timingNote: 'Take with D3 and fatty food; supports calcium absorption', allowMultipleDoses: false },

  // ── Minerals ──
  { name: 'Calcium', category: 'mineral', commonDosage: '500 mg', timing: 'with_food', timingNote: 'Split doses; don\'t take with iron', allowMultipleDoses: true },
  { name: 'Iron', category: 'mineral', commonDosage: '18 mg', timing: 'empty_stomach', timingNote: 'Take on empty stomach with vitamin C; avoid with calcium', allowMultipleDoses: false },
  { name: 'Magnesium (Glycinate)', category: 'mineral', commonDosage: '400 mg', timing: 'evening', timingNote: 'Take before bed; promotes relaxation and sleep', allowMultipleDoses: false },
  { name: 'Magnesium (Citrate)', category: 'mineral', commonDosage: '400 mg', timing: 'evening', timingNote: 'Take before bed; good bioavailability', allowMultipleDoses: false },
  { name: 'Magnesium (L-Threonate)', category: 'mineral', commonDosage: '2000 mg', timing: 'evening', timingNote: 'Take before bed; crosses blood-brain barrier', allowMultipleDoses: false },
  { name: 'Potassium', category: 'mineral', commonDosage: '99 mg', timing: 'with_food', timingNote: 'Take with food to reduce GI discomfort', allowMultipleDoses: true },
  { name: 'Zinc', category: 'mineral', commonDosage: '15 mg', timing: 'with_food', timingNote: 'Take with food; don\'t combine with iron or calcium', allowMultipleDoses: false },

  // ── Amino Acids ──
  { name: 'L-Lysine', category: 'amino_acid', commonDosage: '1000 mg', timing: 'empty_stomach', timingNote: 'Best absorbed on empty stomach', allowMultipleDoses: true },
  { name: 'L-Theanine', category: 'amino_acid', commonDosage: '200 mg', timing: 'anytime', timingNote: 'Can stack with caffeine for focus; calming at night', allowMultipleDoses: true },
  { name: 'L-Glutamine', category: 'amino_acid', commonDosage: '5 g', timing: 'anytime', timingNote: 'Take on empty stomach or post-workout', allowMultipleDoses: true },
  { name: 'Creatine', category: 'amino_acid', commonDosage: '5 g', timing: 'anytime', timingNote: 'Timing doesn\'t matter; consistency does', allowMultipleDoses: false },
  { name: 'BCAA', category: 'amino_acid', commonDosage: '5 g', timing: 'anytime', timingNote: 'Before or during workout', allowMultipleDoses: true },

  // ── Other ──
  { name: 'Omega-3 / Fish Oil', category: 'other', commonDosage: '1000 mg', timing: 'with_food', timingNote: 'Take with fatty meal to reduce fishy burps', allowMultipleDoses: false },
  { name: 'Probiotics', category: 'other', commonDosage: '10 billion CFU', timing: 'morning', timingNote: 'Take on empty stomach in the morning', allowMultipleDoses: false },
  { name: 'Collagen', category: 'other', commonDosage: '10 g', timing: 'anytime', timingNote: 'Mix into coffee or smoothie', allowMultipleDoses: false },
  { name: 'CoQ10', category: 'other', commonDosage: '100 mg', timing: 'with_food', timingNote: 'Take with fatty food for absorption', allowMultipleDoses: false },
  { name: 'Ashwagandha', category: 'other', commonDosage: '600 mg', timing: 'evening', timingNote: 'Take in evening; promotes calm and sleep', allowMultipleDoses: false },
  { name: 'Turmeric / Curcumin', category: 'other', commonDosage: '500 mg', timing: 'with_food', timingNote: 'Take with black pepper and fat for absorption', allowMultipleDoses: false },
  { name: 'Melatonin', category: 'other', commonDosage: '3 mg', timing: 'evening', timingNote: 'Take 30-60 min before bed', allowMultipleDoses: false },
  { name: 'Elderberry', category: 'other', commonDosage: '500 mg', timing: 'morning', timingNote: 'Take daily during cold/flu season', allowMultipleDoses: false },
  { name: 'Biotin', category: 'other', commonDosage: '5000 mcg', timing: 'morning', timingNote: 'Take with breakfast; supports hair/skin/nails', allowMultipleDoses: false },
];

/** Get supplements by category. */
export function getSupplementsByCategory(category: SupplementInfo['category']): SupplementInfo[] {
  return SUPPLEMENT_LIBRARY.filter((s) => s.category === category);
}

/** Get all supplement names as a flat list. */
export function getAllSupplementNames(): string[] {
  return SUPPLEMENT_LIBRARY.map((s) => s.name);
}

/** Look up supplement info by name (case-insensitive). */
export function getSupplementInfo(name: string): SupplementInfo | undefined {
  return SUPPLEMENT_LIBRARY.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

/** Timing display label. */
export function timingLabel(timing: SupplementTiming): string {
  switch (timing) {
    case 'morning': return '☀️ Morning';
    case 'evening': return '🌙 Evening';
    case 'with_food': return '🍽 With food';
    case 'empty_stomach': return '💊 Empty stomach';
    case 'anytime': return '⏰ Anytime';
  }
}

/** Timing emoji only. */
export function timingEmoji(timing: SupplementTiming): string {
  switch (timing) {
    case 'morning': return '☀️';
    case 'evening': return '🌙';
    case 'with_food': return '🍽';
    case 'empty_stomach': return '💊';
    case 'anytime': return '⏰';
  }
}

// ── Goal-based suggestions for onboarding ──

export interface GoalSupplementSuggestion {
  name: string;
  doses?: number; // default 1
}

export const GOAL_SUPPLEMENT_SUGGESTIONS: Record<string, GoalSupplementSuggestion[]> = {
  lose_weight: [
    { name: 'Multivitamin' },
    { name: 'Omega-3 / Fish Oil' },
    { name: 'Magnesium (Glycinate)' },
    { name: 'Collagen' },
  ],
  support_recovery: [
    { name: 'Vitamin B12 (Methylcobalamin)', doses: 2 },
    { name: 'Vitamin D3' },
    { name: 'Magnesium (Glycinate)' },
    { name: 'Omega-3 / Fish Oil' },
    { name: 'L-Theanine' },
  ],
  gain_muscle: [
    { name: 'Creatine' },
    { name: 'BCAA' },
    { name: 'Magnesium (Glycinate)' },
    { name: 'Omega-3 / Fish Oil' },
    { name: 'Multivitamin' },
  ],
  get_healthier: [
    { name: 'Multivitamin' },
    { name: 'Vitamin D3' },
    { name: 'Omega-3 / Fish Oil' },
    { name: 'Probiotics' },
  ],
};
