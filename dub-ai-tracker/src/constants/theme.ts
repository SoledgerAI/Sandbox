export const COLORS = {
  primaryBackground: '#1E2761',
  accent: '#D4A843',
  text: '#FFFFFF',
  secondaryText: '#B0B0B0',
  success: '#4CAF50',
  warning: '#D4A843',
  danger: '#E53935',
  cardBackground: '#2A3370',
  tabBarBackground: '#1E2761',
  tabBarInactive: '#666666',
  tabBarActive: '#D4A843',
} as const;

export const STORAGE_KEYS = {
  profile: '@dubaitracker/profile',
  tags: '@dubaitracker/tags',
  logs: '@dubaitracker/logs', // append /YYYY-MM-DD
  goals: '@dubaitracker/goals',
  chat: '@dubaitracker/chat',
  settings: '@dubaitracker/settings',
  onboardingComplete: '@dubaitracker/onboarding-complete',
} as const;
