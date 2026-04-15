// Settings > Data Management
// Sprint 26: Clear all data (triple confirmation), clear individual types, storage usage

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { storageClearAll, storageList, storageDeleteMultiple, STORAGE_KEYS } from '../../src/utils/storage';
import { deleteSecure, setSecure, SECURE_KEYS } from '../../src/services/secureStorageService';
import { logAuditEvent } from '../../src/utils/audit';
import { cacheDirectory, deleteAsync, readDirectoryAsync } from 'expo-file-system/legacy';
import { storageGet } from '../../src/utils/storage';

interface DataCategory {
  id: string;
  label: string;
  icon: string;
  prefix: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', prefix: STORAGE_KEYS.LOG_SLEEP },
  { id: 'mood', label: 'Mood', icon: 'happy-outline', prefix: STORAGE_KEYS.LOG_MOOD },
  { id: 'mood_mental', label: 'Mood & Mental Health', icon: 'heart-outline', prefix: STORAGE_KEYS.LOG_MOOD_MENTAL },
  { id: 'food', label: 'Food', icon: 'restaurant-outline', prefix: STORAGE_KEYS.LOG_FOOD },
  { id: 'water', label: 'Water', icon: 'water-outline', prefix: STORAGE_KEYS.LOG_WATER },
  { id: 'caffeine', label: 'Caffeine', icon: 'cafe-outline', prefix: STORAGE_KEYS.LOG_CAFFEINE },
  { id: 'workout', label: 'Workouts', icon: 'fitness-outline', prefix: STORAGE_KEYS.LOG_WORKOUT },
  { id: 'strength', label: 'Strength', icon: 'barbell-outline', prefix: STORAGE_KEYS.LOG_STRENGTH },
  { id: 'steps', label: 'Steps', icon: 'walk-outline', prefix: STORAGE_KEYS.LOG_STEPS },
  { id: 'body', label: 'Body (Legacy)', icon: 'body-outline', prefix: STORAGE_KEYS.LOG_BODY },
  { id: 'body_measurements', label: 'Body Measurements', icon: 'resize-outline', prefix: STORAGE_KEYS.LOG_BODY_MEASUREMENTS },
  { id: 'medications', label: 'Medications', icon: 'medical-outline', prefix: STORAGE_KEYS.LOG_MEDICATIONS },
  { id: 'supplements', label: 'Supplements', icon: 'flask-outline', prefix: STORAGE_KEYS.LOG_SUPPLEMENTS },
  { id: 'cycle', label: 'Cycle', icon: 'calendar-outline', prefix: STORAGE_KEYS.LOG_CYCLE },
  { id: 'migraine', label: 'Migraines', icon: 'flash-outline', prefix: STORAGE_KEYS.LOG_MIGRAINE },
  { id: 'meditation', label: 'Meditation', icon: 'leaf-outline', prefix: STORAGE_KEYS.LOG_MEDITATION },
  { id: 'stress', label: 'Stress', icon: 'pulse-outline', prefix: STORAGE_KEYS.LOG_STRESS },
  { id: 'gratitude', label: 'Gratitude', icon: 'sparkles-outline', prefix: STORAGE_KEYS.LOG_GRATITUDE },
  { id: 'journal', label: 'Journal', icon: 'journal-outline', prefix: STORAGE_KEYS.LOG_JOURNAL },
  { id: 'therapy', label: 'Therapy', icon: 'chatbubble-outline', prefix: STORAGE_KEYS.LOG_THERAPY },
  { id: 'bloodwork', label: 'Bloodwork', icon: 'water-outline', prefix: STORAGE_KEYS.LOG_BLOODWORK },
  { id: 'glucose', label: 'Glucose', icon: 'analytics-outline', prefix: STORAGE_KEYS.LOG_GLUCOSE },
  { id: 'bp', label: 'Blood Pressure', icon: 'heart-circle-outline', prefix: STORAGE_KEYS.LOG_BP },
  { id: 'habits', label: 'Habits', icon: 'checkbox-outline', prefix: STORAGE_KEYS.LOG_HABITS },
  { id: 'substances', label: 'Substances', icon: 'warning-outline', prefix: STORAGE_KEYS.LOG_SUBSTANCES },
  { id: 'digestive', label: 'Digestive', icon: 'nutrition-outline', prefix: STORAGE_KEYS.LOG_DIGESTIVE },
  { id: 'injury', label: 'Injuries', icon: 'bandage-outline', prefix: STORAGE_KEYS.LOG_INJURY },
  { id: 'allergies', label: 'Allergies', icon: 'alert-circle-outline', prefix: STORAGE_KEYS.LOG_ALLERGIES },
];

