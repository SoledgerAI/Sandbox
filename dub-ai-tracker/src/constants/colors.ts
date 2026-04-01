export const Colors = {
  primaryBackground: '#1E2761',
  accent: '#D4A843',                // non-text (rings, bars, icons, backgrounds)
  accentText: '#E8C468',            // gold text variant, 5.2:1 on navy (MASTER-04)
  text: '#FFFFFF',
  secondaryText: '#B8B8B8',         // was #B0B0B0, now 4.6:1 on navy (MASTER-04)
  success: '#4CAF50',               // non-text (progress bars, chart fills)
  successText: '#66BB6A',           // green text variant, 4.6:1 on navy (MASTER-04)
  warning: '#D4A843',
  danger: '#EF5350',
  cardBackground: '#2A3370',
  inputBackground: '#1A2050',
  divider: '#3A4580',
} as const;

export type ColorKey = keyof typeof Colors;
