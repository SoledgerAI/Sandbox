// Expanded Onboarding: 9-screen flow (F-07 remediation)
// Screen 1: Consent + Name + Pronouns
// Screen 2: Biological Sex
// Screen 3: Date of Birth
// Screen 4: Height (feet + inches, stored as total inches)
// Screen 5: Weight (lbs, stored as lbs)
// Screen 6: Activity Level
// Screen 7: Primary Goal
// Screen 8: What You Track (tags)
// Screen 9: Zip Code

import { useState, useCallback, useRef } from 'react';
import {
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../constants/colors';
import { ProgressBar } from './common/ProgressBar';
import { Button } from './common/Button';
import { Input } from './common/Input';
import { DateTimePicker } from './common/DateTimePicker';
import { TagPicker } from './onboarding/TagPicker';
import {
  completeOnboarding,
  setUserSex,
  setUserZip,
} from '../services/onboardingService';
import { storageSet, STORAGE_KEYS } from '../utils/storage';
import { getDefaultTagsForTier } from '../constants/tags';
import { DEFAULT_TIER } from '../constants/tiers';
import type {
  BiologicalSex,
  Pronouns,
  MetabolicProfile,
  MainGoal,
  ActivityLevel,
  ConsentRecord,
  UserProfile,
} from '../types/profile';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const TOTAL_STEPS = 11; // +1 value prop, +1 summary
const CONSENT_VERSION = '1.0';

// ── Activity Level Options ──

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; subtitle: string }[] = [
  { value: 'sedentary', label: 'Sedentary', subtitle: 'Little or no exercise' },
  { value: 'lightly_active', label: 'Lightly Active', subtitle: '1-3 days/week' },
  { value: 'moderately_active', label: 'Moderately Active', subtitle: '3-5 days/week' },
  { value: 'very_active', label: 'Very Active', subtitle: '6-7 days/week' },
  { value: 'extremely_active', label: 'Extremely Active', subtitle: 'Athlete / physical job' },
];

// ── Goal Options (remapped per F-05 spec) ──

const GOAL_OPTIONS: { value: MainGoal; label: string; icon: string }[] = [
  { value: 'get_healthier', label: 'Maintain Weight', icon: 'swap-horizontal-outline' },
  { value: 'lose_weight', label: 'Lose Fat', icon: 'trending-down-outline' },
  { value: 'gain_muscle', label: 'Build Muscle', icon: 'barbell-outline' },
  { value: 'support_recovery', label: 'Improve Health', icon: 'heart-outline' },
];

// ── Sex Options ──

const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'intersex', label: 'Intersex', icon: 'person-outline' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'help-circle-outline' },
];

const METABOLIC_OPTIONS: { value: MetabolicProfile; label: string }[] = [
  { value: 'female', label: 'Female metabolic profile' },
  { value: 'male', label: 'Male metabolic profile' },
];

