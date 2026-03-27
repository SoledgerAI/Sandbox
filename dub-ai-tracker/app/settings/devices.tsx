// Settings > Device Connections
// Phase 17: Settings and Profile Management
// Connection status display, OAuth initiation for Strava

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { storageGet, STORAGE_KEYS } from '../../src/utils/storage';
import { logAuditEvent } from '../../src/utils/audit';
import type { DeviceSyncState } from '../../src/types/profile';

interface DeviceConfig {
  id: string;
  name: string;
  icon: string;
  storageKey: string;
  platform: 'ios' | 'android' | 'all';
  available: boolean;
  comingSoon?: boolean;
}

const DEVICES: DeviceConfig[] = [
  {
    id: 'apple',
    name: 'Apple Health',
    icon: 'heart-outline',
    storageKey: STORAGE_KEYS.DEVICES_APPLE,
    platform: 'ios',
    available: true,
  },
  {
    id: 'google',
    name: 'Google Health Connect',
    icon: 'fitness-outline',
    storageKey: STORAGE_KEYS.DEVICES_GOOGLE,
    platform: 'android',
    available: true,
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: 'bicycle-outline',
    storageKey: STORAGE_KEYS.DEVICES_STRAVA,
    platform: 'all',
    available: true,
  },
  {
    id: 'garmin',
    name: 'Garmin',
    icon: 'watch-outline',
    storageKey: STORAGE_KEYS.DEVICES_GARMIN,
    platform: 'all',
    available: false,
    comingSoon: true,
  },
  {
    id: 'oura',
    name: 'Oura',
    icon: 'ellipse-outline',
    storageKey: STORAGE_KEYS.DEVICES_OURA,
    platform: 'all',
    available: false,
    comingSoon: true,
  },
];

export default function DevicesScreen() {
  const [loading, setLoading] = useState(true);
  const [syncStates, setSyncStates] = useState<Record<string, DeviceSyncState | null>>({});

  const loadDeviceStates = useCallback(async () => {
    setLoading(true);
    const states: Record<string, DeviceSyncState | null> = {};
    for (const device of DEVICES) {
      states[device.id] = await storageGet<DeviceSyncState>(device.storageKey);
    }
    setSyncStates(states);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDeviceStates();
  }, [loadDeviceStates]);

  function handleConnect(device: DeviceConfig) {
    if (!device.available) return;

    if (device.id === 'strava') {
      Alert.alert(
        'Connect Strava',
        'You will be redirected to Strava to authorize DUB_AI to read your activity data.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              await logAuditEvent('DEVICE_CONNECTED', { device: 'strava', status: 'initiated' });
              Alert.alert(
                'Strava Integration',
                'Strava OAuth requires a registered app with Strava. Full integration will be available in Phase 18.',
              );
            },
          },
        ],
      );
      return;
    }

    if (device.id === 'apple' || device.id === 'google') {
      Alert.alert(
        `Connect ${device.name}`,
        `${device.name} integration requires native permissions. Full integration will be available in Phase 18.`,
      );
    }
  }

  function handleDisconnect(device: DeviceConfig) {
    Alert.alert(
      `Disconnect ${device.name}`,
      `Stop syncing data from ${device.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await logAuditEvent('DEVICE_REVOKED', { device: device.id });
            // Clear sync state would happen here in Phase 18
          },
        },
      ],
    );
  }

  const platformDevices = DEVICES.filter(
    (d) => d.platform === 'all' || d.platform === (Platform.OS === 'ios' ? 'ios' : 'android'),
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Devices</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>
        Connect your fitness devices and health platforms to automatically sync data.
      </Text>

      {platformDevices.map((device) => {
        const state = syncStates[device.id];
        const connected = state?.connected === true;

        return (
          <View key={device.id} style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
              <Ionicons name={device.icon as any} size={24} color={Colors.accent} />
              <View style={styles.deviceTextContainer}>
                <Text style={styles.deviceName}>{device.name}</Text>
                {device.comingSoon ? (
                  <Text style={styles.comingSoon}>Coming Soon</Text>
                ) : connected ? (
                  <Text style={styles.connectedText}>
                    Connected{state?.last_sync ? ` — Last sync: ${formatDate(state.last_sync)}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.notConnected}>Not connected</Text>
                )}
              </View>
            </View>

            {!device.comingSoon && (
              <TouchableOpacity
                style={[
                  styles.connectButton,
                  connected && styles.disconnectButton,
                ]}
                onPress={() => (connected ? handleDisconnect(device) : handleConnect(device))}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.connectButtonText,
                    connected && styles.disconnectButtonText,
                  ]}
                >
                  {connected ? 'Disconnect' : 'Connect'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
        <Text style={styles.infoText}>
          Device data is stored on your device. No health data is uploaded to any server
          except when you use the AI Coach feature (transmitted to Anthropic for processing).
        </Text>
      </View>
    </ScrollView>
  );
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 60, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  deviceCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  deviceTextContainer: { flex: 1 },
  deviceName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  connectedText: { color: Colors.success, fontSize: 12, marginTop: 2 },
  notConnected: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  comingSoon: { color: Colors.warning, fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  connectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  disconnectButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.danger },
  connectButtonText: { color: Colors.primaryBackground, fontSize: 13, fontWeight: '600' },
  disconnectButtonText: { color: Colors.danger },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 12,
    alignItems: 'flex-start',
  },
  infoText: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
});
