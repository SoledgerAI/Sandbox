// Settings > Device Connections
// Phase 18: Device Integrations
// Connection status display, OAuth initiation for Strava,
// Apple Health / Google Health Connect native permissions,
// Garmin / Oura "Coming Soon" stubs.

import { useState } from 'react';
import {
  Alert,
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
import { useHealth, type DeviceType } from '../../src/hooks/useHealth';
import type { UserProfile } from '../../src/types/profile';

interface DeviceConfig {
  id: DeviceType;
  name: string;
  icon: string;
  platform: 'ios' | 'android' | 'all';
  comingSoon?: boolean;
}

const DEVICES: DeviceConfig[] = [
  {
    id: 'apple',
    name: 'Apple Health',
    icon: 'heart-outline',
    platform: 'ios',
  },
  {
    id: 'google',
    name: 'Google Health Connect',
    icon: 'fitness-outline',
    platform: 'android',
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: 'bicycle-outline',
    platform: 'all',
  },
  {
    id: 'garmin',
    name: 'Garmin',
    icon: 'watch-outline',
    platform: 'all',
    comingSoon: true,
  },
  {
    id: 'oura',
    name: 'Oura',
    icon: 'ellipse-outline',
    platform: 'all',
    comingSoon: true,
  },
];

export default function DevicesScreen() {
  const {
    devices,
    loading,
    connectDevice,
    disconnectDevice,
    syncDevice,
    refreshDeviceStates,
  } = useHealth();

  const [syncingDeviceId, setSyncingDeviceId] = useState<string | null>(null);

  async function handleConnect(config: DeviceConfig) {
    if (config.comingSoon) return;

    if (config.id === 'strava') {
      Alert.alert(
        'Connect Strava',
        'You will be redirected to Strava to authorize DUB_AI to read your activity data.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              try {
                await connectDevice('strava');
              } catch {
                Alert.alert(
                  'Strava',
                  'Could not open Strava authorization. Please ensure you have Strava credentials configured.',
                );
              }
            },
          },
        ],
      );
      return;
    }

    if (config.id === 'apple') {
      Alert.alert(
        'Connect Apple Health',
        'DUB_AI will request permission to read steps, heart rate, HRV, sleep, weight, and workouts from Apple Health. You can modify these permissions anytime in iOS Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              const ok = await connectDevice('apple');
              if (ok) {
                Alert.alert('Connected', 'Apple Health connected successfully.');
              } else {
                Alert.alert('Error', 'Could not connect to Apple Health. Please check permissions in iOS Settings.');
              }
            },
          },
        ],
      );
      return;
    }

    if (config.id === 'google') {
      Alert.alert(
        'Connect Health Connect',
        'DUB_AI will request permission to read steps, heart rate, HRV, sleep, weight, and workouts from Health Connect. You can modify these permissions anytime in Android Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect',
            onPress: async () => {
              const ok = await connectDevice('google');
              if (ok) {
                Alert.alert('Connected', 'Health Connect connected successfully.');
              } else {
                Alert.alert('Error', 'Could not connect to Health Connect. Please check that Health Connect is installed and permissions are granted.');
              }
            },
          },
        ],
      );
      return;
    }
  }

  function handleDisconnect(config: DeviceConfig) {
    Alert.alert(
      `Disconnect ${config.name}`,
      `Stop syncing data from ${config.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await disconnectDevice(config.id);
          },
        },
      ],
    );
  }

  async function handleSync(config: DeviceConfig) {
    setSyncingDeviceId(config.id);
    try {
      const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
      const weightLbs = profile?.weight_lbs ?? 170;
      const result = await syncDevice(config.id, weightLbs);
      Alert.alert(
        result.success ? 'Sync Complete' : 'Sync Failed',
        result.message,
      );
      await refreshDeviceStates();
    } catch {
      Alert.alert('Sync Error', 'An unexpected error occurred during sync.');
    } finally {
      setSyncingDeviceId(null);
    }
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

      {platformDevices.map((config) => {
        const deviceStatus = devices.find((d) => d.id === config.id);
        const connected = deviceStatus?.connected === true;
        const isSyncing = syncingDeviceId === config.id;

        return (
          <View key={config.id} style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
              <Ionicons name={config.icon as any} size={24} color={Colors.accent} />
              <View style={styles.deviceTextContainer}>
                <Text style={styles.deviceName}>{config.name}</Text>
                {config.comingSoon ? (
                  <Text style={styles.comingSoon}>Coming Soon</Text>
                ) : connected ? (
                  <Text style={styles.connectedText}>
                    Connected{deviceStatus?.lastSync ? ` — Last sync: ${formatDate(deviceStatus.lastSync)}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.notConnected}>Not connected</Text>
                )}
              </View>
            </View>

            <View style={styles.buttonRow}>
              {connected && !config.comingSoon && (
                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={() => handleSync(config)}
                  activeOpacity={0.7}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : (
                    <Ionicons name="sync-outline" size={18} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              )}

              {!config.comingSoon && (
                <TouchableOpacity
                  style={[
                    styles.connectButton,
                    connected && styles.disconnectButton,
                  ]}
                  onPress={() => (connected ? handleDisconnect(config) : handleConnect(config))}
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
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
