// Sprint 24: Notification Service — app-level orchestration
// Handles permission requests, app launch sync, category-aware cancellation

import { requestPermissions, configureNotifications } from './notifications';
import {
  configureReminderChannels,
  syncAllReminders,
  clearBadgeCount,
  getNotificationSettings,
  cancelMedicationReminders,
  scheduleMedicationReminders,
} from '../utils/notificationScheduler';
import { isCategoryEnabled } from '../utils/categoryElection';

/**
 * Initialize notifications on first app launch (after onboarding).
 * Requests permission, configures channels, schedules defaults.
 * If user declines, respects it — no nag loop.
 */
export async function initializeNotifications(): Promise<boolean> {
  const granted = await requestPermissions();
  if (!granted) return false;

  await configureNotifications();
  await configureReminderChannels();
  await syncAllReminders();
  return true;
}

/**
 * Called on every app launch to re-sync notifications.
 * iOS clears local notifications on app update, so re-registration is required.
 * Also clears badge count.
 */
export async function onAppLaunchSync(): Promise<void> {
  await clearBadgeCount();

  const settings = await getNotificationSettings();
  if (!settings.master_enabled) return;

  await configureReminderChannels();
  await syncAllReminders();
}

/**
 * Called when user edits their medication list.
 * Cancels existing medication notifications and reschedules with new list.
 */
export async function onMedicationListChanged(): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.master_enabled || !settings.medication_reminders.enabled) return;

  const medEnabled = await isCategoryEnabled('medication_tracking');
  if (!medEnabled) {
    await cancelMedicationReminders();
    return;
  }

  await scheduleMedicationReminders();
}

/**
 * Called when a category is disabled in the election system.
 * Cancels any category-specific notifications.
 */
export async function onCategoryDisabled(categoryId: string): Promise<void> {
  if (categoryId === 'medication_tracking') {
    await cancelMedicationReminders();
  }
  // cycle_tracking doesn't have its own notifications (uses daily logging reminder)
}

/**
 * Called when a category is enabled in the election system.
 * Schedules category-specific notifications if applicable.
 */
export async function onCategoryEnabled(categoryId: string): Promise<void> {
  const settings = await getNotificationSettings();
  if (!settings.master_enabled) return;

  if (categoryId === 'medication_tracking' && settings.medication_reminders.enabled) {
    await scheduleMedicationReminders();
  }
}
