// Step 2: Goal Selection (Simplified)
// Phase 3: Onboarding Flow
// Per Section 8 Step 2: Three plain-language goal choices
// Rate/target/deficit details deferred to Settings

import { useState } from 'react';
import { Alert, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { OnboardingStep } from './OnboardingStep';
import { Button } from '../common/Button';
import { BMI_NORMAL_UPPER, BMI_UNDERWEIGHT, LBS_PER_KG, CM_PER_INCH } from '../../constants/formulas';
import type { GoalDirection, UserProfile } from '../../types/profile';

interface GoalOption {
  direction: GoalDirection;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}

const GOAL_OPTIONS: GoalOption[] = [
  {
    direction: 'LOSE',
    label: 'I want to lose weight',
    description: 'Default: 1.0 lb/wk moderate deficit. Adjustable in Settings.',
    icon: 'trending-down-outline',
  },
  {
    direction: 'GAIN',
    label: 'I want to gain weight or build muscle',
    description: 'Default: Standard bulk, 500 cal surplus. Adjustable in Settings.',
    icon: 'trending-up-outline',
  },
  {
    direction: 'MAINTAIN',
    label: 'I want to maintain my weight',
    description: 'TDEE-neutral. Stay at your current weight.',
    icon: 'swap-horizontal-outline',
  },
];

interface WeightGoalStepProps {
  currentGoal: GoalDirection | null;
  /** Profile data collected in Step 1 — used for BMI guardrail (D6-002) */
  profile?: Partial<UserProfile>;
  onComplete: (direction: GoalDirection) => void;
  onBack: () => void;
}

export function WeightGoalStep({ currentGoal, profile, onComplete, onBack }: WeightGoalStepProps) {
  const [selected, setSelected] = useState<GoalDirection | null>(currentGoal);
  const [bmiWarningShown, setBmiWarningShown] = useState(false);

  function computeBmi(): number | null {
    if (profile?.weight_lbs == null || profile?.height_inches == null) return null;
    const weightKg = profile.weight_lbs / LBS_PER_KG;
    const heightM = (profile.height_inches * CM_PER_INCH) / 100;
    if (heightM <= 0) return null;
    return weightKg / (heightM * heightM);
  }

  function handleContinue() {
    const direction = selected ?? 'MAINTAIN';

    // D6-002: BMI guardrail at onboarding
    if (direction === 'LOSE' && !bmiWarningShown) {
      const bmi = computeBmi();
      if (bmi != null) {
        if (bmi <= BMI_UNDERWEIGHT) {
          Alert.alert(
            'Health Advisory',
            `Your estimated BMI is ${bmi.toFixed(1)}, which is below the healthy range. ` +
            'Weight loss at this weight is not recommended without guidance from a healthcare provider. ' +
            'You can still proceed, but please consider consulting a professional.',
            [
              { text: 'Go Back', style: 'cancel' },
              { text: 'Continue Anyway', onPress: () => { setBmiWarningShown(true); onComplete(direction); } },
            ],
          );
          return;
        } else if (bmi <= BMI_NORMAL_UPPER) {
          Alert.alert(
            'Health Advisory',
            `Your current weight is within the healthy BMI range (${bmi.toFixed(1)}). ` +
            'Continued weight loss should be discussed with a healthcare provider.',
            [
              { text: 'OK', onPress: () => { setBmiWarningShown(true); onComplete(direction); } },
            ],
          );
          return;
        }
      }
    }

    onComplete(direction);
  }

  function handleSkip() {
    onComplete('MAINTAIN');
  }

  return (
    <OnboardingStep
      title="What's your goal?"
      subtitle="You can change this anytime in Settings. Detailed targets are configured later."
    >
      <View style={styles.options}>
        {GOAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.direction}
            style={[
              styles.optionCard,
              selected === option.direction && styles.optionSelected,
            ]}
            onPress={() => setSelected(option.direction)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={option.icon}
              size={28}
              color={
                selected === option.direction ? Colors.accent : Colors.secondaryText
              }
            />
            <View style={styles.optionContent}>
              <Text
                style={[
                  styles.optionLabel,
                  selected === option.direction && styles.optionLabelSelected,
                ]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.skipLink} onPress={handleSkip}>
        <Text style={styles.skipText}>I'm not sure yet / Skip</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={styles.backButton}>
            <Button title="Back" onPress={onBack} variant="secondary" />
          </View>
          <View style={styles.continueButton}>
            <Button title="Continue" onPress={handleContinue} />
          </View>
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 14,
  },
  optionSelected: {
    borderColor: Colors.accent,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: Colors.accent,
  },
  optionDescription: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  skipText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 8,
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  continueButton: {
    flex: 2,
  },
});
