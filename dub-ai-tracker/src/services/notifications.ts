// Notification scheduling service
// Phase 15: EOD Questionnaire and Notifications
// Phase 21: Report notification triggers

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import { getTierDefinition } from '../constants/tiers';
import type { EngagementTier } from '../types/profile';
import type { AppSettings } from '../types/profile';
import type { SleepEntry } from '../types';
import { checkDueReports, generateDailySummary, generateWeeklySummary, generateMonthlySummary } from './reporting';
import { checkCelebrations } from '../components/common/Celebration';
import { getNotificationSettings } from '../utils/notificationScheduler';
import { getEnabledCategories, isTagAllowedByElection } from '../utils/categoryElection';

// ============================================================
// Notification Channel Setup
// ============================================================

export async function configureNotifications(): Promise<boolean> {
  // Set notification handler for foreground display
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('eod-questionnaire', {
      name: 'End of Day Questionnaire',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: '#D4A843',
    });

    await Notifications.setNotificationChannelAsync('daily-reminders', {
      name: 'Daily Reminders',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0, 50],
      lightColor: '#D4A843',
    });
  }

  return true;
}

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ============================================================
// Observed Bedtime Calculation
// ============================================================

/**
 * Calculate 7-day rolling average bedtime from sleep logs.
 * Returns hour in 24h format (e.g. 22.5 = 10:30 PM).
 * Falls back to 21 (9 PM) if no data. Clamped to [18, 23].
 */
export async function getObservedBedtime(): Promise<number> {
  const today = new Date();
  const bedtimeHours: number[] = [];

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const key = dateKey(STORAGE_KEYS.LOG_SLEEP, dateStr);
    const entry = await storageGet<SleepEntry>(key);

    if (entry?.bedtime) {
      const bedDate = new Date(entry.bedtime);
      let hour = bedDate.getHours() + bedDate.getMinutes() / 60;
      // Handle after-midnight bedtimes (0-5 AM -> 24-29)
      if (hour < 12) hour += 24;
      bedtimeHours.push(hour);
    }
  }

  if (bedtimeHours.length === 0) return 21; // fallback 9 PM

  const avg = bedtimeHours.reduce((a, b) => a + b, 0) / bedtimeHours.length;
  // Clamp: never before 6 PM or after 11 PM for the trigger (which is 1hr before)
  // So bedtime must be between 19 and 24 (trigger between 18 and 23)
  return Math.max(19, Math.min(24, avg >= 24 ? avg : avg));
}

/**
 * Get the EOD trigger time.
 * TF-10: honors the user's Evening Check-in time if set in notification
 * settings. Falls back to 1 hour before observed bedtime, clamped
 * between 5 PM (17:00) and 11 PM (23:00).
 * F-08: Day boundary removed — always uses midnight.
 */
export async function getEODTriggerHour(): Promise<{ hour: number; minute: number }> {
  // User override from Evening Check-in time picker wins when set.
  try {
    const notifSettings = await getNotificationSettings();
    const override = notifSettings.evening_checkin?.time;
    if (override && /^\d{2}:\d{2}$/.test(override)) {
      const [h, m] = override.split(':').map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const clampedHour = Math.max(17, Math.min(23, h));
        return { hour: clampedHour, minute: Math.max(0, Math.min(59, m)) };
      }
    }
  } catch {
    // fall through to bedtime-derived default
  }

  const bedtime = await getObservedBedtime();
  let triggerHour = bedtime - 1; // 1 hour before bedtime

  if (triggerHour >= 24) triggerHour -= 24;

  // Clamp to [17, 23] — matches the UI picker range.
  triggerHour = Math.max(17, Math.min(23, triggerHour));

  const hour = Math.floor(triggerHour);
  const minute = Math.round((triggerHour - hour) * 60);

  return { hour, minute };
}

// ============================================================
// Unlogged Tags Detection
// ============================================================

