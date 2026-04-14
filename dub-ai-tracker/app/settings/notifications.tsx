// Settings > Notification Preferences
// Sprint 24: Enhanced with per-type reminder controls, time pickers, water interval, test button
// Phase 17 legacy: EOD questionnaire, tier-based reminders, celebrations

import { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { PremiumCard } from '../../src/components/common/PremiumCard';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getTierDefinition } from '../../src/constants/tiers';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import { EODQuestionnaire } from '../../src/components/notifications/EODQuestionnaire';
import type { EngagementTier, AppSettings } from '../../src/types/profile';
import type { NotificationSettings, WaterReminderInterval } from '../../src/types';
import { hapticSelection, hapticSuccess } from '../../src/utils/haptics';
import { useToast } from '../../src/contexts/ToastContext';
import {
  getNotificationSettings,
  saveNotificationSettings,
  syncAllReminders,
  sendTestNotification,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../../src/utils/notificationScheduler';
import { requestPermissions } from '../../src/services/notifications';

const WATER_INTERVAL_OPTIONS: { value: WaterReminderInterval; label: string }[] = [
  { value: 1, label: 'Every hour' },
  { value: 2, label: 'Every 2 hours' },
  { value: 3, label: 'Every 3 hours' },
];

export default function NotificationsScreen() {
  const [tier, setTier] = useState<EngagementTier>('balanced');
  const [tierLoading, setTierLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Celebration toggles (default ON)
  const [celebrationsWeight, setCelebrationsWeight] = useState(true);
  const [celebrationsStreaks, setCelebrationsStreaks] = useState(true);
  const [celebrationsPrs, setCelebrationsPrs] = useState(true);

  const { showToast } = useToast();

  const {
    enabled: notifEnabled,
    eodEnabled,
    remindersEnabled,
    permissionGranted,
    unloggedTags,
    showEOD,
    eodTime,
    loading: notifLoading,
    setEnabled: setNotifEnabled,
    setEodEnabled,
    setRemindersEnabled,
    openEOD,
    dismissEOD,
    refreshUnlogged,
  } = useNotifications();

  const loadData = useCallback(async () => {
    const [t, appSettings, notifSettings] = await Promise.all([
      storageGet<EngagementTier>(STORAGE_KEYS.TIER),
      storageGet<AppSettings>(STORAGE_KEYS.SETTINGS),
      getNotificationSettings(),
    ]);
    setTier(t || 'balanced');
    if (appSettings?.celebrations_weight === false) setCelebrationsWeight(false);
    if (appSettings?.celebrations_streaks === false) setCelebrationsStreaks(false);
    if (appSettings?.celebrations_prs === false) setCelebrationsPrs(false);
    setSettings(notifSettings);
    setTierLoading(false);
    setSettingsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData]),
  );

  const updateSettings = useCallback(async (updates: Partial<NotificationSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await saveNotificationSettings(newSettings);
    await syncAllReminders();
  }, [settings]);

  const handleTestNotification = useCallback(async () => {
    hapticSuccess();
    const granted = await requestPermissions();
    if (!granted) {
      showToast('Notification permission not granted', 'error');
      return;
    }
    await sendTestNotification();
    showToast('Test notification sent!', 'success');
  }, [showToast]);

  const tierDef = getTierDefinition(tier);
  const loading = notifLoading || tierLoading || settingsLoading;

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
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {!permissionGranted && notifEnabled && (
        <View style={styles.warningBox}>
          <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
          <Text style={styles.warningText}>
            Notification permission not granted. Enable notifications in your device settings.
          </Text>
        </View>
      )}

      {/* Master Toggle */}
      <PremiumCard>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable All Notifications</Text>
            <Text style={styles.settingDesc}>Master toggle for all DUB notifications</Text>
          </View>
          <Switch
            value={settings.master_enabled}
            onValueChange={async (val) => {
              hapticSelection();
              await updateSettings({ master_enabled: val });
              await setNotifEnabled(val);
            }}
            trackColor={{ false: Colors.divider, true: Colors.accent }}
            thumbColor={Colors.text}
          />
        </View>
      </PremiumCard>

      {settings.master_enabled && (
        <>
          {/* Sprint 24: Reminder Types */}
          <Text style={styles.sectionTitle}>Reminder Types</Text>

          {/* Daily Logging */}
          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Daily Logging Reminder</Text>
                <Text style={styles.settingDesc}>
                  "{`Time to log your day in DUB`}" at {settings.daily_logging.time}
                </Text>
              </View>
              <Switch
                value={settings.daily_logging.enabled}
                onValueChange={(val) => {
                  hapticSelection();
                  updateSettings({ daily_logging: { ...settings.daily_logging, enabled: val } });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
            {settings.daily_logging.enabled && (
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
                <Text style={styles.timeLabel}>Time: {formatTime24to12(settings.daily_logging.time)}</Text>
              </View>
            )}
          </PremiumCard>

          {/* Morning Check-in */}
          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Morning Check-in</Text>
                <Text style={styles.settingDesc}>
                  "{`Good morning! How did you sleep?`}" — links to sleep logger
                </Text>
              </View>
              <Switch
                value={settings.morning_checkin.enabled}
                onValueChange={(val) => {
                  hapticSelection();
                  updateSettings({ morning_checkin: { ...settings.morning_checkin, enabled: val } });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
            {settings.morning_checkin.enabled && (
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
                <Text style={styles.timeLabel}>Time: {formatTime24to12(settings.morning_checkin.time)}</Text>
              </View>
            )}
          </PremiumCard>

          {/* Medication Reminders */}
          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Medication Reminders</Text>
                <Text style={styles.settingDesc}>
                  One notification per medication at its scheduled time
                </Text>
              </View>
              <Switch
                value={settings.medication_reminders.enabled}
                onValueChange={(val) => {
                  hapticSelection();
                  updateSettings({ medication_reminders: { enabled: val } });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          </PremiumCard>

          {/* Water Reminders */}
          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Water Reminders</Text>
                <Text style={styles.settingDesc}>
                  "{`Stay hydrated! Log your water intake`}"
                </Text>
              </View>
              <Switch
                value={settings.water_reminders.enabled}
                onValueChange={(val) => {
                  hapticSelection();
                  updateSettings({ water_reminders: { ...settings.water_reminders, enabled: val } });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
            {settings.water_reminders.enabled && (
              <>
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalLabel}>Interval:</Text>
                  {WATER_INTERVAL_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.intervalBtn,
                        settings.water_reminders.interval_hours === opt.value && styles.intervalBtnActive,
                      ]}
                      onPress={() => {
                        hapticSelection();
                        updateSettings({
                          water_reminders: { ...settings.water_reminders, interval_hours: opt.value },
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.intervalBtnText,
                          settings.water_reminders.interval_hours === opt.value && styles.intervalBtnTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.timeRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.secondaryText} />
                  <Text style={styles.timeLabel}>
                    {formatTime24to12(settings.water_reminders.start_time)} to {formatTime24to12(settings.water_reminders.end_time)}
                  </Text>
                </View>
              </>
            )}
          </PremiumCard>

          {/* Doctor Follow-up */}
          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Doctor Follow-up Reminders</Text>
                <Text style={styles.settingDesc}>
                  One-time reminder on follow-up dates at 9:00 AM
                </Text>
              </View>
              <Switch
                value={settings.doctor_followup.enabled}
                onValueChange={(val) => {
                  hapticSelection();
                  updateSettings({ doctor_followup: { enabled: val } });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          </PremiumCard>

          {/* Test notification */}
          <TouchableOpacity
            style={styles.testBtn}
            onPress={handleTestNotification}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={18} color={Colors.accent} />
            <Text style={styles.testBtnText}>Send Test Notification</Text>
          </TouchableOpacity>

          {/* Existing Phase 15/17 toggles */}
          <Text style={styles.sectionTitle}>Legacy Reminders</Text>

          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Evening Check-in</Text>
                <Text style={styles.settingDesc}>
                  End-of-day questionnaire for unlogged tags
                  {eodTime ? ` — ${formatTime(eodTime.hour, eodTime.minute)}` : ''}
                </Text>
              </View>
              <Switch
                value={eodEnabled}
                onValueChange={setEodEnabled}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          </PremiumCard>

          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Tier-based Daily Reminders</Text>
                <Text style={styles.settingDesc}>
                  {tierDef.name} tier: {tierDef.notificationCadence}
                </Text>
              </View>
              <Switch
                value={remindersEnabled}
                onValueChange={setRemindersEnabled}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          </PremiumCard>

          {/* Celebrations */}
          <Text style={styles.sectionTitle}>Celebrations</Text>

          <PremiumCard>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Weight Milestones</Text>
              </View>
              <Switch
                value={celebrationsWeight}
                onValueChange={async (val) => {
                  setCelebrationsWeight(val);
                  const s = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
                  await storageSet(STORAGE_KEYS.SETTINGS, { ...s, celebrations_weight: val });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Streak Achievements</Text>
              </View>
              <Switch
                value={celebrationsStreaks}
                onValueChange={async (val) => {
                  setCelebrationsStreaks(val);
                  const s = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
                  await storageSet(STORAGE_KEYS.SETTINGS, { ...s, celebrations_streaks: val });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Personal Records</Text>
              </View>
              <Switch
                value={celebrationsPrs}
                onValueChange={async (val) => {
                  setCelebrationsPrs(val);
                  const s = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || {} as AppSettings;
                  await storageSet(STORAGE_KEYS.SETTINGS, { ...s, celebrations_prs: val });
                }}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
          </PremiumCard>

          {/* EOD Preview */}
          <TouchableOpacity style={styles.eodButton} onPress={openEOD} activeOpacity={0.7}>
            <Ionicons name="moon-outline" size={18} color={Colors.accent} />
            <Text style={styles.eodButtonText}>
              Preview Evening Check-in ({unloggedTags.length} unlogged categor
              {unloggedTags.length !== 1 ? 'ies' : 'y'})
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
          </TouchableOpacity>
        </>
      )}

      <Modal visible={showEOD} animationType="slide" presentationStyle="fullScreen">
        <EODQuestionnaire
          unloggedTags={unloggedTags}
          onDismiss={dismissEOD}
          onRefresh={refreshUnlogged}
        />
      </Modal>
    </ScrollView>
    </ScreenWrapper>
  );
}

function formatTime(hour: number, minute: number): string {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function formatTime24to12(time24: string): string {
  const { hour, minute } = parseTime24(time24);
  return formatTime(hour, minute);
}

function parseTime24(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
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
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  warningText: { color: Colors.warning, fontSize: 13, lineHeight: 18, flex: 1 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  settingDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2, lineHeight: 16 },
  divider: { height: 1, backgroundColor: Colors.divider, marginVertical: 8 },

  // Time display
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingLeft: 4,
  },
  timeLabel: { color: Colors.secondaryText, fontSize: 13 },

  // Water interval
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  intervalLabel: { color: Colors.secondaryText, fontSize: 13 },
  intervalBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  intervalBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  intervalBtnText: { color: Colors.secondaryText, fontSize: 12, fontWeight: '500' },
  intervalBtnTextActive: { color: Colors.primaryBackground },

  // Test button
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  testBtnText: { color: Colors.accentText, fontSize: 14, fontWeight: '600' },

  // EOD button
  eodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  eodButtonText: { color: Colors.accentText, fontSize: 14, fontWeight: '600', flex: 1 },
});
