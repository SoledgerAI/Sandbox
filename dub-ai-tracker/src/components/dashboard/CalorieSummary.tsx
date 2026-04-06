// Calorie summary card -- plain-language daily target with expandable math
// Phase 5: Dashboard Layout
// Redesign: P1 plain-language BMR/TDEE display

import { useState } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { CALORIE_FLOOR_FEMALE, CALORIE_FLOOR_MALE } from '../../constants/formulas';
import { DashboardCard } from './DashboardCard';

interface CalorieSummaryProps {
  bmr: number;
  tdee: number;
  consumed: number;
  burned: number;
  net: number;
  remaining: number;
  calorieTarget: number;
  /** User's goal direction for plain-English explanation */
  goalDirection?: 'LOSE' | 'GAIN' | 'MAINTAIN';
  /** Activity level label for the math explanation */
  activityLabel?: string;
  /** ED-safe mode: hide calorie totals */
  hideCalories?: boolean;
}

function CalorieRow({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color != null && { color }]}>
        {Math.round(value).toLocaleString()}
      </Text>
    </View>
  );
}

export function CalorieSummary({
  bmr,
  tdee,
  consumed,
  burned,
  net,
  remaining,
  calorieTarget,
  goalDirection = 'MAINTAIN',
  activityLabel = 'your activity level',
  hideCalories = false,
}: CalorieSummaryProps) {
  const [mathExpanded, setMathExpanded] = useState(false);

  const remainingColor =
    remaining >= 0 ? Colors.successText : Colors.dangerText;

  const progressPct = calorieTarget > 0
    ? Math.min((consumed / calorieTarget) * 100, 100)
    : 0;

  // Plain-English goal explanation
  const goalExplanation =
    goalDirection === 'LOSE'
      ? `Since your goal is to lose weight, we subtract calories to create a safe deficit.`
      : goalDirection === 'GAIN'
        ? `Since your goal is to gain weight, we add extra calories for a surplus.`
        : `Since your goal is to maintain, your target matches your daily burn.`;

  const targetDiff = Math.abs(Math.round(calorieTarget) - Math.round(tdee));

  return (
    <DashboardCard title={hideCalories ? 'Nutrition' : 'Calories'}>
      {hideCalories ? (
        <Text style={styles.subtext}>Nutrient tracking active</Text>
      ) : (
        <>
          {/* HEADLINE: plain-language daily target */}
          <Text style={styles.headlineLabel}>Your Daily Target</Text>
          <Text style={styles.headlineValue}>
            {Math.round(calorieTarget).toLocaleString()} cal
          </Text>
          <Text style={styles.subtext}>
            Based on your body burning ~{Math.round(tdee).toLocaleString()} cal/day
          </Text>
        </>
      )}

      {/* EXPANDABLE: "See the math" */}
      {!hideCalories && <Pressable
        style={styles.expandToggle}
        onPress={() => setMathExpanded(!mathExpanded)}
        accessibilityRole="button"
        accessibilityLabel={mathExpanded ? 'Hide the math' : 'See the math'}
      >
        <Text style={styles.expandToggleText}>
          {mathExpanded ? 'Hide the math' : 'See the math'}
        </Text>
        <Ionicons
          name={mathExpanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.accentText}
        />
      </Pressable>}

      {!hideCalories && mathExpanded && (
        <View style={styles.mathSection}>
          <Text style={styles.mathText}>
            Your body burns about{' '}
            <Text style={styles.mathBold}>{Math.round(bmr).toLocaleString()} cal/day</Text>
            {' '}just to keep you alive (breathing, heartbeat, body temp).
          </Text>
          <Text style={styles.mathText}>
            With {activityLabel}, that goes up to about{' '}
            <Text style={styles.mathBold}>{Math.round(tdee).toLocaleString()} cal/day</Text>
            {' '}total.
          </Text>
          <Text style={styles.mathText}>
            {goalExplanation}
            {targetDiff > 0 && goalDirection !== 'MAINTAIN' && (
              ` That's ${goalDirection === 'LOSE' ? 'a' : 'an extra'} ${targetDiff.toLocaleString()} cal ${goalDirection === 'LOSE' ? 'deficit' : 'surplus'}.`
            )}
          </Text>
        </View>
      )}

      {/* Progress bar */}
      {!hideCalories && <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
      </View>}

      {/* Consumption data */}
      {!hideCalories && (
        <>
          <View style={styles.consumptionGrid}>
            <CalorieRow label="Consumed" value={consumed} />
            <CalorieRow label="Burned" value={burned} />
            <CalorieRow label="Net" value={net} />
          </View>

          <View style={styles.remainingContainer}>
            <Text style={styles.remainingLabel}>Remaining</Text>
            <Text style={[styles.remainingValue, { color: remainingColor }]}>
              {Math.round(remaining).toLocaleString()}
            </Text>
          </View>

          {(calorieTarget === CALORIE_FLOOR_FEMALE || calorieTarget === CALORIE_FLOOR_MALE) && (
            <Text style={styles.floorNote}>
              Your target has been set to the minimum safe level.
            </Text>
          )}
        </>
      )}
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  headlineLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headlineValue: {
    color: Colors.accentText,
    fontSize: 28,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  subtext: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginTop: 4,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingVertical: 4,
  },
  expandToggleText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  mathSection: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    gap: 8,
  },
  mathText: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  mathBold: {
    color: Colors.text,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    marginTop: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  consumptionGrid: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
  },
  rowValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  remainingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  remainingLabel: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '600',
  },
  remainingValue: {
    fontSize: 22,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  floorNote: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