const PRONOUN_OPTIONS: { value: Pronouns; label: string }[] = [
  { value: 'she_her', label: 'She/her' },
  { value: 'he_him', label: 'He/him' },
  { value: 'they_them', label: 'They/them' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

// ── Main Component ──

interface PersonalizationFlowProps {
  onComplete: () => void;
}

export function PersonalizationFlow({ onComplete }: PersonalizationFlowProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const isNavigating = useRef(false);

  // Step 1: Consent + Name + Pronouns
  const [name, setName] = useState('');
  const [pronouns, setPronouns] = useState<Pronouns | null>(null);
  const [healthConsent, setHealthConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [ageConsent, setAgeConsent] = useState(false);

  // Step 2: Biological Sex
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [metabolicProfile, setMetabolicProfile] = useState<MetabolicProfile | null>(null);

  // Step 3: Date of Birth
  const [dobDate, setDobDate] = useState<Date>(new Date(1990, 0, 1));

  // Step 4: Height
  const [heightFeet, setHeightFeet] = useState(5);
  const [heightInches, setHeightInches] = useState(8);
  const [heightUnitMetric, setHeightUnitMetric] = useState(false);
  const [heightCm, setHeightCm] = useState(173); // default synced with 5'8"

  // Step 5: Weight
  const [weightLbs, setWeightLbs] = useState(160);
  const [weightUnitMetric, setWeightUnitMetric] = useState(false);
  const [weightKg, setWeightKg] = useState(73); // default synced with 160 lbs

  // Step 6: Activity Level
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);

  // Step 7: Primary Goal
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);

  // Step 8: Tags
  const [enabledTags, setEnabledTags] = useState<string[]>(() => getDefaultTagsForTier(DEFAULT_TIER));

  // Step 9: Zip Code
  const [zip, setZip] = useState('');

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

  function goForward() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep((s) => Math.max(s - 1, 1));
  }

  // ── Step Validations ──

  // Step 2 validation (Consent + Name + Pronouns — was Step 1)
  function validateStep2(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Step 3 validation (Biological Sex — was Step 2)
  function validateStep3(): boolean {
    const newErrors: Record<string, string> = {};
    if (!sex) newErrors.sex = 'Please select your biological sex';
    if (sex === 'intersex' && !metabolicProfile) {
      newErrors.metabolic = 'Please select a metabolic profile for calorie calculations';
    }
    // prefer_not_to_say is valid without metabolic profile — uses average of male/female BMR
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Step 4 validation (Date of Birth — was Step 3)
  function validateStep4(): boolean {
    const newErrors: Record<string, string> = {};
    if (getAge(dobDate) < 18) {
      newErrors.dob = 'DUB_AI Tracker is designed for adults 18 and older.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Step 10 validation (Zip Code — was Step 9)
  function validateStep10(): boolean {
    const newErrors: Record<string, string> = {};
    if (zip.trim() && !/^\d{5}$/.test(zip.trim())) {
      newErrors.zip = 'Please enter a valid 5-digit zip code';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleStepContinue() {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setTimeout(() => { isNavigating.current = false; }, 500);

    setErrors({});
    switch (step) {
      case 1: // Value prop — no validation
        goForward();
        break;
      case 2: // Consent + Name + Pronouns
        if (validateStep2()) goForward();
        break;
      case 3: // Biological Sex
        if (validateStep3()) goForward();
        break;
      case 4: // Date of Birth
        if (validateStep4()) goForward();
        break;
      case 5: // Height — always valid (picker constrained)
      case 6: // Weight — always valid (picker constrained)
      case 7: // Activity — checked by disabled button
      case 8: // Goal — checked by disabled button
      case 9: // Tags — always valid
        goForward();
        break;
      case 10: // Zip Code
        if (validateStep10()) goForward();
        break;
      case 11: // Summary — finish
        handleFinish();
        break;
    }
  }

  // ── Tag Toggle ──

  function handleTagToggle(tagId: string) {
    setEnabledTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  }

  // ── Finish & Persist ──

  const handleFinish = useCallback(async () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    setSaving(true);
    try {
      const dobString = `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}`;

      // Compute stored height in inches
      const totalInches = heightUnitMetric
        ? Math.round(heightCm / 2.54)
        : heightFeet * 12 + heightInches;

      // Compute stored weight in lbs
      const totalLbs = weightUnitMetric
        ? Math.round(weightKg * 2.20462)
        : weightLbs;

      // Map main goal to weight goal direction
      const goalDirection =
        mainGoal === 'lose_weight' ? ('LOSE' as const) :
        mainGoal === 'gain_muscle' ? ('GAIN' as const) :
        ('MAINTAIN' as const);

      const profile: Partial<UserProfile> = {
        name: name.trim(),
        dob: dobString,
        units: 'imperial',
        sex: sex!,
        pronouns,
        metabolic_profile: sex === 'intersex' ? metabolicProfile : null,
        main_goal: mainGoal,
        height_inches: totalInches,
        weight_lbs: totalLbs,
        activity_level: activityLevel,
        goal: {
          direction: goalDirection,
          target_weight: null,
          rate_lbs_per_week: goalDirection === 'LOSE' ? 1.0 : null,
          gain_type: goalDirection === 'GAIN' ? 'standard' : null,
          surplus_calories: goalDirection === 'GAIN' ? 300 : null,
        },
      };

      const consent: ConsentRecord = {
        consent_date: new Date().toISOString(),
        consent_version: CONSENT_VERSION,
        health_data_consent: healthConsent,
        third_party_ai_consent: aiConsent,
        age_verification: ageConsent,
      };

      // Initialize deferred setup state (reduced — tags now in onboarding)
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      const defaultItem = { shown_count: 0, completed: false, dismissed_date: null };
      const deferredSetup = {
        onboarding_date: today,
        tag_selection: { ...defaultItem, completed: true }, // done in onboarding now
        calorie_target: { ...defaultItem, completed: true }, // done in onboarding now
        device_connect: { ...defaultItem },
        reminders: { ...defaultItem },
      };

      const writes: Promise<void>[] = [
        storageSet(STORAGE_KEYS.PROFILE, profile),
        storageSet(STORAGE_KEYS.SETTINGS, {
          units: 'imperial',
          notification_enabled: false,
          notification_cadence: null,
          eod_questionnaire_time: null,
          privacy_screen_enabled: false,
          hide_calories: false,
          consent_date: consent.consent_date,
          consent_version: consent.consent_version,
        }),
        storageSet(STORAGE_KEYS.TIER, DEFAULT_TIER),
        storageSet(STORAGE_KEYS.TAGS_ENABLED, enabledTags),
        storageSet(STORAGE_KEYS.DEFERRED_SETUP, deferredSetup),
        setUserSex(sex!),
      ];

      // Save zip if provided
      if (zip.trim() && /^\d{5}$/.test(zip.trim())) {
        writes.push(setUserZip(zip.trim()));
      }

      await Promise.all(writes);
      await completeOnboarding();
      onComplete();
    } finally {
      setSaving(false);
      isNavigating.current = false;
    }
  }, [
    name, dobDate, sex, metabolicProfile, pronouns, mainGoal,
    healthConsent, aiConsent, ageConsent, onComplete,
    heightFeet, heightInches, heightUnitMetric, heightCm,
    weightLbs, weightUnitMetric, weightKg,
    activityLevel, enabledTags, zip,
  ]);

  // ── Button state per step ──

  function canContinue(): boolean {
    switch (step) {
      case 1: return true; // Value prop — always can proceed
      case 2: return allConsented && !!name.trim();
      case 3: return !!sex && (sex !== 'intersex' || !!metabolicProfile);
      case 4: return true; // DOB picker always has a value
      case 5: return true; // Height picker always has a value
      case 6: return true; // Weight picker always has a value
      case 7: return !!activityLevel;
      case 8: return !!mainGoal;
      case 9: return true; // Tags can be empty (user chooses)
      case 10: return true; // Zip is optional
      case 11: return true; // Summary — always can finish
      default: return false;
    }
  }

  const isLastStep = step === TOTAL_STEPS;
  const buttonTitle = isLastStep ? 'Start Tracking' : step === 1 ? 'Get Started' : 'Continue';

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {step > 1 ? (
          <TouchableOpacity
            style={styles.backArrow}
            onPress={goBack}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backArrowSpacer} />
        )}
        <View style={styles.progressCenter}>
          <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />
          <Text style={styles.stepCounter}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={styles.backArrowSpacer} />
      </View>

      <View style={styles.screen}>
        {step === 1 && (
          <StepValueProp />
        )}
        {step === 2 && (
          <Step1Consent
            name={name}
            onNameChange={setName}
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
          />
        )}
        {step === 3 && (
          <Step2Sex
            sex={sex}
            onSexSelect={setSex}
            metabolicProfile={metabolicProfile}
            onMetabolicProfileSelect={setMetabolicProfile}
            errors={errors}
          />
        )}
        {step === 4 && (
          <Step3DOB
            dobDate={dobDate}
            onDobChange={setDobDate}
            errors={errors}
          />
        )}
        {step === 5 && (
          <Step4Height
            feet={heightFeet}
            inches={heightInches}
            onFeetChange={setHeightFeet}
            onInchesChange={setHeightInches}
            useMetric={heightUnitMetric}
            onToggleMetric={setHeightUnitMetric}
            cm={heightCm}
            onCmChange={setHeightCm}
          />
        )}
        {step === 6 && (
          <Step5Weight
            lbs={weightLbs}
            onLbsChange={setWeightLbs}
            useMetric={weightUnitMetric}
            onToggleMetric={setWeightUnitMetric}
            kg={weightKg}
            onKgChange={setWeightKg}
          />
        )}
        {step === 7 && (
          <Step6Activity
            selected={activityLevel}
            onSelect={setActivityLevel}
          />
        )}
        {step === 8 && (
          <Step7Goal
            selected={mainGoal}
            onSelect={setMainGoal}
          />
        )}
        {step === 9 && (
          <Step8Tags
            enabledTags={enabledTags}
            onToggle={handleTagToggle}
          />
        )}
        {step === 10 && (
          <Step9Zip
            zip={zip}
            onZipChange={setZip}
            errors={errors}
            onSubmit={handleStepContinue}
          />
        )}
        {step === 11 && (
          <StepSummary
            name={name}
            pronouns={pronouns}
            sex={sex}
            dobDate={dobDate}
            heightFeet={heightFeet}
            heightInches={heightInches}
            heightUnitMetric={heightUnitMetric}
            heightCm={heightCm}
            weightLbs={weightLbs}
            weightUnitMetric={weightUnitMetric}
            weightKg={weightKg}
            activityLevel={activityLevel}
            mainGoal={mainGoal}
            enabledTags={enabledTags}
            zip={zip}
            onEditStep={(s) => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setStep(s);
            }}
            getAge={getAge}
          />
        )}
      </View>

      <View style={styles.footer}>
        <Button
          title={buttonTitle}
          onPress={handleStepContinue}
          disabled={!canContinue()}
          loading={isLastStep && saving}
        />
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
// Value Prop Screen (Fix 3)
// ════════════════════════════════════════════════════

const VALUE_PROP_FEATURES: { icon: string; text: string }[] = [
  { icon: 'analytics-outline', text: 'Track nutrition, fitness, sleep, and mood in one place' },
  { icon: 'chatbubble-ellipses-outline', text: 'AI-powered insights from Coach DUB' },
  { icon: 'shield-checkmark-outline', text: 'Your data stays on your device' },
  { icon: 'timer-outline', text: 'About 2 minutes to set up' },
];

function StepValueProp() {
  return (
    <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
      <Text style={[styles.screenTitle, { fontSize: 32, textAlign: 'center' }]}>
        Welcome to DUB
      </Text>
      <Text style={[styles.screenSubtitle, { textAlign: 'center', marginBottom: 32 }]}>
        Your complete health dashboard
      </Text>

      <View style={{ gap: 16 }}>
        {VALUE_PROP_FEATURES.map((feat) => (
          <View key={feat.text} style={styles.valuePropRow}>
            <Ionicons
              name={feat.icon as any}
              size={24}
              color={Colors.accent}
              style={{ marginRight: 14 }}
            />
            <Text style={styles.valuePropText}>{feat.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════
// Step 1: Consent + Name + Pronouns
// ════════════════════════════════════════════════════

function Step1Consent({
  name, onNameChange,
  pronouns, onPronounsSelect,
  healthConsent, onHealthConsent,
  aiConsent, onAiConsent,
  ageConsent, onAgeConsent,
  allConsented,
  errors,
}: {
  name: string;
  onNameChange: (v: string) => void;
  pronouns: Pronouns | null;
  onPronounsSelect: (p: Pronouns | null) => void;
  healthConsent: boolean;
  onHealthConsent: (v: boolean) => void;
  aiConsent: boolean;
  onAiConsent: (v: boolean) => void;
  ageConsent: boolean;
  onAgeConsent: (v: boolean) => void;
  allConsented: boolean;
  errors: Record<string, string>;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Let's Set Up Your Profile</Text>
        <Text style={styles.screenSubtitle}>
          We need a few details to personalize your experience.
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

          {/* Pronouns */}
          <Text style={styles.label}>Pronouns</Text>
          <View style={styles.chipRow}>
            {PRONOUN_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  pronouns === opt.value && styles.chipSelected,
                ]}
                onPress={() => allConsented && onPronounsSelect(pronouns === opt.value ? null : opt.value)}
                disabled={!allConsented}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.chipText,
                    pronouns === opt.value && styles.chipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════
// Step 2: Biological Sex
// ════════════════════════════════════════════════════

function Step2Sex({
  sex, onSexSelect,
  metabolicProfile, onMetabolicProfileSelect,
  errors,
}: {
  sex: BiologicalSex | null;
  onSexSelect: (s: BiologicalSex) => void;
  metabolicProfile: MetabolicProfile | null;
  onMetabolicProfileSelect: (p: MetabolicProfile) => void;
  errors: Record<string, string>;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Biological Sex</Text>
      <Text style={styles.screenSubtitle}>
        Used for calorie calculations only. Never shown on your profile or shared. You can change this later in Settings.
      </Text>

      <View style={styles.cardGroup}>
        {SEX_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.selectCard, sex === opt.value && styles.selectCardActive]}
            onPress={() => onSexSelect(opt.value)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Ionicons
              name={opt.icon as any}
              size={24}
              color={sex === opt.value ? Colors.accent : Colors.secondaryText}
            />
            <Text style={[styles.selectCardLabel, sex === opt.value && styles.selectCardLabelActive]}>
              {opt.label}
            </Text>
            {sex === opt.value && (
              <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
      {errors.sex ? <Text style={styles.errorText}>{errors.sex}</Text> : null}

      {/* Metabolic profile (intersex only) */}
      {sex === 'intersex' && (
        <View style={{ marginTop: 20 }}>
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
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 3: Date of Birth
// ════════════════════════════════════════════════════

function Step3DOB({
  dobDate, onDobChange, errors,
}: {
  dobDate: Date;
  onDobChange: (d: Date) => void;
  errors: Record<string, string>;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Date of Birth</Text>
      <Text style={styles.screenSubtitle}>
        Your age is used to calculate your daily calorie target. We never share your birthdate.
      </Text>

      <DateTimePicker
        label="Date of Birth"
        mode="date"
        value={dobDate}
        onChange={onDobChange}
        minimumDate={new Date(1920, 0, 1)}
        maximumDate={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate())}
      />
      {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 4: Height
// ════════════════════════════════════════════════════

function Step4Height({
  feet, inches, onFeetChange, onInchesChange,
  useMetric, onToggleMetric,
  cm, onCmChange,
}: {
  feet: number;
  inches: number;
  onFeetChange: (v: number) => void;
  onInchesChange: (v: number) => void;
  useMetric: boolean;
  onToggleMetric: (v: boolean) => void;
  cm: number;
  onCmChange: (v: number) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Height</Text>
      <Text style={styles.screenSubtitle}>
        Used for your daily calorie calculation.
      </Text>

      {/* Unit toggle */}
      <View style={styles.unitToggleRow}>
        <TouchableOpacity
          style={[styles.unitToggle, !useMetric && styles.unitToggleActive]}
          onPress={() => {
            if (useMetric) {
              // Convert cm back to feet/inches
              const totalIn = Math.round(cm / 2.54);
              onFeetChange(Math.floor(totalIn / 12));
              onInchesChange(totalIn % 12);
            }
            onToggleMetric(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.unitToggleText, !useMetric && styles.unitToggleTextActive]}>ft / in</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitToggle, useMetric && styles.unitToggleActive]}
          onPress={() => {
            if (!useMetric) {
              // Convert feet/inches to cm
              onCmChange(Math.round((feet * 12 + inches) * 2.54));
            }
            onToggleMetric(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.unitToggleText, useMetric && styles.unitToggleTextActive]}>cm</Text>
        </TouchableOpacity>
      </View>

      {!useMetric ? (
        <View style={styles.pickerRow}>
          {/* Feet picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerLabel}>Feet</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={feet}
                onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) onFeetChange(n); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {[3, 4, 5, 6, 7, 8].map((v) => (
                  <Picker.Item key={v} label={`${v}`} value={v} color={Colors.text} />
                ))}
              </Picker>
            </View>
          </View>

          {/* Inches picker */}
          <View style={styles.pickerColumn}>
            <Text style={styles.pickerLabel}>Inches</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={inches}
                onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) onInchesChange(n); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <Picker.Item key={i} label={`${i}`} value={i} color={Colors.text} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <View style={[styles.pickerColumn, { flex: 1 }]}>
            <Text style={styles.pickerLabel}>Centimeters</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={cm}
                onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) onCmChange(n); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 121 }, (_, i) => i + 100).map((v) => (
                  <Picker.Item key={v} label={`${v} cm`} value={v} color={Colors.text} />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 5: Weight
// ════════════════════════════════════════════════════

function Step5Weight({
  lbs, onLbsChange,
  useMetric, onToggleMetric,
  kg, onKgChange,
}: {
  lbs: number;
  onLbsChange: (v: number) => void;
  useMetric: boolean;
  onToggleMetric: (v: boolean) => void;
  kg: number;
  onKgChange: (v: number) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Weight</Text>
      <Text style={styles.screenSubtitle}>
        Used for your daily calorie calculation. You can update this anytime.
      </Text>

      {/* Unit toggle */}
      <View style={styles.unitToggleRow}>
        <TouchableOpacity
          style={[styles.unitToggle, !useMetric && styles.unitToggleActive]}
          onPress={() => {
            if (useMetric) {
              onLbsChange(Math.round(kg * 2.20462));
            }
            onToggleMetric(false);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.unitToggleText, !useMetric && styles.unitToggleTextActive]}>lbs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.unitToggle, useMetric && styles.unitToggleActive]}
          onPress={() => {
            if (!useMetric) {
              onKgChange(Math.round(lbs / 2.20462));
            }
            onToggleMetric(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.unitToggleText, useMetric && styles.unitToggleTextActive]}>kg</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pickerRow}>
        <View style={[styles.pickerColumn, { flex: 1 }]}>
          <Text style={styles.pickerLabel}>{useMetric ? 'Kilograms' : 'Pounds'}</Text>
          <View style={styles.pickerWrapper}>
            {!useMetric ? (
              <Picker
                selectedValue={lbs}
                onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) onLbsChange(n); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 451 }, (_, i) => i + 50).map((v) => (
                  <Picker.Item key={v} label={`${v} lbs`} value={v} color={Colors.text} />
                ))}
              </Picker>
            ) : (
              <Picker
                selectedValue={kg}
                onValueChange={(v) => { const n = Number(v); if (!isNaN(n)) onKgChange(n); }}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 201 }, (_, i) => i + 25).map((v) => (
                  <Picker.Item key={v} label={`${v} kg`} value={v} color={Colors.text} />
                ))}
              </Picker>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 6: Activity Level
// ════════════════════════════════════════════════════

function Step6Activity({
  selected, onSelect,
}: {
  selected: ActivityLevel | null;
  onSelect: (a: ActivityLevel) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Activity Level</Text>
      <Text style={styles.screenSubtitle}>
        How active are you on a typical week? This helps calculate your daily calorie target.
      </Text>

      <View style={styles.cardGroup}>
        {ACTIVITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.selectCard, selected === opt.value && styles.selectCardActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.selectCardLabel, selected === opt.value && styles.selectCardLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.selectCardSubtitle}>{opt.subtitle}</Text>
            </View>
            {selected === opt.value && (
              <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 7: Primary Goal
// ════════════════════════════════════════════════════

function Step7Goal({
  selected, onSelect,
}: {
  selected: MainGoal | null;
  onSelect: (g: MainGoal) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>What's your main goal?</Text>
      <Text style={styles.screenSubtitle}>
        You can change this anytime in Settings.
      </Text>

      <View style={styles.cardGroup}>
        {GOAL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.selectCard, selected === opt.value && styles.selectCardActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={opt.icon as any}
              size={28}
              color={selected === opt.value ? Colors.accent : Colors.secondaryText}
            />
            <Text
              style={[styles.selectCardLabel, selected === opt.value && styles.selectCardLabelActive, { flex: 1 }]}
            >
              {opt.label}
            </Text>
            {selected === opt.value && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={Colors.accent}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 8: What You Track (Tags)
// ════════════════════════════════════════════════════

function Step8Tags({
  enabledTags, onToggle,
}: {
  enabledTags: string[];
  onToggle: (tagId: string) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>What do you want to track?</Text>
      <Text style={styles.screenSubtitle}>
        Pick the categories that matter to you. You can change these anytime in Settings.
      </Text>

      <TagPicker enabledTags={enabledTags} onToggle={onToggle} />
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Step 9: Zip Code
// ════════════════════════════════════════════════════

function Step9Zip({
  zip, onZipChange, errors, onSubmit,
}: {
  zip: string;
  onZipChange: (v: string) => void;
  errors: Record<string, string>;
  onSubmit?: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={120}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>Zip Code</Text>
        <Text style={styles.screenSubtitle}>
          Optional. Used for local weather context in your daily summary.
        </Text>

        <Input
          label="Zip Code"
          value={zip}
          onChangeText={(text) => onZipChange(text.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="e.g. 90210"
          keyboardType="number-pad"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          maxLength={5}
          error={errors.zip}
        />

        <Text style={styles.helperText}>
          You can skip this and add it later in Settings.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ════════════════════════════════════════════════════
// Summary Screen (Fix 2)
// ════════════════════════════════════════════════════

function StepSummary({
  name, pronouns, sex, dobDate,
  heightFeet, heightInches, heightUnitMetric, heightCm,
  weightLbs, weightUnitMetric, weightKg,
  activityLevel, mainGoal, enabledTags, zip,
  onEditStep, getAge,
}: {
  name: string;
  pronouns: Pronouns | null;
  sex: BiologicalSex | null;
  dobDate: Date;
  heightFeet: number;
  heightInches: number;
  heightUnitMetric: boolean;
  heightCm: number;
  weightLbs: number;
  weightUnitMetric: boolean;
  weightKg: number;
  activityLevel: ActivityLevel | null;
  mainGoal: MainGoal | null;
  enabledTags: string[];
  zip: string;
  onEditStep: (step: number) => void;
  getAge: (d: Date) => number;
}) {
  const pronounLabel = PRONOUN_OPTIONS.find((p) => p.value === pronouns)?.label ?? 'Not set';
  const sexLabel = SEX_OPTIONS.find((s) => s.value === sex)?.label ?? 'Not set';
  const age = getAge(dobDate);
  const dobFormatted = `${dobDate.getMonth() + 1}/${dobDate.getDate()}/${dobDate.getFullYear()}`;
  const heightDisplay = heightUnitMetric ? `${heightCm} cm` : `${heightFeet}'${heightInches}"`;
  const weightDisplay = weightUnitMetric ? `${weightKg} kg` : `${weightLbs} lbs`;
  const activityLabel = ACTIVITY_OPTIONS.find((a) => a.value === activityLevel)?.label ?? 'Not set';
  const goalLabel = GOAL_OPTIONS.find((g) => g.value === mainGoal)?.label ?? 'Not set';
  const tagCount = enabledTags.length;

  const rows: { label: string; value: string; editStep: number }[] = [
    { label: 'Name', value: name || 'Not set', editStep: 2 },
    { label: 'Pronouns', value: pronounLabel, editStep: 2 },
    { label: 'Biological Sex', value: sexLabel, editStep: 3 },
    { label: 'Date of Birth', value: `${dobFormatted} (Age: ${age})`, editStep: 4 },
    { label: 'Height', value: heightDisplay, editStep: 5 },
    { label: 'Weight', value: weightDisplay, editStep: 6 },
    { label: 'Activity Level', value: activityLabel, editStep: 7 },
    { label: 'Goal', value: goalLabel, editStep: 8 },
    { label: 'Tags', value: `${tagCount} categories enabled`, editStep: 9 },
    { label: 'Zip Code', value: zip.trim() || 'Not provided', editStep: 10 },
  ];

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.screenTitle}>Review Your Profile</Text>
      <Text style={styles.screenSubtitle}>
        You can change any of these later in Settings.
      </Text>

      <View style={{ gap: 2, marginTop: 8 }}>
        {rows.map((row) => (
          <TouchableOpacity
            key={row.label}
            style={styles.summaryRow}
            onPress={() => onEditStep(row.editStep)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>{row.label}</Text>
              <Text style={styles.summaryValue}>{row.value}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.secondaryText} />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ════════════════════════════════════════════════════
// Inline Checkbox
// ════════════════════════════════════════════════════

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
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>&#10003;</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    paddingTop: 48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  progressCenter: {
    flex: 1,
    alignItems: 'center',
  },
  backArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowSpacer: {
    width: 44,
  },
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  stepCounter: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },

  // Typography
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
    color: Colors.dangerText,
    fontSize: 12,
    marginTop: 4,
  },

  // Selection cards (sex, activity, goal)
  cardGroup: {
    gap: 10,
    marginTop: 8,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 14,
  },
  selectCardActive: {
    borderColor: Colors.accent,
  },
  selectCardLabel: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500',
  },
  selectCardLabelActive: {
    color: Colors.accentText,
  },
  selectCardSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 2,
  },

  // Metabolic profile cards
  metabolicRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
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

  // Chip row (pronouns)
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.inputBackground,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  chipText: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextSelected: {
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

  // Unit toggle
  unitToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  unitToggle: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  unitToggleActive: {
    backgroundColor: Colors.accent,
  },
  unitToggleText: {
    color: Colors.secondaryText,
    fontSize: 15,
    fontWeight: '600',
  },
  unitToggleTextActive: {
    color: Colors.primaryBackground,
  },

  // Picker (height, weight)
  pickerRow: {
    flexDirection: 'row',
    gap: 16,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    textAlign: 'center',
  },
  pickerWrapper: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    overflow: 'hidden',
    width: '100%',
  },
  picker: {
    width: '100%',
    height: 180,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 20,
    height: 180,
  },

  // Value Prop
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  valuePropText: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 2,
  },
  summaryValue: {
    color: Colors.accentText,
    fontSize: 15,
    fontWeight: '500',
  },
});
