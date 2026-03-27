export const Colors = {
  primaryBackground: '#1E2761',
  accent: '#D4A843',
  text: '#FFFFFF',
  secondaryText: '#B0B0B0',
  success: '#4CAF50',
  warning: '#D4A843',
  danger: '#EF5350',
  cardBackground: '#2A3370',
  inputBackground: '#1A2050',
  divider: '#3A4580',
} as const;

export type ColorKey = keyof typeof Colors;
