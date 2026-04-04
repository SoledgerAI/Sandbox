// Step 4 (Part A): Device Connection — Onboarding
// Phase 3: Onboarding Flow
// Shows functional integrations (Apple Health, Google Health Connect)
// and Coming Soon stubs for Strava, Garmin, Oura.
// No device connections happen here — users set them up in Settings.

import { StyleSheet, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface DeviceOption {
  id: string;
  name: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  available: boolean;
  comingSoon: boolean;
  platformNote: string | null;
}

const DEVICES: DeviceOption[] = [
  {
    id: 'apple_health',
    name: 'Apple Health',
    icon: 'heart-circle-outline',
    available: Platform.OS === 'ios',
    comingSoon: false,
    platformNote: Platform.OS === 'ios' ? null : 'iOS only',
  },
  {
    id: 'google_health',
    name: 'Google Health Connect',
    icon: 'fitness-outline',
    available: Platform.OS === 'android',
    comingSoon: false,
    platformNote: Platform.OS === 'android' ? null : 'Android only',
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: 'bicycle-outline',
    available: false,
    comingSoon: true,
    platformNote: null,
  },
  {
    id: 'garmin',
    name: 'Garmin',
    icon: 'watch-outline',
    available: false,
    comingSoon: true,
    platformNote: null,
  },
  {
    id: 'oura',
    name: 'Oura',
    icon: 'ellipse-outline',
    available: false,
    comingSoon: true,
    platformNote: null,
  },
];

export function DeviceConnect() {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Connect Devices</Text>
      <Text style={styles.sectionSubtitle}>
        Connect your devices to automatically import workouts, sleep, and health data.
        You can set these up later in Settings.
      </Text>

      <View style={styles.devices}>
        {DEVICES.map((device) => (
          <View
            key={device.id}
            style={[styles.deviceCard, !device.available && styles.deviceDisabled]}
          >
            <Ionicons
              name={device.icon}
              size={24}
              color={device.available ? Colors.accent : Colors.secondaryText}
            />
            <View style={styles.deviceInfo}>
              <Text
                style={[
                  styles.deviceName,
                  !device.available && styles.deviceNameDisabled,
                ]}
              >
                {device.name}
              </Text>
              {device.comingSoon && (
                <Text style={styles.comingSoon}>Coming Soon</Text>
              )}
              {device.platformNote && (
                <Text style={styles.comingSoon}>{device.platformNote}</Text>
              )}
              {device.available && (
                <Text style={styles.setupHint}>Set up in Settings after onboarding</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  devices: {
    gap: 10,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  deviceDisabled: {
    opacity: 0.5,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  deviceNameDisabled: {
    color: Colors.secondaryText,
  },
  comingSoon: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  setupHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
  },
});
