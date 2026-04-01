// Settings > Profile Edit
// Phase 17: Settings and Profile Management
// Per Section 8 Step 1: Edit all fields from onboarding Step 1

import { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Input } from '../../src/components/common/Input';
import { Button } from '../../src/components/common/Button';
import { DateTimePicker } from '../../src/components/common/DateTimePicker';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type {
  UserProfile,
  UnitPreference,
  BiologicalSex,
  ActivityLevel,
  AppSettings,
} from '../../src/types/profile';

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly Active' },
  { value: 'moderately_active', label: 'Moderately Active' },
  { value: 'very_active', label: 'Very Active' },
  { value: 'extremely_active', label: 'Extremely Active' },
];

const SEX_OPTIONS: { value: BiologicalSex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [dobDate, setDobDate] = useState<Date>(new Date(1990, 0, 1));
  const [, setDobSet] = useState(false);
  const [units, setUnits] = useState<UnitPreference>('imperial');
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weight, setWeight] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [altitudeAcclimated, setAltitudeAcclimated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const p = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
    if (p) {
      setProfile(p);
      setName(p.name || '');
      if (p.dob) {
        // Parse "YYYY-MM-DD" without timezone shift
        const [y, m, d] = p.dob.split('-').map(Number);
        setDobDate(new Date(y, m - 1, d));
        setDobSet(true);
      }
      setUnits(p.units || 'imperial');
      setSex(p.sex || null);
      if (p.height_inches != null) {
        if (p.units === 'metric') {
          setHeightCm(String(Math.round(p.height_inches * 2.54)));
        } else {
          setHeightFeet(String(Math.floor(p.height_inches / 12)));
          setHeightInches(String(p.height_inches % 12));
        }
      }
      if (p.weight_lbs != null) {
        if (p.units === 'metric') {
          setWeight(String(Math.round(p.weight_lbs * 0.453592 * 10) / 10));
        } else {
          setWeight(String(p.weight_lbs));
        }
      }
      setActivityLevel(p.activity_level || null);
      setAltitudeAcclimated(p.altitude_acclimated || false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // MASTER-38: Age gate re-validation — same check as onboarding ProfileStep
  function getAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';

    // MASTER-38: Reject DOB changes that make user under 18
    if (getAge(dobDate) < 18) {
      newErrors.dob = 'DUB_AI Tracker is designed for adults 18 and older.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    // Store DOB as plain "YYYY-MM-DD" — no UTC conversion
    const dobString = `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}`;

    // Convert height to inches for storage
    let heightInchesVal: number | null = null;
    if (units === 'metric' && heightCm) {
      heightInchesVal = Math.round(parseFloat(heightCm) / 2.54);
    } else if (heightFeet || heightInches) {
      heightInchesVal = (parseInt(heightFeet, 10) || 0) * 12 + (parseInt(heightInches, 10) || 0);
    }

    // Convert weight to lbs for storage
    let weightLbs: number | null = null;
    if (weight) {
      if (units === 'metric') {
        weightLbs = Math.round(parseFloat(weight) / 0.453592 * 10) / 10;
      } else {
        weightLbs = parseFloat(weight);
      }
    }

    const updatedProfile: UserProfile = {
      ...(profile || {
        name: '',
        dob: '',
        units: 'imperial',
        sex: null,
        height_inches: null,
        weight_lbs: null,
        activity_level: null,
        goal: null,
        altitude_acclimated: false,
      }),
      name: name.trim(),
      dob: dobString,
      units,
      sex,
      height_inches: heightInchesVal,
      weight_lbs: weightLbs,
      activity_level: activityLevel,
      altitude_acclimated: altitudeAcclimated,
    };

    await storageSet(STORAGE_KEYS.PROFILE, updatedProfile);

    // Sync units to AppSettings
    const settings = await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS);
    if (settings) {
      await storageSet(STORAGE_KEYS.SETTINGS, { ...settings, units });
    }

    setSaving(false);
    Alert.alert('Profile Updated', 'Your profile has been saved.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.primaryBackground }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Profile photo placeholder */}
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={() =>
          Alert.alert(
            'Profile Photo',
            'Coming in a future update. Your profile photo will appear here and on the Settings screen.',
            [{ text: 'OK' }],
          )
        }
        activeOpacity={0.7}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>
            {name.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.cameraIcon}>
          <Ionicons name="camera" size={14} color={Colors.primaryBackground} />
        </View>
      </TouchableOpacity>

      <Input
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        error={errors.name}
      />

      <DateTimePicker
        label="Date of Birth"
        mode="date"
        value={dobDate}
        onChange={(d) => {
          setDobDate(d);
          setDobSet(true);
        }}
        minimumDate={new Date(1920, 0, 1)}
        maximumDate={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate())}
      />
      {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}

      <Text style={styles.label}>Units</Text>
      <View style={styles.optionRow}>
        <TouchableOpacity
          style={[styles.option, units === 'imperial' && styles.optionSelected]}
          onPress={() => setUnits('imperial')}
        >
          <Text style={[styles.optionText, units === 'imperial' && styles.optionTextSelected]}>
            Imperial (lbs, ft)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, units === 'metric' && styles.optionSelected]}
          onPress={() => setUnits('metric')}
        >
          <Text style={[styles.optionText, units === 'metric' && styles.optionTextSelected]}>
            Metric (kg, cm)
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Biological Sex</Text>
      <View style={styles.optionRow}>
        {SEX_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, sex === opt.value && styles.optionSelected, { flex: 1 }]}
            onPress={() => setSex(opt.value)}
          >
            <Text style={[styles.optionText, sex === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {units === 'metric' ? (
        <Input
          label="Height (cm)"
          value={heightCm}
          onChangeText={(t) => setHeightCm(t.replace(/[^\d.]/g, ''))}
          keyboardType="numeric"
          placeholder="170"
        />
      ) : (
        <>
          <Text style={styles.label}>Height</Text>
          <View style={styles.dobRow}>
            <Input
              placeholder="ft"
              value={heightFeet}
              onChangeText={(t) => setHeightFeet(t.replace(/\D/g, '').slice(0, 1))}
              keyboardType="number-pad"
              maxLength={1}
              style={styles.dobInput}
            />
            <Text style={styles.dobSeparator}>ft</Text>
            <Input
              placeholder="in"
              value={heightInches}
              onChangeText={(t) => setHeightInches(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
              style={styles.dobInput}
            />
            <Text style={styles.dobSeparator}>in</Text>
          </View>
        </>
      )}

      <Input
        label={units === 'metric' ? 'Weight (kg)' : 'Weight (lbs)'}
        value={weight}
        onChangeText={(t) => setWeight(t.replace(/[^\d.]/g, ''))}
        keyboardType="numeric"
        placeholder={units === 'metric' ? '75' : '165'}
      />

      <Text style={styles.label}>Activity Level</Text>
      {ACTIVITY_LEVELS.map((level) => (
        <TouchableOpacity
          key={level.value}
          style={[styles.activityOption, activityLevel === level.value && styles.activitySelected]}
          onPress={() => setActivityLevel(level.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.activityText,
              activityLevel === level.value && styles.activityTextSelected,
            ]}
          >
            {level.label}
          </Text>
          {activityLevel === level.value && (
            <Ionicons name="checkmark" size={18} color={Colors.accent} />
          )}
        </TouchableOpacity>
      ))}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>Altitude Acclimated</Text>
          <Text style={styles.settingDesc}>Living above 4,000 ft elevation</Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleBtn, altitudeAcclimated && styles.toggleBtnActive]}
          onPress={() => setAltitudeAcclimated(!altitudeAcclimated)}
        >
          <Text
            style={[styles.toggleBtnText, altitudeAcclimated && styles.toggleBtnTextActive]}
          >
            {altitudeAcclimated ? 'Yes' : 'No'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Button title="Save Profile" onPress={handleSave} loading={saving} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
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
    marginBottom: 24,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: Colors.primaryBackground,
    fontSize: 32,
    fontWeight: 'bold',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondaryText,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryBackground,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  dobRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 0 },
  dobInput: { textAlign: 'center' as const, width: 56 },
  dobSeparator: {
    color: Colors.secondaryText,
    fontSize: 14,
    marginHorizontal: 4,
    marginBottom: 16,
  },
  optionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  option: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
  },
  optionSelected: { borderColor: Colors.accent, backgroundColor: Colors.cardBackground },
  optionText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '500' },
  optionTextSelected: { color: Colors.accentText },
  activityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  activitySelected: { borderColor: Colors.accent, backgroundColor: Colors.cardBackground },
  activityText: { color: Colors.secondaryText, fontSize: 14 },
  activityTextSelected: { color: Colors.accentText, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  settingLabel: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  settingDesc: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  toggleBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleBtnText: { color: Colors.secondaryText, fontSize: 13, fontWeight: '600' },
  toggleBtnTextActive: { color: Colors.primaryBackground },
  errorText: { color: '#FF6B6B', fontSize: 13, marginTop: 4, marginBottom: 8 },
  footer: { marginTop: 8, marginBottom: 32 },
});
