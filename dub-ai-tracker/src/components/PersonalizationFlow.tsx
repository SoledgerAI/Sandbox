// PersonalizationFlow: 5-step smart onboarding questionnaire
// Prompt 03 v2: Smart Onboarding (Sex-Based Tag Filtering + Demographic Vitamins)
// Screens: Welcome → Sex → Age Range → ZIP (optional) → Summary

import { useState, useCallback } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { ProgressBar } from './common/ProgressBar';
import { Button } from './common/Button';
import {
  completeOnboarding,
  setUserSex,
  setUserAgeRange,
  setUserZip,
} from '../services/onboardingService';
import type { BiologicalSex } from '../types/profile';
import type { AgeRange } from '../services/onboardingService';

const TOTAL_STEPS = 5;

interface PersonalizationFlowProps {
  onComplete: () => void;
}

export function PersonalizationFlow({ onComplete }: PersonalizationFlowProps) {
  const [step, setStep] = useState(1);
  const [sex, setSex] = useState<BiologicalSex | null>(null);
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [zip, setZip] = useState('');
  const [saving, setSaving] = useState(false);

  const handleFinish = useCallback(async () => {
    setSaving(true);
    try {
      if (sex) await setUserSex(sex);
      if (ageRange) await setUserAgeRange(ageRange);
      if (/^\d{5}$/.test(zip)) await setUserZip(zip);
      await completeOnboarding();
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [sex, ageRange, zip, onComplete]);

  return (
    <View style={styles.container}>
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} />

      {/* Back arrow (except Screen 1) */}
      {step > 1 && (
        <TouchableOpacity
          style={styles.backArrow}
          onPress={() => setStep((s) => s - 1)}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
      )}

      {step === 1 && <WelcomeScreen onNext={() => setStep(2)} />}
      {step === 2 && (
        <SexScreen selected={sex} onSelect={setSex} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <AgeRangeScreen selected={ageRange} onSelect={setAgeRange} onNext={() => setStep(4)} />
      )}
      {step === 4 && (
        <ZipScreen value={zip} onChange={setZip} onNext={() => setStep(5)} />
      )}
      {step === 5 && (
        <SummaryScreen
          sex={sex}
          ageRange={ageRange}
          zip={zip}
          saving={saving}
          onFinish={handleFinish}
        />
      )}
    </View>
  );
}

// ── Screen 1: Welcome ──

function WelcomeScreen({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.screen}>
      <View style={styles.centerContent}>
        <Text style={styles.appTitle}>Welcome to DUB_AI</Text>
        <Text style={styles.bodyText}>
          Let's personalize your experience. This takes about 30 seconds.
        </Text>
        <Text style={styles.privacyNote}>Your data stays on your device.</Text>
      </View>
      <View style={styles.footer}>
        <Button title="Get Started" onPress={onNext} />
      </View>
    </View>
  );
}

// ── Screen 2: Sex ──

const SEX_OPTIONS: { value: BiologicalSex; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: 'person-outline' },
];