/** Map tag IDs to their storage key bases */
const TAG_STORAGE_MAP: Record<string, string> = {
  'hydration.water': STORAGE_KEYS.LOG_WATER,
  'nutrition.food': STORAGE_KEYS.LOG_FOOD,
  'fitness.workout': STORAGE_KEYS.LOG_WORKOUT,
  'body.measurements': STORAGE_KEYS.LOG_BODY,
  'sleep.tracking': STORAGE_KEYS.LOG_SLEEP,
  'recovery.score': STORAGE_KEYS.RECOVERY,
  'supplements.daily': STORAGE_KEYS.LOG_SUPPLEMENTS,
  'health.markers': STORAGE_KEYS.LOG_BLOODWORK,
  'mental.wellness': STORAGE_KEYS.LOG_MOOD,
  'substances.tracking': STORAGE_KEYS.LOG_SUBSTANCES,
  'sexual.activity': STORAGE_KEYS.LOG_SEXUAL,
  'digestive.health': STORAGE_KEYS.LOG_DIGESTIVE,
  'personal.care': STORAGE_KEYS.LOG_PERSONALCARE,
  'womens.health': STORAGE_KEYS.LOG_CYCLE,
  'injury.pain': STORAGE_KEYS.LOG_INJURY,
  'custom.tag': STORAGE_KEYS.LOG_CUSTOM,
};

/** Priority ordering for EOD questionnaire categories */
const PRIORITY_ORDER: Record<string, number> = {
  'sleep.tracking': 1,
  'mental.wellness': 2,
  'nutrition.food': 3,
  'hydration.water': 3,
  'fitness.workout': 4,
  'strength.training': 4,
  'body.measurements': 5,
  'recovery.score': 5,
  'supplements.daily': 6,
  'health.markers': 6,
  'substances.tracking': 6,
  'sexual.activity': 6,
  'digestive.health': 6,
  'personal.care': 6,
  'womens.health': 6,
  'injury.pain': 6,
  'custom.tag': 6,
};

/**
 * Get tags the user has enabled but hasn't logged today.
 * Sorted by category priority (sleep first, misc last).
 * TF-11: tags whose elect-in category is disabled are filtered out so the
 * Evening Check-in doesn't prompt for things the user has explicitly opted
 * out of (blood pressure, glucose, substances, etc.).
 */
export async function getUnloggedTags(todayStr: string): Promise<string[]> {
  const enabledTags = await storageGet<string[]>(STORAGE_KEYS.TAGS_ENABLED);
  if (!enabledTags || enabledTags.length === 0) return [];

  const enabledCategories = await getEnabledCategories();
  const unlogged: string[] = [];

  for (const tagId of enabledTags) {
    const storageBase = TAG_STORAGE_MAP[tagId];
    if (!storageBase) continue;
    if (!isTagAllowedByElection(tagId, enabledCategories)) continue;

    const key = dateKey(storageBase, todayStr);
    const data = await storageGet<unknown>(key);

    if (data === null || data === undefined) {
      unlogged.push(tagId);
    }
  }

  // Sort by priority: sleep=1, mood=2, nutrition=3, fitness=4, body=5, other=6
  unlogged.sort((a, b) => (PRIORITY_ORDER[a] ?? 6) - (PRIORITY_ORDER[b] ?? 6));

  return unlogged;
}

// ============================================================
// Notification Scheduling
// ============================================================

/** No-shame notification copy per Rule 5 */
const EOD_COPY = [
  "Ready to wrap up your day? Let's capture what you haven't logged yet.",
  "Hey! A few things left to log today. Quick check-in?",
  'Your end-of-day summary is ready when you are.',
  "Before you wind down — want to log a few more things?",
  'Quick evening check-in: a few tags are waiting for you.',
];

function getRandomCopy(): string {
  return EOD_COPY[Math.floor(Math.random() * EOD_COPY.length)];
}

/**
 * Schedule the EOD questionnaire notification.
 * Cancels any existing EOD notifications first.
 */
