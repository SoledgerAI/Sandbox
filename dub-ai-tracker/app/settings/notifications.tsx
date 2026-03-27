// Settings > Notification Preferences
// Phase 17: Settings and Profile Management
// All preferences from onboarding Step 6, plus per-type toggles

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { useNotifications } from '../../src/hooks/useNotifications';
import { getTierDefinition } from '../../src/constants/tiers';
import { storageGet, STORAGE_KEYS } from '../../src/utils/storage';
import { EODQuestionnaire } from '../../src/components/notifications/EODQuestionnaire';
import type { EngagementTier } from '../../src/types/profile';

export default function NotificationsScreen() {
  const [tier, setTier] = useState<EngagementTier>('balanced');
  const [tierLoading, setTierLoading] = useState(true);

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

  useEffect(() => {
    async function loadTier() {
      const t = await storageGet<EngagementTier>(STORAGE_KEYS.TIER);
      setTier(t || 'balanced');
      setTierLoading(false);
    }
    loadTier();
  }, []);

  const tierDef = getTierDefinition(tier);
  const loading = notifLoading || tierLoading;

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
      <View style={styles.settingRow}>
        <View style={styles.settingInfo}>
          <Text style={styles.settingLabel}>Enable Notifications</Text>
          <Text style={styles.settingDesc}>Master toggle for all DUB notifications</Text>
        </View>
        <Switch
          value={notifEnabled}
          onValueChange={setNotifEnabled}
          trackColor={{ false: Colors.divider, true: Colors.accent }}
          thumbColor={Colors.text}
        />
      </View>

      {notifEnabled && (
        <>
          {/* Tier Cadence Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.infoText}>
              Your {tierDef.name} tier sends {tierDef.notificationCadence}.
            </Text>
          </View>

          {/* Per-type Toggles */}
          <Text style={styles.sectionTitle}>Notification Types</Text>

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

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Reminders</Text>
              <Text style={styles.settingDesc}>
                Tier-based logging reminders throughout the day
              </Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={setRemindersEnabled}
              trackColor={{ false: Colors.divider, true: Colors.accent }}
              thumbColor={Colors.text}
            />
          </View>

          {/* Cadence Preview */}
          <Text style={styles.sectionTitle}>Cadence Preview</Text>
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>
              Based on your {tierDef.name} tier:
            </Text>
            <Text style={styles.previewCadence}>{tierDef.notificationCadence}</Text>
            <View style={styles.previewItems}>
              {tierDef.notificationsPerDay[0] >= 6 && (
                <>
                  <PreviewItem label="Hydration reminders" />
                  <PreviewItem label="Meal window alerts" />
                  <PreviewItem label="Macro check-ins" />
                  <PreviewItem label="End-of-day review" />
                </>
              )}
              {tierDef.notificationsPerDay[0] >= 3 && tierDef.notificationsPerDay[0] < 6 && (
                <>
                  <PreviewItem label="Morning overview" />
                  <PreviewItem label="Meal window reminders" />
                  <PreviewItem label="End-of-day review" />
                </>
              )}
              {tierDef.notificationsPerDay[0] < 3 && (
                <>
                  <PreviewItem label="Morning check-in" />
                  <PreviewItem label="End-of-day summary" />
                </>
              )}
            </View>
          </View>

          {/* EOD Preview */}
          <TouchableOpacity style={styles.eodButton} onPress={openEOD} activeOpacity={0.7}>
            <Ionicons name="moon-outline" size={18} color={Colors.accent} />
            <Text style={styles.eodButtonText}>
              Preview Evening Check-in ({unloggedTags.length} unlogged tag
              {unloggedTags.length !== 1 ? 's' : ''})
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
  );
}

function PreviewItem({ label }: { label: string }) {
  return (
    <View style={styles.previewItem}>
      <View style={styles.previewDot} />
      <Text style={styles.previewItemText}>{label}</Text>
    </View>
  );
}

function formatTime(hour: number, minute: number): string {
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  settingDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoText: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 10,
  },
  previewBox: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewTitle: { color: Colors.text, fontSize: 14, fontWeight: '500', marginBottom: 4 },
  previewCadence: { color: Colors.accent, fontSize: 16, fontWeight: '600', marginBottom: 12 },
  previewItems: { gap: 6 },
  previewItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  previewItemText: { color: Colors.secondaryText, fontSize: 13 },
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
  },
  eodButtonText: { color: Colors.accent, fontSize: 14, fontWeight: '600', flex: 1 },
});
