// Express Onboarding: 2-screen flow (P0-08, P1-08, P1-14)
// Screen 1: Name, DOB, Biological Sex, Pronouns, Consent (~30 seconds)
// Screen 2: Main Goal → Dashboard immediately
// All deferred setup (tags, calorie target, devices, reminders) handled by dashboard cards

import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { ProgressBar } from './common/ProgressBar';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { DateTimePicker } from './common/DateTimePicker';
import {
  completeOnboarding,
  setUserSex,
} from '../services/onboardingService';
import { storageSet, STORAGE_KEYS } from '../utils/storage';
import { getDefaultTagsForTier } from '../constants/tags';
import { DEFAULT_TIER } from '../constants/tiers';
import type {
  BiologicalSex,
  Pronouns,
  MetabolicProfile,
  MainGoal,
  ConsentRecord,
  UserProfile,
} from '../types/profile';

const TOTAL_STEPS = 2;
const CONSENT_VERSION = '1.0';

interface PersonalizationFlowProps {
  onComplete: () => void;
}

export function PersonalizationFlow({ onComplete }: PersonalizationFlowProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Screen 1 fields
  const [name, setName] = useState('');
  const [dobDate, setDobDate] = useState<Date>(new Date(1990, 0, 1));
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [metabolicProfile, setMetabolicProfile] = useState<MetabolicProfile | null>(null);
  const [pronouns, setPronouns] = useState<Pronouns | null>(null);

  // Consent
  const [healthConsent, setHealthConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [ageConsent, setAgeConsent] = useState(false);

  // Screen 2
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const allConsented = healthConsent && aiConsent && ageConsent;

  function getAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  function validateScreen1(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    if (getAge(dobDate) < 18) {
      newErrors.dob = 'DUB_AI Tracker is designed for adults 18 and older.';
    }
    if (!sex) newErrors.sex = 'Please select your biological sex';
    if (sex === 'intersex' && !metabolicProfile) {
      newErrors.metabolic = 'Please select a metabolic profile for calorie calculations';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleScreen1Continue() {
    if (!validateScreen1()) return;
    setStep(2);
  }

  const handleFinish = useCallback(async () => {
    if (!mainGoal) return;
    setSaving(true);
    try {
      const dobString = `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}`;

      // Map main goal to weight goal direction default
      const goalDirection =
        mainGoal === 'lose_weight' ? 'LOSE' as const :
        mainGoal === 'gain_muscle' ? 'GAIN' as const :
        'MAINTAIN' as const;

      const profile: Partial<UserProfile> = {
        name: name.trim(),
        dob: dobString,
        units: 'imperial',
        sex: sex!,
        pronouns: pronouns,
        metabolic_profile: sex === 'intersex' ? metabolicProfile : null,
        main_goal: mainGoal,
        activity_level: 'moderately_active', // Default per spec
        goal: {
          direction: goalDirection,
          target_weight: null,
          rate_lbs_per_week: goalDirection === 'LOSE' ? 1.0 : null,
          gain_type: goalDirection === 'GAIN' ? 'standard' : null,
          surplus_calories: goalDirection === 'GAIN' ? 500 : null,
        },
      };

      const consent: ConsentRecord = {
        consent_date: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
        health_data_consent: healthConsent,
        third_party_ai_consent: aiConsent,
        age_verification: ageConsent,
      };

      // Initialize deferred setup state
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      const defaultItem = { shown_count: 0, completed: false, dismissed_date: null };
      const deferredSetup = {
        onboarding_date: today,
        tag_selection: { ...defaultItem },
        calorie_target: { ...defaultItem },
        device_connect: { ...defaultItem },
        reminders: { ...defaultItem },
      };

      await Promise.all([
        storageSet(STORAGE_KEYS.PROFILE, profile),
        storageSet(STORAGE_KEYS.SETTINGS, {
          units: 'imperial',
          notification_enabled: false,
          notification_cadence: null,
          eod_questionnaire_time: null,
          privacy_screen_enabled: false,
          consent_date: consent.consent_date,
          consent_version: consent.consent_version,
        }),
        storageSet(STORAGE_KEYS.TIER, DEFAULT_TIER),
        storageSet(STORAGE_KEYS.TAGS_ENABLED, getDefaultTagsForTier(DEFAULT_TIER)),
        storageSet(STORAGE_KEYS.DEFERRED_SETUP, deferredSetup),
        setUserSex(sex!),
      ]);

      await completeOnboarding();
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [name, dobDate, sex, metabolicProfile, pronouns, mainGoal, healthConsent, aiConsent, ageConsent, onComplete]);

  return (
    <View style={styles.container}>
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      {step > 1 && (
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => setStep(1)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      )}

      {step === 1 && (
        <Screen1
          name={name}
          onNameChange={setName}
          dobDate={dobDate}
          onDobChange={setDobDate}
          sex={sex}
          onSexSelect={setSex}
          metabolicProfile={metabolicProfile}
          onMetabolicProfileSelect={setMetabolicProfile}
          pronouns={pronouns}
          onPronounsSelect={setPronouns}
          healthConsent={healthConsent}
          onHealthConsent={setHealthConsent}
          aiConsent={aiConsent}
          onAiConsent={setAiConsent}
          ageConsent={ageConsent}
          onAgeConsent={setAgeConsent}
          allConsented={allConsented}
          errors={errors}
          onContinue={handleScreen1Continue}
        />
      )}

      {step === 2 && (
        <Screen2
          selected={mainGoal}
          onSelect={setMainGoal}
          onFinish={handleFinish}
          saving={saving}
        />
      )}
    </View>
  );
}

// ── Screen 1: Profile + Consent ──

const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'intersex', label: 'Intersex', icon: 'person-outline' },
];

const PRONOUN_OPTIONS: { value: Pronouns; label: string }[] = [
  { value: 'she_her', label: 'She/her' },
  { value: 'he_him', label: 'He/him' },
  { value: 'they_them', label: 'They/them' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const METABOLIC_OPTIONS: { value: MetabolicProfile; label: string }[] = [
  { value: 'female', label: 'Female metabolic profile' },
  { value: 'male', label: 'Male metabolic profile' },
];

interface Screen1Props {
  name: string;
  onNameChange: (v: string) => void;
  dobDate: Date;
  onDobChange: (d: Date) => void;
  sex: BiologicalSex | null;
  onSexSelect: (s: BiologicalSex) => void;
  metabolicProfile: MetabolicProfile | null;
  onMetabolicProfileSelect: (p: MetabolicProfile) => void;
  pronouns: Pronouns | null;
  onPronounsSelect: (p: Pronouns) => void;
  healthConsent: boolean;
  onHealthConsent: (v: boolean) => void;
  aiConsent: boolean;
  onAiConsent: (v: boolean) => void;
  ageConsent: boolean;
  onAgeConsent: (v: boolean) => void;
  allConsented: boolean;
  errors: Record<string, string>;
  onContinue: () => void;
}

function Screen1({
  name, onNameChange,
  dobDate, onDobChange,
  sex, onSexSelect,
  metabolicProfile, onMetabolicProfileSelect,
  pronouns, onPronounsSelect,
  healthConsent, onHealthConsent,
  aiConsent, onAiConsent,
  ageConsent, onAgeConsent,
  allConsented,
  errors,
  onContinue,
}: Screen1Props) {
  const canContinue = allConsented && name.trim() && sex && (sex !== 'intersex' || metabolicProfile);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Welcome to DUB_AI</Text>
        <Text style={styles.screenSubtitle}>
          Let's get you started. This takes about 30 seconds.
        </Text>

        {/* Consent */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Consent</Text>
          <Text style={styles.consentText}>
            DUB_AI collects health data that you choose to log. This data is stored on your device.
            When you use the AI Coach, your data is transmitted to a third-party AI service (Anthropic).
          </Text>
          <Checkbox
            checked={healthConsent}
            onToggle={() => onHealthConsent(!healthConsent)}
            label="I consent to the collection and processing of my health data as described in the Privacy Policy."
          />
          <Checkbox
            checked={aiConsent}
            onToggle={() => onAiConsent(!aiConsent)}
            label="I understand that Coach messages are processed by a third-party AI service."
          />
          <Checkbox
            checked={ageConsent}
            onToggle={() => onAgeConsent(!ageConsent)}
            label="I am 18 years of age or older."
          />
        </View>

        {/* Profile fields — disabled until consent given */}
        <View style={[styles.section, !allConsented && styles.sectionDisabled]}>
          <Input
            label="Name"
            value={name}
            onChangeText={onNameChange}
            placeholder="Your name"
            error={errors.name}
            editable={allConsented}
          />

          <DateTimePicker
            label="Date of Birth"
            mode="date"
            value={dobDate}
            onChange={onDobChange}
            minimumDate={new Date(1920, 0, 1)}
            maximumDate={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate())}
          />
          {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}

          {/* Biological Sex */}
          <Text style={styles.label}>Biological Sex</Text>
          <View style={styles.cardGroup}>
            {SEX_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.sexCard, sex === opt.value && styles.sexCardSelected]}
                onPress={() => allConsented && onSexSelect(opt.value)}
                disabled={!allConsented}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={24}
                  color={sex === opt.value ? Colors.accent : Colors.secondaryText}
                />
                <Text style={[styles.sexLabel, sex === opt.value && styles.sexLabelSelected]}>
                  {opt.label}
                </Text>
                {sex === opt.value && (
                  <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helperText}>
            Used for calorie calculations only. Never shown on your profile or shared.
          </Text>
          {errors.sex ? <Text style={styles.errorText}>{errors.sex}</Text> : null}

          {/* Metabolic profile (intersex only) */}
          {sex === 'intersex' && (
            <View style={styles.metabolicSection}>
              <Text style={styles.label}>Metabolic Profile</Text>
              <Text style={styles.helperText}>
                Choose which formula to use for calorie calculations.
              </Text>
              <View style={styles.metabolicRow}>
                {METABOLIC_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.metabolicCard,
                      metabolicProfile === opt.value && styles.metabolicCardSelected,
                    ]}
                    onPress={() => onMetabolicProfileSelect(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.metabolicLabel,
                        metabolicProfile === opt.value && styles.metabolicLabelSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.metabolic ? <Text style={styles.errorText}>{errors.metabolic}</Text> : null}
            </View>
          )}

          {/* Pronouns */}
          <Text style={styles.label}>Pronouns</Text>
          <View style={styles.pronounRow}>
            {PRONOUN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pronounChip,
                  pronouns === opt.value && styles.pronounChipSelected,
                ]}
                onPress={() => allConsented && onPronounsSelect(opt.value)}
                disabled={!allConsented}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.pronounText,
                    pronouns === opt.value && styles.pronounTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Continue"
            onPress={onContinue}
            disabled={!canContinue}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Screen 2: Main Goal ──

const GOAL_OPTIONS: { value: MainGoal; label: string; icon: string }[] = [
  { value: 'lose_weight', label: 'Lose weight', icon: 'trending-down-outline' },
  { value: 'gain_muscle', label: 'Gain muscle', icon: 'barbell-outline' },
  { value: 'get_healthier', label: 'Get healthier', icon: 'heart-outline' },
  { value: 'track_condition', label: 'Track a condition', icon: 'clipboard-outline' },
  { value: 'support_recovery', label: 'Support recovery', icon: 'medkit-outline' },
];

function Screen2({
  selected,
  onSelect,
  onFinish,
  saving,
}: {
  selected: MainGoal | null;
  onSelect: (g: MainGoal) => void;
  onFinish: () => void;
  saving: boolean;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>What's your main goal?</Text>
        <Text style={styles.screenSubtitle}>
          You can change this anytime in Settings.
        </Text>

        <View style={styles.goalGroup}>
          {GOAL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.goalCard, selected === opt.value && styles.goalCardSelected]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon as any}
                size={28}
                color={selected === opt.value ? Colors.accent : Colors.secondaryText}
              />
              <Text
                style={[styles.goalLabel, selected === opt.value && styles.goalLabelSelected]}
              >
                {opt.label}
              </Text>
              {selected === opt.value && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={Colors.accent}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Start Tracking"
          onPress={onFinish}
          disabled={!selected}
          loading={saving}
        />
      </View>
    </View>
  );
}

// ── Inline Checkbox ──

function Checkbox({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.checkboxRow} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    paddingTop: 48,
  },
  backArrow: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    color: Colors.accentText,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  screenSubtitle: {
    color: Colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionDisabled: {
    opacity: 0.4,
  },
  sectionTitle: {
    color: Colors.accentText,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  consentText: {
    color: Colors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 16,
  },
  helperText: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    fontStyle: 'italic',
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 4,
  },

  // Sex cards
  cardGroup: {
    gap: 8,
  },
  sexCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 12,
  },
  sexCardSelected: {
    borderColor: Colors.accent,
  },
  sexLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  sexLabelSelected: {
    color: Colors.accentText,
  },

  // Metabolic profile
  metabolicSection: {
    marginTop: 4,
  },
  metabolicRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  metabolicCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
  },
  metabolicCardSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  metabolicLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  metabolicLabelSelected: {
    color: Colors.accentText,
  },

  // Pronoun chips
  pronounRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pronounChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.inputBackground,
  },
  pronounChipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  pronounText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  pronounTextSelected: {
    color: Colors.accentText,
  },

  // Goal cards
  goalGroup: {
    gap: 10,
    marginTop: 8,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 14,
  },
  goalCardSelected: {
    borderColor: Colors.accent,
  },
  goalLabel: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
  },
  goalLabelSelected: {
    color: Colors.accentText,
  },

  // Consent checkboxes
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.divider,
    marginRight: 12,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  checkmark: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
});