export async function scheduleEODNotification(): Promise<string | null> {
  const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
  if (settings && !settings.notification_enabled) return null;

  const hasPermission = await requestPermissions();
  if (!hasPermission) return null;

  // Cancel existing EOD notifications
  await cancelEODNotifications();

  const { hour, minute } = await getEODTriggerHour();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'DUB Evening Check-in',
      body: getRandomCopy(),
      data: { type: 'eod-questionnaire' },
      ...(Platform.OS === 'android' ? { channelId: 'eod-questionnaire' } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  return id;
}

/**
 * Schedule tier-appropriate daily reminder notifications.
 * Cadence matches tier: Precision 6-8, Structured 3-5, etc.
 */
export async function scheduleTierReminders(): Promise<string[]> {
  const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
  if (settings && !settings.notification_enabled) return [];

  const hasPermission = await requestPermissions();
  if (!hasPermission) return [];

  const tier = await storageGet<EngagementTier>(STORAGE_KEYS.TIER) ?? 'balanced';
  const tierDef = getTierDefinition(tier);
  const [minNotif, maxNotif] = tierDef.notificationsPerDay;

  // Use midpoint of tier cadence range (minus 1 for EOD)
  const count = Math.max(1, Math.round((minNotif + maxNotif) / 2) - 1);

  // Cancel existing reminders
  await cancelDailyReminders();

  // Spread reminders across waking hours (8 AM to EOD trigger time)
  const { hour: eodHour } = await getEODTriggerHour();
  const startHour = 8;
  const interval = (eodHour - startHour) / (count + 1);

  // D6-003: Precision tier uses 3 batch checkpoints (post-lunch, post-dinner, EOD)
  // to prevent per-meal punishment loops. Other tiers use standard reminders.
  const PRECISION_BATCH_CHECKPOINTS = [
    { hour: 13, text: "Post-lunch check-in: here's your morning and lunch summary." },
    { hour: 19, text: "Post-dinner check-in: here's your afternoon and dinner summary." },
    { hour: 21, text: "End-of-day review: here's your full day summary." },
  ];

  const REMINDER_MESSAGES = [
    { hour: 8, text: "Good morning! Start your day by logging breakfast." },
    { hour: 10, text: "Mid-morning check: how's your water intake?" },
    { hour: 12, text: "Around lunchtime — ready to log?" },
    { hour: 14, text: "Afternoon check-in: how's your day going?" },
    { hour: 16, text: "Pre-dinner check-in: anything to log?" },
    { hour: 18, text: "Evening time — how was your workout today?" },
    { hour: 20, text: "Winding down? Log your evening activities." },
  ];

  // Fasting-aware: suppress or neutralize meal reminders outside eating window
  const fastingEnabled = settings?.fasting_enabled === true;
  const windowStart = settings?.eating_window_start ?? 12;
  const windowEnd = settings?.eating_window_end ?? 20;

  const FASTING_AWARE_MESSAGES = REMINDER_MESSAGES.map((msg) => {
    if (!fastingEnabled) return msg;
    const outsideWindow = msg.hour < windowStart || msg.hour >= windowEnd;
    if (outsideWindow) return null; // Skip reminders outside eating window
    // Inside window: neutralize meal-specific language
    if (msg.hour === 8) return { hour: msg.hour, text: "Ready to log your first meal?" };
    if (msg.hour === 12) return { hour: msg.hour, text: "Time for a check-in — anything to log?" };
    if (msg.hour === 16) return { hour: msg.hour, text: "Anything to log?" };
    return msg;
  }).filter((m): m is { hour: number; text: string } => m != null);

  // Use batch checkpoints for precision tier
  const messagesForTier = tier === 'precision' ? PRECISION_BATCH_CHECKPOINTS : (fastingEnabled ? FASTING_AWARE_MESSAGES : REMINDER_MESSAGES);
  const countForTier = tier === 'precision' ? PRECISION_BATCH_CHECKPOINTS.length : (fastingEnabled ? FASTING_AWARE_MESSAGES.length : count);

  const ids: string[] = [];

  for (let i = 0; i < countForTier && i < messagesForTier.length; i++) {
    // Precision tier uses fixed checkpoint hours; other tiers spread across waking hours
    const reminderHour = tier === 'precision'
      ? messagesForTier[i].hour
      : Math.round(startHour + interval * (i + 1));
    const closest = tier === 'precision'
      ? messagesForTier[i]
      : messagesForTier.reduce((prev, curr) =>
          Math.abs(curr.hour - reminderHour) < Math.abs(prev.hour - reminderHour) ? curr : prev,
        );

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'DUB Reminder',
        body: closest.text,
        data: { type: 'daily-reminder', index: i },
        ...(Platform.OS === 'android' ? { channelId: 'daily-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminderHour,
        minute: 0,
      },
    });

    ids.push(id);
  }

  return ids;
}

