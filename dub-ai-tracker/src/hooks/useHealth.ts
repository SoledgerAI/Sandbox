// Unified health device hook
// Phase 18: Device Integrations
// Sprint 11: Strava OAuth integration added
// Provides a single interface for all health device integrations.
// Platform-aware: Apple Health on iOS, Health Connect on Android.

import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { storageGet, STORAGE_KEYS } from '../utils/storage';
import type { DeviceSyncState } from '../types/profile';

import {
  isHealthKitAvailable,
  requestHealthKitPermissions,
  syncFromHealthKit,
  disconnectHealthKit,
} from '../services/healthkit';

import {
  isHealthConnectAvailable,
  requestHealthConnectPermissions,
  syncFromHealthConnect,
  disconnectHealthConnect,
} from '../services/healthconnect';

import {
  initiateStravaAuth,
  syncFromStrava,
  disconnectStrava,
  isStravaConfigured,
} from '../services/strava';

import {
  fetchCurrentWeather,
  type WeatherData,
} from '../services/weather';

// ============================================================
// Types
// ============================================================

export type DeviceType = 'apple' | 'google' | 'strava' | 'garmin' | 'oura' | 'whoop';

export interface DeviceStatus {
  id: DeviceType;
  connected: boolean;
  lastSync: string | null;
  available: boolean;
  comingSoon: boolean;
}

export interface SyncResult {
  device: DeviceType;
  success: boolean;
  message: string;
}

export interface UseHealthResult {
  devices: DeviceStatus[];
  weather: WeatherData | null;
  syncing: boolean;
  loading: boolean;
  connectDevice: (device: DeviceType) => Promise<boolean>;
  disconnectDevice: (device: DeviceType) => Promise<void>;
  syncAll: (userWeightLbs: number) => Promise<SyncResult[]>;
  syncDevice: (device: DeviceType, userWeightLbs: number) => Promise<SyncResult>;
  refreshWeather: (lat: number, lon: number) => Promise<void>;
  refreshDeviceStates: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

export function useHealth(): UseHealthResult {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load device states from storage
  const refreshDeviceStates = useCallback(async () => {
    const [appleState, googleState, stravaState] = await Promise.all([
      storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_APPLE),
      storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_GOOGLE),
      storageGet<DeviceSyncState>(STORAGE_KEYS.DEVICES_STRAVA),
    ]);

    const stravaConfigured = isStravaConfigured();

    const statuses: DeviceStatus[] = [
      {
        id: 'apple',
        connected: appleState?.connected === true,
        lastSync: appleState?.last_sync ?? null,
        available: Platform.OS === 'ios' && isHealthKitAvailable(),
        comingSoon: false,
      },
      {
        id: 'google',
        connected: googleState?.connected === true,
        lastSync: googleState?.last_sync ?? null,
        available: Platform.OS === 'android' && isHealthConnectAvailable(),
        comingSoon: false,
      },
      {
        id: 'strava',
        connected: stravaState?.connected === true,
        lastSync: stravaState?.last_sync ?? null,
        available: stravaConfigured,
        comingSoon: !stravaConfigured,
      },
      {
        id: 'garmin',
        connected: false,
        lastSync: null,
        available: false,
        comingSoon: true,
      },
      {
        id: 'oura',
        connected: false,
        lastSync: null,
        available: false,
        comingSoon: true,
      },
    ];

    setDevices(statuses);
  }, []);

  useEffect(() => {
    (async () => {
      await refreshDeviceStates();
      setLoading(false);
    })();
  }, [refreshDeviceStates]);

  // Connect a device
  const connectDevice = useCallback(async (device: DeviceType): Promise<boolean> => {
    switch (device) {
      case 'apple': {
        const ok = await requestHealthKitPermissions();
        if (ok) await refreshDeviceStates();
        return ok;
      }
      case 'google': {
        const ok = await requestHealthConnectPermissions();
        if (ok) await refreshDeviceStates();
        return ok;
      }
      case 'strava': {
        try {
          await initiateStravaAuth();
          // The actual connection happens in handleStravaCallback
          // triggered by the deep link. Return true to indicate
          // the auth flow was initiated.
          return true;
        } catch {
          return false;
        }
      }
      default:
        return false;
    }
  }, [refreshDeviceStates]);

  // Disconnect a device
  const disconnectDevice = useCallback(async (device: DeviceType): Promise<void> => {
    switch (device) {
      case 'apple':
        await disconnectHealthKit();
        break;
      case 'google':
        await disconnectHealthConnect();
        break;
      case 'strava':
        await disconnectStrava();
        break;
    }
    await refreshDeviceStates();
  }, [refreshDeviceStates]);

  // Sync a single device
  const syncDevice = useCallback(async (device: DeviceType, userWeightLbs: number): Promise<SyncResult> => {
    switch (device) {
      case 'apple': {
        const result = await syncFromHealthKit();
        return {
          device: 'apple',
          success: result.success,
          message: result.success
            ? `Synced ${result.dataTypes.join(', ')} from Apple Health`
            : 'Apple Health sync failed',
        };
      }
      case 'google': {
        const result = await syncFromHealthConnect();
        return {
          device: 'google',
          success: result.success,
          message: result.success
            ? `Synced ${result.dataTypes.join(', ')} from Health Connect`
            : 'Health Connect sync failed',
        };
      }
      case 'strava': {
        const result = await syncFromStrava(userWeightLbs);
        return {
          device: 'strava',
          success: result.success,
          message: result.success
            ? `Synced ${result.activitiesImported} activit${result.activitiesImported === 1 ? 'y' : 'ies'} from Strava`
            : 'Strava sync failed',
        };
      }
      default:
        return { device, success: false, message: `${device} integration not available yet` };
    }
  }, []);

  // Sync all connected devices
  const syncAll = useCallback(async (userWeightLbs: number): Promise<SyncResult[]> => {
    setSyncing(true);
    const results: SyncResult[] = [];

    const connectedDevices = devices.filter((d) => d.connected && d.available);

    for (const device of connectedDevices) {
      const result = await syncDevice(device.id, userWeightLbs);
      results.push(result);
    }

    await refreshDeviceStates();
    setSyncing(false);
    return results;
  }, [devices, syncDevice, refreshDeviceStates]);

  // Refresh weather data
  const refreshWeather = useCallback(async (lat: number, lon: number): Promise<void> => {
    const data = await fetchCurrentWeather(lat, lon);
    setWeather(data);
  }, []);

  return {
    devices,
    weather,
    syncing,
    loading,
    connectDevice,
    disconnectDevice,
    syncAll,
    syncDevice,
    refreshWeather,
    refreshDeviceStates,
  };
}
