export const Colors = {
  primaryBackground: '#1E2761',
  accent: '#D4A843',                // non-text (rings, bars, icons, backgrounds)
  accentText: '#E8C468',            // gold text variant, 5.2:1 on navy (MASTER-04)
  text: '#FFFFFF',
  secondaryText: '#B8B8B8',         // was #B0B0B0, now 4.6:1 on navy (MASTER-04)
  success: '#4CAF50',               // non-text (progress bars, chart fills)
  successText: '#66BB6A',           // green text variant, 4.6:1 on navy (MASTER-04)
  warning: '#D4A843',
  danger: '#E57373',               // non-text (borders, icons, chart fills) — 4.8:1 on navy, 3.1:1 on card
  dangerText: '#FF9C9C',           // red text variant — WCAG AA: 7.2:1 on navy, 4.6:1 on card
  // Card background — WCAG 2.1 AA remediation
  // OLD: #2A3370 (L=0.040, avg-RGB delta 13 from bg — insufficient separation)
  // NEW: #334480 (L=0.064, avg-RGB delta 27 from bg — 22-28 target met)
  // Contrast ratios on #334480:
  //   #FFFFFF  text     → 9.21:1 ✓  (AA)
  //   #B8B8B8  secondary→ 4.64:1 ✓  (AA)
  //   #E8C468  accent   → 5.49:1 ✓  (AA)
  //   #66BB6A  success  → 3.89:1 ⚠  (needs bump to pass AA on card)
  //   #FF8A8A  danger   → 4.50:1 ✓  (fixed — was 3.28:1 with #FF6B6B)
  cardBackground: '#334480',
  inputBackground: '#1A2050',
  divider: '#3A4580',
} as const;

export type ColorKey = keyof typeof Colors;

export const HealthColors = {
  // Blood pressure
  bpNormal: '#4CAF50',
  bpElevated: '#FFC107',
  bpStage1: '#FF9800',
  bpStage2: '#EF5350',

  // Glucose
  glucoseNormal: '#4CAF50',
  glucosePreDiabetic: '#FFC107',
  glucoseDiabetic: '#F44336',

  // Bristol Scale
  bristolType1: '#8D6E63',
  bristolType2: '#A1887F',
  bristolNormal: '#4CAF50',
  bristolType6: '#FF9800',
  bristolType7: '#F44336',

  // Cycle phases
  cycleMenstrual: '#E8A0A0',
  cycleFollicular: '#E07070',
  cycleOvulation: '#D04040',
  cycleLuteal: '#7E57C2',
} as const;