export default function DataManagementScreen() {
  const [storageSize, setStorageSize] = useState<string | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const loadStorageInfo = useCallback(async () => {
    setLoading(true);
    try {
      // Estimate total storage size
      const allKeys = await AsyncStorage.getAllKeys();
      const dubKeys = allKeys.filter((k) => k.startsWith('dub.'));
      let totalBytes = 0;

      // Sample-based size estimation (read all keys but estimate based on raw string length)
      const pairs = await AsyncStorage.multiGet(dubKeys);
      for (const [, value] of pairs) {
        if (value) totalBytes += value.length * 2; // UTF-16
      }

      if (totalBytes < 1024) {
        setStorageSize(`${totalBytes} B`);
      } else if (totalBytes < 1024 * 1024) {
        setStorageSize(`${(totalBytes / 1024).toFixed(1)} KB`);
      } else {
        setStorageSize(`${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
      }

      // Count entries per category
      const counts: Record<string, number> = {};
      for (const cat of DATA_CATEGORIES) {
        const keys = dubKeys.filter((k) => k.startsWith(`${cat.prefix}.`));
        counts[cat.id] = keys.length;
      }
      setCategoryCounts(counts);
    } catch {
      setStorageSize('Unable to calculate');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  function handleClearCategory(cat: DataCategory) {
    const count = categoryCounts[cat.id] ?? 0;
    if (count === 0) {
      Alert.alert('No Data', `No ${cat.label.toLowerCase()} data to clear.`);
      return;
    }

    Alert.alert(
      `Clear ${cat.label} Data`,
      `This will permanently delete all ${cat.label.toLowerCase()} data (${count} entries). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Clear ${cat.label}`,
          style: 'destructive',
          onPress: async () => {
            setClearing(cat.id);
            try {
              const keys = await storageList(`${cat.prefix}.`);
              if (keys.length > 0) {
                await storageDeleteMultiple(keys);
              }
              await logAuditEvent('DATA_CLEAR_CATEGORY', { category: cat.id, keys_cleared: keys.length });
              await loadStorageInfo();
            } catch {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            } finally {
              setClearing(null);
            }
          },
        },
      ],
    );
  }

  function handleClearAll() {
    // Step 1: First confirmation
    Alert.alert(
      'Clear All Data',
      'Are you sure? This will permanently delete ALL your health data, profile, settings, and API key. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => showDeleteConfirmation(),
        },
      ],
    );
  }

  function showDeleteConfirmation() {
    // Step 2: Type DELETE to confirm — cross-platform Modal (Alert.prompt is iOS-only)
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  }

  function handleDeleteModalConfirm() {
    setShowDeleteModal(false);
    if (deleteConfirmText.trim() === 'DELETE') {
      showFinalConfirmation();
    } else {
      Alert.alert('Cancelled', 'You must type DELETE exactly to proceed.');
    }
  }

  function showFinalConfirmation() {
    // Step 3: Final confirmation
    Alert.alert(
      'Final Confirmation',
      'All your DUB Tracker data will be permanently deleted. The app will restart at onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            setClearing('all');
            try {
              await logAuditEvent('DATA_DELETION_INITIATED', {});

              // Clean cached photo files
              try {
                const foodKeys = await storageList('dub.log.food.');
                for (const key of foodKeys) {
                  const raw = await storageGet<Array<{ photo_uri?: string | null }>>(key);
                  if (raw) {
                    for (const entry of raw) {
                      if (entry.photo_uri) {
                        await deleteAsync(entry.photo_uri, { idempotent: true }).catch(() => {});
                      }
                    }
                  }
                }
                if (cacheDirectory) {
                  const cacheFiles = await readDirectoryAsync(cacheDirectory).catch(() => [] as string[]);
                  for (const file of cacheFiles) {
                    if (file.match(/\.(jpg|jpeg|png|heic)$/i)) {
                      await deleteAsync(cacheDirectory + file, { idempotent: true }).catch(() => {});
                    }
                  }
                }
              } catch {
                // Best-effort photo cleanup
              }

              // Clear all AsyncStorage dub.* keys
              await storageClearAll();

              // Clear all secure store keys
              try {
                await deleteSecure(SECURE_KEYS.ANTHROPIC_API_KEY);
                await deleteSecure(SECURE_KEYS.APP_LOCK_ENABLED);
                await deleteSecure(SECURE_KEYS.AUTH_PIN_HASH);
                await deleteSecure(SECURE_KEYS.AUTH_METHOD);
                await deleteSecure(SECURE_KEYS.USER_SEX);
                await deleteSecure(SECURE_KEYS.ONBOARDING_COMPLETE);
                await deleteSecure(SECURE_KEYS.CONSENT_RECORD);
                await deleteSecure('dub.lock_timeout' as any);
              } catch {
                // Keys may not exist
              }

              await logAuditEvent('DATA_DELETION_COMPLETED', {});

              // CCPA: Store deletion confirmation
              const deletionTimestamp = new Date().toISOString();
              await setSecure('dub_ai_deletion_confirmed' as any, deletionTimestamp);

              Alert.alert(
                'Data Deleted',
                'All your DUB Tracker data has been permanently deleted. The app will restart at onboarding.',
                [{ text: 'OK', onPress: () => router.replace('/onboarding') }],
              );
            } catch {
              Alert.alert('Error', 'Failed to delete data. Please try again.');
            } finally {
              setClearing(null);
            }
          },
        },
      ],
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Data Management</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Storage Usage */}
        <View style={styles.storageCard}>
          <Ionicons name="server-outline" size={22} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.storageLabel}>Storage Usage</Text>
            <Text style={styles.storageValue}>
              {loading ? 'Calculating...' : storageSize}
            </Text>
          </View>
        </View>

        {/* Clear Individual Data Types */}
        <Text style={styles.sectionTitle}>Clear Individual Data</Text>
        <Text style={styles.sectionDesc}>
          Remove specific data types while keeping the rest of your data intact.
        </Text>

        {DATA_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.id] ?? 0;
          const isClearing = clearing === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={styles.categoryRow}
              onPress={() => handleClearCategory(cat)}
              disabled={isClearing || count === 0}
              activeOpacity={0.7}
            >
              <Ionicons name={cat.icon as any} size={20} color={count > 0 ? Colors.accent : Colors.secondaryText} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.categoryLabel, count === 0 && { color: Colors.secondaryText }]}>
                  {cat.label}
                </Text>
                <Text style={styles.categoryCount}>
                  {count} {count === 1 ? 'entry' : 'entries'}
                </Text>
              </View>
              {isClearing ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : count > 0 ? (
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              ) : null}
            </TouchableOpacity>
          );
        })}

        {/* Clear All Data */}
        <Text style={[styles.sectionTitle, { color: Colors.dangerText, marginTop: 24 }]}>
          Danger Zone
        </Text>
        <TouchableOpacity
          style={styles.deleteCard}
          onPress={handleClearAll}
          disabled={clearing === 'all'}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color={Colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.deleteLabel}>Clear All Data</Text>
            <Text style={styles.deleteDesc}>
              Permanently delete all stored data, settings, and API key. Requires triple confirmation.
            </Text>
          </View>
          {clearing === 'all' ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={Colors.danger} />
          )}
        </TouchableOpacity>

        <Text style={styles.auditNote}>
          Audit logs are retained for compliance even after data deletion, as disclosed
          in the privacy policy. Audit logs contain no health data.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Cross-platform DELETE confirmation modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Type DELETE to Confirm</Text>
            <Text style={styles.modalDesc}>
              To permanently delete all data, type DELETE below.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor={Colors.secondaryText}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowDeleteModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleDeleteModalConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.modalConfirmText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  storageLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  storageValue: { color: Colors.secondaryText, fontSize: 13, marginTop: 2 },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionDesc: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    gap: 12,
    marginBottom: 6,
  },
  categoryLabel: { color: Colors.text, fontSize: 14, fontWeight: '500' },
  categoryCount: { color: Colors.secondaryText, fontSize: 12, marginTop: 1 },
  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  deleteLabel: { color: Colors.dangerText, fontSize: 15, fontWeight: '600' },
  deleteDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  auditNote: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 8 },
  modalDesc: { color: Colors.secondaryText, fontSize: 14, marginBottom: 16 },
  modalInput: {
    backgroundColor: Colors.primaryBackground,
    color: Colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 12 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 16 },
  modalCancelText: { color: Colors.accent, fontSize: 15, fontWeight: '600' },
  modalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.danger,
    borderRadius: 8,
  },
  modalConfirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
