// PALETTE MIGRATION — Sprint 15 (April 2026)
// Old navy #1E2761 retired as primary background.
// New palette: #0D0F1A (base), #1A1D2E (card), #222639 (elevated)
// Text colors unchanged — WCAG AA ratios improve on darker bg.
export const Colors = {
  primaryBackground: '#0D0F1A',     // deepest background (app base, tab bar, status bar)
  accent: '#D4A843',                // non-text (rings, bars, icons, backgrounds)
  accentText: '#E8C468',            // gold text variant
  text: '#FFFFFF',
  secondaryText: '#B8B8B8',
  success: '#4CAF50',               // non-text (progress bars, chart fills)
  successText: '#66BB6A',           // green text variant
  warning: '#D4A843',
  danger: '#E57373',               // non-text (borders, icons, chart fills)
  dangerText: '#FF9C9C',           // red text variant
  cardBackground: '#1A1D2E',       // primary cards, input fields
  elevated: '#222639',             // modals, overlays, selected states
  cardBorder: 'rgba(212, 168, 67, 0.08)', // faint gold glow
  inputBackground: '#1A1D2E',
  divider: 'rgba(255, 255, 255, 0.08)',
  tabBarBackground: '#0D0F1A',
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
