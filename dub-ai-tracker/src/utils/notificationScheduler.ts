// Sprint 24: Notification Scheduler
// Schedules, cancels, and reschedules all user-configurable reminder types
// All notifications are LOCAL — no push server needed

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { storageGet, storageSet, storageList, STORAGE_KEYS, dateKey } from './storage';
import { getMedicationList } from './medicationList';
import { isCategoryEnabled } from './categoryElection';
import type { NotificationSettings, WaterReminderInterval, DoctorVisitEntry, MedicationDefinition } from '../types';

// iOS limits to 64 pending local notifications
const IOS_NOTIFICATION_LIMIT = 64;

const DEFAULT_SETTINGS: NotificationSettings = {
  master_enabled: true,
  daily_logging: { enabled: true, time: '20:00' },
  morning_checkin: { enabled: true, time: '07:30' },
  medication_reminders: { enabled: true },
  water_reminders: { enabled: true, interval_hours: 2, start_time: '08:00', end_time: '20:00' },
  doctor_followup: { enabled: true },
};

export { DEFAULT_SETTINGS as DEFAULT_NOTIFICATION_SETTINGS };

// ============================================================
// Settings persistence
// ============================================================

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const stored = await storageGet<NotificationSettings>(STORAGE_KEYS.SETTINGS_NOTIFICATIONS);
  return stored ?? DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  await storageSet(STORAGE_KEYS.SETTINGS_NOTIFICATIONS, settings);
}

// ============================================================
// Android channels
// ============================================================

export async function configureReminderChannels(): Promise<void> {
  try { if (Platform.OS !== 'android') return; } catch { return; }

  await Notifications.setNotificationChannelAsync('daily-logging', {
    name: 'Daily Logging Reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#D4A843',
  });

  await Notifications.setNotificationChannelAsync('morning-checkin', {
    name: 'Morning Check-in',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#D4A843',
  });

  await Notifications.setNotificationChannelAsync('medication-reminders', {
    name: 'Medication Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#D4A843',
  });

  await Notifications.setNotificationChannelAsync('water-reminders', {
    name: 'Water Reminders',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0, 50],
    lightColor: '#4CAF50',
  });

  await Notifications.setNotificationChannelAsync('doctor-followup', {
    name: 'Doctor Follow-up Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 100],
    lightColor: '#D4A843',
  });
}

// ============================================================
// Helpers
// ============================================================

function parseTime(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hour: h, minute: m };
}

function channelId(channel: string): object {
  try {
    return Platform.OS === 'android' ? { channelId: channel } : {};
  } catch {
    return {};
  }
}

/**
 * Count currently scheduled notifications with a specific type prefix.
 */
async function countScheduledByType(typePrefix: string): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((n) => {
    const t = n.content.data?.type as string | undefined;
    return t?.startsWith(typePrefix);
  }).length;
}

/**
 * Cancel all scheduled notifications with a specific type prefix.
 */
async function cancelByType(typePrefix: string): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    const t = notif.content.data?.type as string | undefined;
    if (t?.startsWith(typePrefix)) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Get total count of all scheduled DUB reminder notifications.
 * Used to enforce iOS 64-notification limit.
 */
export async function getTotalScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}

// ============================================================
// Schedule individual reminder types
// ============================================================

export async function scheduleDailyLogging(time: string): Promise<string | null> {
  await cancelByType('reminder-daily-logging');
  const { hour, minute } = parseTime(time);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DUB Daily Reminder',
      body: "Time to log your day in DUB",
      data: { type: 'reminder-daily-logging' },
      ...channelId('daily-logging'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function scheduleMorningCheckin(time: string): Promise<string | null> {
  await cancelByType('reminder-morning-checkin');
  const { hour, minute } = parseTime(time);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good Morning!',
      body: 'How did you sleep?',
      data: { type: 'reminder-morning-checkin', deepLink: '/log/sleep' },
      ...channelId('morning-checkin'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  return id;
}

export async function scheduleMedicationReminders(): Promise<string[]> {
  await cancelByType('reminder-medication');

  const medEnabled = await isCategoryEnabled('medication_tracking');
  if (!medEnabled) return [];

  const medications = await getMedicationList();
  if (medications.length === 0) return [];

  // Filter to only daily/twice_daily medications (not as_needed)
  const scheduled = medications.filter(
    (m) => m.frequency === 'daily' || m.frequency === 'twice_daily',
  );

  const ids: string[] = [];
  for (const med of scheduled) {
    const { hour, minute } = parseTime(med.scheduled_time);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medication Reminder',
        body: `Time to take ${med.name} (${med.dosage})`,
        data: { type: 'reminder-medication', medicationId: med.id },
        ...channelId('medication-reminders'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
    ids.push(id);

    // For twice_daily, add a second notification 12 hours later
    if (med.frequency === 'twice_daily') {
      const secondHour = (hour + 12) % 24;
      const id2 = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication Reminder',
          body: `Time to take ${med.name} (${med.dosage})`,
          data: { type: 'reminder-medication', medicationId: med.id, dose: 2 },
          ...channelId('medication-reminders'),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: secondHour,
          minute,
        },
      });
      ids.push(id2);
    }
  }

  return ids;
}

export async function scheduleWaterReminders(
  intervalHours: WaterReminderInterval,
  startTime: string,
  endTime: string,
): Promise<string[]> {
  await cancelByType('reminder-water');

  const start = parseTime(startTime);
  const end = parseTime(endTime);

  const ids: string[] = [];
  let currentHour = start.hour;

  while (currentHour <= end.hour) {
    // Skip if past end time
    if (currentHour === end.hour && start.minute > end.minute) break;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Stay Hydrated!',
        body: 'Log your water intake',
        data: { type: 'reminder-water', hour: currentHour },
        ...channelId('water-reminders'),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: currentHour,
        minute: 0,
      },
    });
    ids.push(id);

    currentHour += intervalHours;
  }

  return ids;
}

