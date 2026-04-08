// FUTURE: Migrate all Animated usage to react-native-reanimated.
// Current state: Animated (shake effects), reanimated (ScoreRing,
// LineChart), LayoutAnimation (onboarding). Do not mix further.

export const AnimationDurations = {
  fast: 150,
  normal: 300,
  slow: 600,
} as const;

export const ModalAnimation = 'slide' as const;