function SexScreen({
  selected,
  onSelect,
  onNext,
}: {
  selected: BiologicalSex | null;
  onSelect: (s: BiologicalSex) => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Text style={styles.screenTitle}>Which best describes you?</Text>

      <View style={styles.cardGroup}>
        {SEX_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.card, selected === opt.value && styles.cardSelected]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={opt.icon as any}
              size={32}
              color={selected === opt.value ? Colors.accent : Colors.secondaryText}
            />
            <Text
              style={[styles.cardLabel, selected === opt.value && styles.cardLabelSelected]}
            >
              {opt.label}
            </Text>
            {selected === opt.value && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={Colors.accent}
                style={styles.checkIcon}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>
        This helps us show relevant health categories. You can change this anytime in Settings.
      </Text>

      <View style={styles.footer}>
        <Button title="Continue" onPress={onNext} disabled={!selected} />
      </View>
    </View>
  );
}

// ── Screen 3: Age Range ──

const AGE_OPTIONS: { value: AgeRange; label: string }[] = [
  { value: '18-29', label: '18 – 29' },
  { value: '30-44', label: '30 – 44' },
  { value: '45-59', label: '45 – 59' },
  { value: '60+', label: '60+' },
];

function AgeRangeScreen({
  selected,
  onSelect,
  onNext,
}: {
  selected: AgeRange | null;
  onSelect: (r: AgeRange) => void;
  onNext: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Text style={styles.screenTitle}>What's your age range?</Text>

      <View style={styles.cardGroup}>
        {AGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.card, selected === opt.value && styles.cardSelected]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.cardLabel, selected === opt.value && styles.cardLabelSelected]}
            >
              {opt.label}
            </Text>
            {selected === opt.value && (
              <Ionicons
                name="checkmark-circle"
                size={22}
                color={Colors.accent}
                style={styles.checkIcon}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.hint}>This helps us suggest relevant supplements.</Text>

      <View style={styles.footer}>
        <Button title="Continue" onPress={onNext} disabled={!selected} />
      </View>
    </View>
  );
}

// ── Screen 4: ZIP Code ──

function ZipScreen({
  value,
  onChange,
  onNext,
}: {
  value: string;
  onChange: (z: string) => void;
  onNext: () => void;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.screenTitle}>What's your ZIP code? (optional)</Text>

      <View style={styles.zipInputContainer}>
        <TextInput
          style={styles.zipInput}
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, 5))}
          placeholder="00000"
          placeholderTextColor={Colors.divider}
          keyboardType="number-pad"
          maxLength={5}
          returnKeyType="done"
        />
      </View>

      <Text style={styles.hint}>
        Used for local health insights in future updates. Stored on your device only.
      </Text>

      <View style={styles.footer}>
        <Button title="Continue" onPress={onNext} />
        <TouchableOpacity style={styles.skipLink} onPress={onNext} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Screen 5: Summary ──

function SummaryScreen({
  sex,
  ageRange,
  zip,
  saving,
  onFinish,
}: {
  sex: BiologicalSex | null;
  ageRange: AgeRange | null;
  zip: string;
  saving: boolean;
  onFinish: () => void;
}) {
  const sexLabel =
    sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : sex === 'prefer_not_to_say' ? 'Prefer not to say' : 'Not provided';
  const ageLabel = ageRange ?? 'Not provided';
  const zipLabel = /^\d{5}$/.test(zip) ? zip : 'Not provided';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.summaryContent}>
      <Text style={styles.screenTitle}>Here's your profile:</Text>

      <View style={styles.summaryCard}>
        <SummaryRow label="Sex" value={sexLabel} icon="person-outline" />
        <SummaryRow label="Age Range" value={ageLabel} icon="calendar-outline" />
        <SummaryRow label="ZIP Code" value={zipLabel} icon="location-outline" />
      </View>

      <Text style={styles.hint}>You can change these anytime in Settings.</Text>

      <View style={styles.footer}>
        <Button title="Start Tracking" onPress={onFinish} loading={saving} />
      </View>
    </ScrollView>
  );
}

function SummaryRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon as any} size={20} color={Colors.accent} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
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
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appTitle: {
    color: Colors.accentText,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  bodyText: {
    color: Colors.text,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  privacyNote: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
  },
  screenTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  cardGroup: {
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 14,
  },
  cardSelected: {
    borderColor: Colors.accent,
  },
  cardLabel: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '500',
    flex: 1,
  },
  cardLabelSelected: {
    color: Colors.accentText,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  hint: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: 40,
    paddingTop: 16,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  skipText: {
    color: Colors.secondaryText,
    fontSize: 15,
  },
  zipInputContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  zipInput: {
    backgroundColor: Colors.inputBackground,
    color: Colors.text,
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: 180,
    letterSpacing: 8,
  },
  summaryContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    width: 80,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