export async function scheduleDoctorFollowups(): Promise<string[]> {
  await cancelByType('reminder-doctor-followup');

  // Scan doctor visit entries for upcoming follow-up dates
  const visitKeys = await storageList(STORAGE_KEYS.LOG_DOCTOR_VISITS);
  const ids: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const key of visitKeys) {
    const visits = await storageGet<DoctorVisitEntry[]>(key);
    if (!visits) continue;

    for (const visit of (Array.isArray(visits) ? visits : [visits])) {
      if (!visit.follow_up_date) continue;

      const followUpDate = new Date(visit.follow_up_date + 'T09:00:00');
      if (followUpDate <= today) continue; // Skip past dates

      // Only schedule follow-ups within the next 30 days (iOS 64 limit)
      const daysUntil = Math.floor((followUpDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil > 30) continue;

      const visitLabel = visit.visit_type
        ? visit.visit_type.replace(/_/g, ' ')
        : 'appointment';

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Doctor Follow-up Reminder',
          body: `You have a follow-up scheduled: ${visitLabel}`,
          data: { type: 'reminder-doctor-followup', visitId: visit.id },
          ...channelId('doctor-followup'),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: followUpDate,
        },
      });
      ids.push(id);
    }
  }

  return ids;
}

// ============================================================
// Cancel helpers
// ============================================================

export async function cancelDailyLogging(): Promise<void> {
  await cancelByType('reminder-daily-logging');
}

export async function cancelMorningCheckin(): Promise<void> {
  await cancelByType('reminder-morning-checkin');
}

export async function cancelMedicationReminders(): Promise<void> {
  await cancelByType('reminder-medication');
}

export async function cancelWaterReminders(): Promise<void> {
  await cancelByType('reminder-water');
}

export async function cancelDoctorFollowups(): Promise<void> {
  await cancelByType('reminder-doctor-followup');
}

export async function cancelAllReminders(): Promise<void> {
  await cancelByType('reminder-');
}

// ============================================================
// Sync all — call on app launch to re-register after iOS update
// ============================================================

/**
 * Re-sync all scheduled notifications with current settings.
 * iOS clears local notifications on app update, so this must run on every launch.
 * Respects the iOS 64-notification limit by prioritizing in order:
 * daily logging (1) > morning check-in (1) > medication (N) > water (N) > doctor followup (N)
 */
export async function syncAllReminders(): Promise<{
  scheduled: number;
  skipped: string[];
}> {
  const settings = await getNotificationSettings();
  const skipped: string[] = [];

  if (!settings.master_enabled) {
    await cancelAllReminders();
    return { scheduled: 0, skipped: [] };
  }

  // Cancel all existing reminders first, then reschedule
  await cancelAllReminders();

  let totalScheduled = 0;

  // 1. Daily logging (1 notification)
  if (settings.daily_logging.enabled) {
    await scheduleDailyLogging(settings.daily_logging.time);
    totalScheduled += 1;
  }

  // 2. Morning check-in (1 notification)
  if (settings.morning_checkin.enabled) {
    await scheduleMorningCheckin(settings.morning_checkin.time);
    totalScheduled += 1;
  }

  // 3. Medication reminders (N notifications, high priority)
  if (settings.medication_reminders.enabled) {
    const medIds = await scheduleMedicationReminders();
    totalScheduled += medIds.length;
  }

  // 4. Water reminders (N notifications)
  if (settings.water_reminders.enabled) {
    // Check if we'd exceed the iOS limit
    const waterCount = estimateWaterNotificationCount(
      settings.water_reminders.interval_hours,
      settings.water_reminders.start_time,
      settings.water_reminders.end_time,
    );
    if (totalScheduled + waterCount <= IOS_NOTIFICATION_LIMIT - 10) {
      const waterIds = await scheduleWaterReminders(
        settings.water_reminders.interval_hours,
        settings.water_reminders.start_time,
        settings.water_reminders.end_time,
      );
      totalScheduled += waterIds.length;
    } else {
      skipped.push('water_reminders (iOS notification limit)');
    }
  }

  // 5. Doctor follow-ups (N one-time notifications)
  if (settings.doctor_followup.enabled) {
    if (totalScheduled < IOS_NOTIFICATION_LIMIT - 5) {
      const docIds = await scheduleDoctorFollowups();
      totalScheduled += docIds.length;
    } else {
      skipped.push('doctor_followup (iOS notification limit)');
    }
  }

  return { scheduled: totalScheduled, skipped };
}

function estimateWaterNotificationCount(
  interval: WaterReminderInterval,
  startTime: string,
  endTime: string,
): number {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const hours = end.hour - start.hour;
  return Math.max(0, Math.floor(hours / interval) + 1);
}

/**
 * Send a test notification immediately (for preview/test button in settings).
 */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DUB Test Notification',
      body: 'Notifications are working correctly!',
      data: { type: 'test' },
    },
    trigger: null, // Immediate
  });
}

/**
 * Clear badge count on app open.
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