/**
 * Cancel all scheduled EOD notifications.
 */
export async function cancelEODNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'eod-questionnaire') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Cancel all scheduled daily reminder notifications.
 */
export async function cancelDailyReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.type === 'daily-reminder') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}

/**
 * Cancel all DUB notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Reschedule all notifications (call after settings change or tier change).
 */
export async function rescheduleAll(): Promise<void> {
  await cancelAllNotifications();

  const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
  if (settings && !settings.notification_enabled) return;

  await configureNotifications();
  await configureReportChannel();
  await scheduleEODNotification();
  await scheduleTierReminders();
}

// ============================================================
// Report Notification Triggers (Phase 21)
// ============================================================

/**
 * Schedule report generation notification channel (Android).
 */
async function configureReportChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reports', {
      name: 'Reports & Summaries',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: '#D4A843',
    });
  }
}

/**
 * Trigger report generation based on what's due today.
 * Called at EOD or app foreground to generate any pending reports.
 */
export async function triggerDueReports(): Promise<void> {
  const dueReports = await checkDueReports();
  const now = new Date();

  for (const cadence of dueReports) {
    switch (cadence) {
      case 'daily': {
        // Generate yesterday's summary
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        await generateDailySummary(formatDate(yesterday));
        break;
      }
      case 'weekly': {
        // Generate last week's summary (start = 7 days ago)
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - 7);
        await generateWeeklySummary(weekStart);
        await sendReportNotification(
          'Weekly Report Ready',
          'Your weekly health summary is available. Tap to view.',
          'weekly-report',
        );
        break;
      }
      case 'monthly': {
        // Generate last month's summary
        const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        await generateMonthlySummary(year, lastMonth);
        await sendReportNotification(
          'Monthly Report Ready',
          'Your monthly health summary is available. Tap to view.',
          'monthly-report',
        );
        break;
      }
      case 'quarterly':
        await sendReportNotification(
          'Quarterly Report Ready',
          'Your 90-day health analysis is available.',
          'quarterly-report',
        );
        break;
      case 'semi_annual':
        await sendReportNotification(
          'Semi-Annual Report Ready',
          'Your 6-month comprehensive review is available.',
          'semi-annual-report',
        );
        break;
      case 'annual':
        await sendReportNotification(
          'Annual Report Ready',
          'Your year in review is available. Tap to see your progress.',
          'annual-report',
        );
        break;
      case 'yoy':
        await sendReportNotification(
          'Year-over-Year Comparison Ready',
          'See how this year compares to last year.',
          'yoy-report',
        );
        break;
    }
  }
}

async function sendReportNotification(
  title: string,
  body: string,
  type: string,
): Promise<void> {
  const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
  if (settings && !settings.notification_enabled) return;

  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { type },
      ...(Platform.OS === 'android' ? { channelId: 'reports' } : {}),
    },
    trigger: null, // Immediate
  });
}

/**
 * Check for celebration-worthy events and send notifications.
 */
export async function triggerCelebrationCheck(): Promise<void> {
  const now = new Date();
  const todayStr = formatDate(now);
  const events = await checkCelebrations(todayStr);

  for (const event of events) {
    const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
    if (settings && !settings.notification_enabled) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.detail,
        data: { type: 'celebration', trigger: event.trigger },
        ...(Platform.OS === 'android' ? { channelId: 'reports' } : {}),
      },
      trigger: null,
    });
  }
}

// ============================================================
// Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
