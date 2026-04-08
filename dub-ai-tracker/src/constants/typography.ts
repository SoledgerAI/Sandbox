// MIGRATION: New code should use FontSize and FontWeight constants.
// Typography scale for DUB_AI Tracker
// Centralizes font size constants to prevent inline magic numbers
// Based on audit of most common sizes across the codebase

export const FontSize = {
  xs: 11,        // chart axis labels, badges, tertiary indicators
  sm: 12,        // captions, timestamps, helper text
  base: 14,      // body text, input fields, list items
  md: 16,        // card titles, section content, buttons
  lg: 18,        // section headers, modal titles
  xl: 20,        // screen subtitles, prominent labels
  '2xl': 24,     // screen titles, page headers
  '3xl': 28,     // large display numbers (stats)
  '4xl': 32,     // hero numbers (daily summary)
  '5xl': 40,     // splash/onboarding display
  '6xl': 48,     // oversized display (rare)
} as const;

export type FontSizeKey = keyof typeof FontSize;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};
