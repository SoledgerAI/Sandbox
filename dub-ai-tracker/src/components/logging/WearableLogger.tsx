// Sprint 31 Commit 2: Wearable scan logger.
// Photo-library scan of a Garmin / Oura / WHOOP morning report,
// then ToolConfirmationCard for review/edit, then writes
// log_recovery_metrics via executeToolBatch. Date is sourced
// from the banner (DateContextBanner) — the route sets it to
// yesterday on mount, the user can adjust before scanning.

import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Colors } from '../../constants/colors';
import { stripExifMetadata } from '../../utils/imagePrivacy';
import { getApiKey, AnthropicError } from '../../services/anthropic';
import { getActiveDate } from '../../services/dateContextService';
import {
  scanWearableScreenshot,
  type WearableScanData,
  type WearableFieldFlag,
} from '../../services/wearableScanService';
import { executeToolBatch } from '../../services/coachToolExecutor';
import { ToolConfirmationCard } from '../coach/ToolConfirmationCard';
import type { ToolUseRequest } from '../../types/coach';

type CompoundFlags = Record<string, WearableFieldFlag>;

function activeDateAsDate(): Date {
  // getActiveDate() returns YYYY-MM-DD; anchor at noon local so the
  // local-day getters in deriveRecoveryDateKey resolve correctly
  // regardless of the user's timezone.
  return new Date(`${getActiveDate()}T12:00:00`);
}

export function mintSyntheticToolUseId(): string {
  // Math.random().toString(36) can occasionally yield <22 chars when the
  // random value has trailing zeros, so loop until we have enough.
  let rand = '';
  while (rand.length < 22) {
    rand += Math.random().toString(36).slice(2);
  }
  return `toolu_${rand.slice(0, 22)}`;
}

export function buildRecoveryToolRequest(
  data: WearableScanData,
  forDate: Date,
): ToolUseRequest {
  const input: Record<string, unknown> = {
    timestamp: forDate.toISOString(),
    extraction_source: 'wearable_scan',
  };
  if (data.sleep_score) input.sleep_score = data.sleep_score.value;
  if (data.sleep_duration_hours) input.sleep_duration_hours = data.sleep_duration_hours.value;
  if (data.hrv_ms) input.hrv_ms = data.hrv_ms.value;
  if (data.body_battery) input.body_battery = data.body_battery.value;
  if (data.stress_baseline) input.stress_baseline = data.stress_baseline.value;
  if (data.training_readiness) input.training_readiness = data.training_readiness.value;
  if (data.vo2_max) input.vo2_max = data.vo2_max.value;
  if (data.resting_heart_rate) input.resting_heart_rate = data.resting_heart_rate.value;
  return {
    toolUseId: mintSyntheticToolUseId(),
    name: 'log_recovery_metrics',
    input,
    status: 'pending',
    tier: 'checklist',
  };
}

export function toCompoundKeyFlags(
  toolUseId: string,
  bareFlags: Record<string, WearableFieldFlag>,
): CompoundFlags {
  const out: CompoundFlags = {};
  for (const [field, flag] of Object.entries(bareFlags)) {
    out[`${toolUseId}.${field}`] = flag;
  }
  return out;
}

export function WearableLogger() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [logging, setLogging] = useState(false);
  const [toolRequest, setToolRequest] = useState<ToolUseRequest | null>(null);
  const [fieldFlags, setFieldFlags] = useState<CompoundFlags | undefined>(undefined);

  const resetScan = useCallback(() => {
    setPhotoUri(null);
    setToolRequest(null);
    setFieldFlags(undefined);
  }, []);

  const runScan = useCallback(async (localUri: string) => {
    setScanning(true);
    try {
      const stripped = await stripExifMetadata(localUri, 0.7);
      const base64 = await readAsStringAsync(stripped, { encoding: EncodingType.Base64 });
      const result = await scanWearableScreenshot(base64, 'image/jpeg');
      if (!result.ok) {
        Alert.alert(
          "Couldn't read screenshot",
          'Try a clearer image or pick a different photo.',
        );
        setPhotoUri(null);
        return;
      }
      if (result.data.fields_extracted.length === 0) {
        Alert.alert(
          "Couldn't read screenshot",
          'No recovery fields were detected. Try a different photo.',
        );
        setPhotoUri(null);
        return;
      }
      const req = buildRecoveryToolRequest(result.data, activeDateAsDate());
      setToolRequest(req);
      if (result.fieldFlags) {
        setFieldFlags(toCompoundKeyFlags(req.toolUseId, result.fieldFlags));
      } else {
        setFieldFlags(undefined);
      }
    } catch (error) {
      if (error instanceof AnthropicError) {
        Alert.alert('Scan failed', error.message);
      } else {
        Alert.alert(
          "Couldn't read screenshot",
          'Try a clearer image or pick a different photo.',
        );
      }
      setPhotoUri(null);
    } finally {
      setScanning(false);
    }
  }, []);

  const pickPhotoAndScan = useCallback(async () => {
    if (scanning || logging) return;
    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert(
        'API Key Required',
        'Set up your API key in Settings to scan wearable screenshots.',
      );
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to scan your wearable screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
    await runScan(result.assets[0].uri);
  }, [scanning, logging, runScan]);

  const handleLogAll = useCallback(async (checkedTools: ToolUseRequest[]) => {
    if (logging || checkedTools.length === 0) return;
    setLogging(true);
    try {
      const results = await executeToolBatch(checkedTools, 'wearable scan');
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) {
        Alert.alert('Could not log', failed.error);
        return;
      }
      router.back();
    } finally {
      setLogging(false);
    }
  }, [logging]);

  return (
    <View style={styles.container}>
      {!toolRequest && (
        <View style={styles.pickerCard}>
          <Ionicons name="watch-outline" size={42} color={Colors.accent} />
          <Text style={styles.headline}>Scan a wearable screenshot</Text>
          <Text style={styles.subtext}>
            Pick a Garmin, Oura, or WHOOP morning-report screenshot from your photo library.
          </Text>

          {photoUri && !scanning && (
            <Image source={{ uri: photoUri }} style={styles.thumbnail} />
          )}

          {scanning && (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.scanningText}>Reading screenshot…</Text>
            </View>
          )}

          {!scanning && (
            <Pressable
              style={styles.primaryBtn}
              onPress={pickPhotoAndScan}
              accessibilityRole="button"
              accessibilityLabel="Choose photo to scan"
            >
              <Ionicons name="image-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>
                {photoUri ? 'Choose Different Photo' : 'Choose Photo'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {toolRequest && (
        <View style={styles.cardWrap}>
          <ToolConfirmationCard
            tools={[toolRequest]}
            onLogAll={handleLogAll}
            onCancel={resetScan}
            fieldFlags={fieldFlags}
          />
          {logging && (
            <View style={styles.scanningRow}>
              <ActivityIndicator size="small" color={Colors.accent} />
              <Text style={styles.scanningText}>Saving…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pickerCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 12,
  },
  headline: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtext: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  thumbnail: {
    width: 120,
    height: 120,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanningText: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  cardWrap: {
    gap: 8,
  },
});
