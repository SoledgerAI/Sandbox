// Static license data for production dependencies
// Generated from package.json dependencies

export interface LicenseEntry {
  name: string;
  version: string;
  license: string;
}

export const LICENSES: LicenseEntry[] = [
  { name: '@expo/vector-icons', version: '15.0.2', license: 'MIT' },
  { name: '@react-native-async-storage/async-storage', version: '2.2.0', license: 'MIT' },
  { name: '@react-native-community/datetimepicker', version: '8.6.0', license: 'MIT' },
  { name: '@react-native-community/netinfo', version: '11.5.2', license: 'MIT' },
  { name: '@react-native-picker/picker', version: '2.11.4', license: 'MIT' },
  { name: '@react-navigation/bottom-tabs', version: '7.15.5', license: 'MIT' },
  { name: 'expo', version: '55.0.9', license: 'MIT' },
  { name: 'expo-camera', version: '55.0.11', license: 'MIT' },
  { name: 'expo-clipboard', version: '55.0.9', license: 'MIT' },
  { name: 'expo-constants', version: '55.0.9', license: 'MIT' },
  { name: 'expo-crypto', version: '55.0.10', license: 'MIT' },
  { name: 'expo-file-system', version: '55.0.12', license: 'MIT' },
  { name: 'expo-font', version: '55.0.4', license: 'MIT' },
  { name: 'expo-image-picker', version: '55.0.14', license: 'MIT' },
  { name: 'expo-linking', version: '55.0.9', license: 'MIT' },
  { name: 'expo-local-authentication', version: '55.0.9', license: 'MIT' },
  { name: 'expo-notifications', version: '55.0.14', license: 'MIT' },
  { name: 'expo-print', version: '55.0.9', license: 'MIT' },
  { name: 'expo-router', version: '55.0.8', license: 'MIT' },
  { name: 'expo-secure-store', version: '55.0.9', license: 'MIT' },
  { name: 'expo-sharing', version: '55.0.14', license: 'MIT' },
  { name: 'expo-splash-screen', version: '55.0.13', license: 'MIT' },
  { name: 'expo-status-bar', version: '55.0.4', license: 'MIT' },
  { name: 'expo-tracking-transparency', version: '55.0.9', license: 'MIT' },
  { name: 'react', version: '19.2.0', license: 'MIT' },
  { name: 'react-native', version: '0.83.4', license: 'MIT' },
  { name: 'react-native-gesture-handler', version: '2.30.0', license: 'MIT' },
  { name: 'react-native-health', version: '1.18.0', license: 'MIT' },
  { name: 'react-native-health-connect', version: '3.2.0', license: 'MIT' },
  { name: 'react-native-reanimated', version: '4.2.1', license: 'MIT' },
  { name: 'react-native-safe-area-context', version: '5.6.2', license: 'MIT' },
  { name: 'react-native-screens', version: '4.23.0', license: 'MIT' },
  { name: 'react-native-svg', version: '15.15.3', license: 'MIT' },
  { name: 'react-native-worklets', version: '0.7.2', license: 'MIT' },
];

// Group licenses by type for section display
export function groupByLicense(entries: LicenseEntry[]): Record<string, LicenseEntry[]> {
  const groups: Record<string, LicenseEntry[]> = {};
  for (const entry of entries) {
    if (!groups[entry.license]) {
      groups[entry.license] = [];
    }
    groups[entry.license].push(entry);
  }
  return groups;
}
