// Settings hub navigation config
// H6: extracted from app/(tabs)/settings.tsx to keep the hub screen minimal

export interface SettingsNavItem {
  id: string;
  icon: string;
  label: string;
  subtitle: string;
  route: string;
}

export const SETTINGS_SECTIONS: { title: string; items: SettingsNavItem[] }[] = [
  {
    title: 'ACCOUNT',
    items: [
      { id: 'profile', icon: 'person-circle-outline', label: 'Profile', subtitle: 'Name, DOB, height, weight, goals', route: '/settings/profile' },
      { id: 'tier', icon: 'speedometer-outline', label: 'Engagement Tier', subtitle: 'Your tracking intensity', route: '/settings/tier' },
      { id: 'personalization', icon: 'sparkles-outline', label: 'Personalization', subtitle: 'Sex, age, ZIP, fasting', route: '/settings/personalization' },
    ],
  },
  {
    title: 'PREFERENCES',
    items: [
      { id: 'security', icon: 'lock-closed-outline', label: 'Security', subtitle: 'App lock, PIN, biometric', route: '/settings/security' },
      { id: 'appearance', icon: 'moon-outline', label: 'Appearance', subtitle: 'Theme: dark, light, system', route: '/settings/appearance' },
      { id: 'macros', icon: 'nutrition-outline', label: 'My Macros', subtitle: 'Which macros to track', route: '/settings/macros' },
    ],
  },
  {
    title: 'TRACKING SETUP',
    items: [
      { id: 'tags', icon: 'pricetags-outline', label: 'What You Track', subtitle: 'Manage tracking categories', route: '/settings/tags' },
      { id: 'daily-goals', icon: 'checkbox-outline', label: 'Daily Goals', subtitle: 'Define your compliance scorecard', route: '/settings/daily-goals' },
      { id: 'devices', icon: 'watch-outline', label: 'Devices', subtitle: 'Connected health devices', route: '/settings/devices' },
    ],
  },
  {
    title: 'AI COACH',
    items: [
      { id: 'apikey', icon: 'key-outline', label: 'API Key Setup', subtitle: 'Configure your Anthropic key', route: '/settings/apikey' },
      { id: 'taste', icon: 'restaurant-outline', label: 'Taste Profile', subtitle: 'Cuisines, restrictions, dislikes', route: '/settings/taste' },
    ],
  },
  {
    title: 'DATA',
    items: [
      { id: 'export', icon: 'download-outline', label: 'Data Export', subtitle: 'Export your data as JSON', route: '/settings/export' },
      { id: 'healthreport', icon: 'document-text-outline', label: 'Health Report', subtitle: 'Generate PDF health summary', route: '/settings/healthreport' },
    ],
  },
  {
    title: 'NOTIFICATIONS',
    items: [
      { id: 'notifications', icon: 'notifications-outline', label: 'Preferences', subtitle: 'Reminders and check-ins', route: '/settings/notifications' },
    ],
  },
  {
    title: 'SUPPORT',
    items: [
      { id: 'crisis-support', icon: 'heart-outline', label: 'Crisis Support', subtitle: '988 Suicide & Crisis Lifeline', route: '/settings/crisis-support' },
    ],
  },
  {
    title: 'ABOUT',
    items: [
      { id: 'agreement', icon: 'document-text-outline', label: 'User Agreement', subtitle: 'Privacy, AI, and data policies', route: '/settings/agreement' },
      { id: 'about', icon: 'information-circle-outline', label: 'About DUB_AI', subtitle: 'Version, privacy, data deletion', route: '/settings/about' },
      { id: 'marketplace', icon: 'cart-outline', label: 'Marketplace', subtitle: 'Products, influencers, deals', route: '/marketplace' },
    ],
  },
];
