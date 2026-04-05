// Notification hook for EOD questionnaire and reminders
// Phase 15: EOD Questionnaire and Notifications

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-modules-core';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';
import {
  configureNotifications,
  requestPermissions,
  scheduleEODNotification,
  scheduleTierReminders,
  cancelAllNotifications,
  rescheduleAll,
  getUnloggedTags,
  getEODTriggerHour,
} from '../services/notifications';
import type { AppSettings } from '../types/profile';

interface NotificationPreferences {
  enabled: boolean;
  eodEnabled: boolean;
  remindersEnabled: boolean;
}

interface UseNotificationsResult {
  /** Whether notifications are enabled */
  enabled: boolean;
  /** Whether EOD questionnaire notifications are enabled */
  eodEnabled: boolean;
  /** Whether daily reminder notifications are enabled */
  remindersEnabled: boolean;
  /** Whether permission has been granted */
  permissionGranted: boolean;
  /** Tags that haven't been logged today (for EOD cards) */
  unloggedTags: string[];
  /** Whether the EOD questionnaire should show */
  showEOD: boolean;
  /** Computed EOD trigger hour/minute */
  eodTime: { hour: number; minute: number } | null;
  /** Loading state */
  loading: boolean;
  /** Toggle all notifications */
  setEnabled: (value: boolean) => Promise<void>;
  /** Toggle EOD notifications */
  setEodEnabled: (value: boolean) => Promise<void>;
  /** Toggle reminder notifications */
  setRemindersEnabled: (value: boolean) => Promise<void>;
  /** Open the EOD questionnaire flow */
  openEOD: () => void;
  /** Dismiss the EOD questionnaire */
  dismissEOD: () => void;
  /** Refresh unlogged tags */
  refreshUnlogged: () => Promise<void>;
}

const PREFS_KEY = STORAGE_KEYS.NOTIFICATION_PREFS;
const EOD_DISMISSED_KEY = STORAGE_KEYS.EOD_DISMISSED;

export function useNotifications(): UseNotificationsResult {
  const [enabled, setEnabledState] = useState(true);
  const [eodEnabled, setEodEnabledState] = useState(true);
  const [remindersEnabled, setRemindersEnabledState] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [unloggedTags, setUnloggedTags] = useState<string[]>([]);
  const [showEOD, setShowEOD] = useState(false);
  const [eodTime, setEodTime] = useState<{ hour: number; minute: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const responseListener = useRef<EventSubscription | null>(null);

  // Load preferences and set up listeners
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Configure notification channels
      await configureNotifications();

      // Load preferences
      const prefs = await storageGet<NotificationPreferences>(PREFS_KEY);
      if (prefs && mounted) {
        setEnabledState(prefs.enabled);
        setEodEnabledState(prefs.eodEnabled);
        setRemindersEnabledState(prefs.remindersEnabled);
      }

      // Check permission
      const permResult = await Notifications.getPermissionsAsync();
      if (mounted) setPermissionGranted(permResult.status === 'granted');

      // Load unlogged tags
      const today = formatDate(new Date());
      const unlogged = await getUnloggedTags(today);
      if (mounted) setUnloggedTags(unlogged);

      // Load EOD time
      const time = await getEODTriggerHour();
      if (mounted) setEodTime(time);

      // Check if EOD was already dismissed today
      const dismissed = await storageGet<string>(EOD_DISMISSED_KEY);
      if (dismissed === today && mounted) {
        setShowEOD(false);
      }

      if (mounted) setLoading(false);
    }

    init();

    // Listen for notification responses (user tapped notification)
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'eod-questionnaire') {
        setShowEOD(true);
      }
    });
    responseListener.current = responseSub;

    return () => {
      mounted = false;
      responseSub.remove();
    };
  }, []);

  const savePrefs = useCallback(async (prefs: NotificationPreferences) => {
    await storageSet(PREFS_KEY, prefs);
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    setEnabledState(value);
    const prefs: NotificationPreferences = {
      enabled: value,
      eodEnabled: eodEnabled,
      remindersEnabled: remindersEnabled,
    };
    await savePrefs(prefs);

    // Also update the main settings
    const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
    if (settings) {
      await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, notification_enabled: value });
    }

    if (value) {
      const granted = await requestPermissions();
      setPermissionGranted(granted);
      if (granted) await rescheduleAll();
    } else {
      await cancelAllNotifications();
    }
  }, [eodEnabled, remindersEnabled, savePrefs]);

  const setEodEnabled = useCallback(async (value: boolean) => {
    setEodEnabledState(value);
    await savePrefs({ enabled, eodEnabled: value, remindersEnabled });

    if (enabled && value) {
      await scheduleEODNotification();
    } else {
      // Cancel just EOD notifications
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        if (notif.content.data?.type === 'eod-questionnaire') {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    }
  }, [enabled, remindersEnabled, savePrefs]);

  const setRemindersEnabled = useCallback(async (value: boolean) => {
    setRemindersEnabledState(value);
    await savePrefs({ enabled, eodEnabled, remindersEnabled: value });

    if (enabled && value) {
      await scheduleTierReminders();
    } else {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        if (notif.content.data?.type === 'daily-reminder') {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    }
  }, [enabled, eodEnabled, savePrefs]);

  const openEOD = useCallback(() => {
    setShowEOD(true);
  }, []);

  const dismissEOD = useCallback(async () => {
    setShowEOD(false);
    const today = formatDate(new Date());
    await storageSet(EOD_DISMISSED_KEY, today);
  }, []);

  const refreshUnlogged = useCallback(async () => {
    const today = formatDate(new Date());
    const unlogged = await getUnloggedTags(today);
    setUnloggedTags(unlogged);
  }, []);

  return {
    enabled,
    eodEnabled,
    remindersEnabled,
    permissionGranted,
    unloggedTags,
    showEOD,
    eodTime,
    loading,
    setEnabled,
    setEodEnabled,
    setRemindersEnabled,
    openEOD,
    dismissEOD,
    refreshUnlogged,
  };
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
