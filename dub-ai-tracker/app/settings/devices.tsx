// Settings > Device Connections
// Phase 18: Device Integrations
// Apple Health (iOS) and Google Health Connect (Android) are functional.
// Strava, Garmin, Oura: Coming Soon — no active data flow.

import { useState, useEffect } from 'react';
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
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { useHealth, type DeviceType } from '../../src/hooks/useHealth';
import type { UserProfile } from '../../src/types/profile';

interface DeviceConfig {
  id: DeviceType;
  name: string;
  icon: string;
  platform: 'ios' | 'android' | 'all';
  comingSoon: boolean;
}

const DEVICES: DeviceConfig[] = [
  {
    id: 'apple',
    name: 'Apple Health',
    icon: 'heart-outline',
    platform: 'ios',
    comingSoon: false,
  },
  {
    id: 'google',
    name: 'Google Health Connect',
    icon: 'fitness-outline',
    platform: 'android',
    comingSoon: false,
  },
  {
    id: 'strava',
    name: 'Strava',
    icon: 'bicycle-outline',
    platform: 'all',
    comingSoon: true,
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

const INTEREST_STORAGE_KEY = '@dubaitracker/device_interest';

interface DeviceInterest {
  [deviceId: string]: boolean;
}

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
  const [interests, setInterests] = useState<DeviceInterest>({});

  useEffect(() => {
    storageGet<DeviceInterest>(INTEREST_STORAGE_KEY).then((saved) => {
      if (saved) setInterests(saved);
    });
  }, []);

  async function handleInterest(deviceId: string) {
    const updated = { ...interests, [deviceId]: true };
    setInterests(updated);
    await storageSet(INTEREST_STORAGE_KEY, updated);
    Alert.alert('Noted!', "We'll prioritize this integration. Thanks for your feedback.");
  }

  async function handleConnect(config: DeviceConfig) {
    if (config.comingSoon) return;

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
                Alert.alert('Apple Health', 'Permissions granted. Your data will sync automatically.');
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
                Alert.alert('Health Connect', 'Permissions granted. Your data will sync automatically.');
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
    <ScreenWrapper>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Devices</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>
        Manage apps and devices
      </Text>

      {platformDevices.map((config) => {
        const deviceStatus = devices.find((d) => d.id === config.id);
        const connected = !config.comingSoon && deviceStatus?.connected === true;
        const isSyncing = syncingDeviceId === config.id;

        if (config.comingSoon) {
          return (
            <View key={config.id} style={styles.deviceCard}>
              <View style={styles.deviceInfo}>
                <Ionicons name={config.icon as any} size={24} color={Colors.secondaryText} />
                <View style={styles.deviceTextContainer}>
                  <Text style={styles.deviceName}>{config.name}</Text>
                  <Text style={styles.comingSoonText}>
                    {config.name} integration is in development
                  </Text>
                </View>
              </View>
              <View style={styles.buttonRow}>
                {interests[config.id] ? (
                  <View style={styles.interestedBadge}>
                    <Ionicons name="checkmark" size={14} color={Colors.accent} />
                    <Text style={styles.interestedText}>Noted</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.interestButton}
                    onPress={() => handleInterest(config.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.interestButtonText}>Interested?</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }

        return (
          <View key={config.id} style={styles.deviceCard}>
            <View style={styles.deviceInfo}>
              <Ionicons name={config.icon as any} size={24} color={Colors.accent} />
              <View style={styles.deviceTextContainer}>
                <Text style={styles.deviceName}>{config.name}</Text>
                {connected ? (
                  <Text style={styles.connectedText}>
                    Connected{deviceStatus?.lastSync ? ` \u2014 Last sync: ${formatDate(deviceStatus.lastSync)}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.notConnected}>Not connected</Text>
                )}
              </View>
            </View>

            <View style={styles.buttonRow}>
              {connected && (
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
            </View>
          </View>
        );
      })}

    </ScrollView>
    </ScreenWrapper>
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
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
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
  connectedText: { color: Colors.successText, fontSize: 12, marginTop: 2 },
  notConnected: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  comingSoonText: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
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
  disconnectButtonText: { color: Colors.dangerText },
  interestButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  interestButtonText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  interestedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  interestedText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '500',
  },
});
