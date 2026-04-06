// Step 1: Profile and Consent
// Phase 3: Onboarding Flow
// Per Section 8 Step 1: Privacy consent (required) + basic profile

import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import { OnboardingStep } from './OnboardingStep';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { DateTimePicker } from '../common/DateTimePicker';
import type { UnitPreference, ConsentRecord, UserProfile } from '../../types/profile';

const CONSENT_VERSION = '1.0';

interface ProfileStepProps {
  profile: Partial<UserProfile> | null;
  onComplete: (profile: Partial<UserProfile>, consent: ConsentRecord) => void;
}

export function ProfileStep({ profile, onComplete }: ProfileStepProps) {
  // Consent checkboxes
  const [healthConsent, setHealthConsent] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [ageConsent, setAgeConsent] = useState(false);

  // Profile fields
  const [name, setName] = useState(profile?.name ?? '');
  const [dobDate, setDobDate] = useState<Date>(() => {
    if (profile?.dob) {
      const [y, m, d] = profile.dob.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(1990, 0, 1);
  });
  const [units, setUnits] = useState<UnitPreference>(profile?.units ?? 'imperial');

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

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (getAge(dobDate) < 18) {
      newErrors.dob =
        'DUB_AI Tracker is designed for adults 18 and older. Please check back when you turn 18.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const consent: ConsentRecord = {
      consent_date: new Date().toISOString(),
      consent_version: CONSENT_VERSION,
      health_data_consent: healthConsent,
      third_party_ai_consent: aiConsent,
      age_verification: ageConsent,
    };

    // Store as plain "YYYY-MM-DD" — no UTC conversion
    const dobString = `${dobDate.getFullYear()}-${String(dobDate.getMonth() + 1).padStart(2, '0')}-${String(dobDate.getDate()).padStart(2, '0')}`;
    const profileData: Partial<UserProfile> = {
      name: name.trim(),
      dob: dobString,
      units,
    };

    onComplete(profileData, consent);
  }

  return (
    <OnboardingStep
      title="Welcome to DUB_AI"
      subtitle="Let's set up your profile. Your data is stored on your device."
    >
      {/* Section A: Privacy Consent */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Consent</Text>
        <Text style={styles.consentText}>
          DUB_AI collects health and wellness data that you choose to log. This data is
          stored on your device. When you use the AI Coach, your data is transmitted to a
          third-party AI service (Anthropic) for processing.
        </Text>

        <Checkbox
          checked={healthConsent}
          onToggle={() => setHealthConsent(!healthConsent)}
          label="I consent to the collection and processing of my health data as described in the Privacy Policy."
        />
        <Checkbox
          checked={aiConsent}
          onToggle={() => setAiConsent(!aiConsent)}
          label="I understand that Coach messages are processed by a third-party AI service."
        />
        <Checkbox
          checked={ageConsent}
          onToggle={() => setAgeConsent(!ageConsent)}
          label="I am 18 years of age or older."
        />
      </View>

      {/* Section B: Basic Profile */}
      <View style={[styles.section, !allConsented && styles.sectionDisabled]}>
        <Text style={styles.sectionTitle}>Basic Profile</Text>

        <Input
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          error={errors.name}
          editable={allConsented}
        />

        <DateTimePicker
          label="Date of Birth"
          mode="date"
          value={dobDate}
          onChange={setDobDate}
          minimumDate={new Date(1920, 0, 1)}
          maximumDate={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate())}
        />
        {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}

        <Text style={styles.label}>Units</Text>
        <View style={styles.unitRow}>
          <TouchableOpacity
            style={[styles.unitOption, units === 'imperial' && styles.unitSelected]}
            onPress={() => allConsented && setUnits('imperial')}
            disabled={!allConsented}
          >
            <Text
              style={[styles.unitText, units === 'imperial' && styles.unitTextSelected]}
            >
              Imperial (lbs, ft)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.unitOption, units === 'metric' && styles.unitSelected]}
            onPress={() => allConsented && setUnits('metric')}
            disabled={!allConsented}
          >
            <Text
              style={[styles.unitText, units === 'metric' && styles.unitTextSelected]}
            >
              Metric (kg, cm)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleSubmit}
          disabled={!allConsented}
        />
      </View>
    </OnboardingStep>
  );
}

// Inline Checkbox component
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

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
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
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  errorText: {
    color: Colors.dangerText,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  unitOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
  },
  unitSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardBackground,
  },
  unitText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  unitTextSelected: {
    color: Colors.accentText,
  },
  footer: {
    marginTop: 8,
    marginBottom: 16,
  },
});
