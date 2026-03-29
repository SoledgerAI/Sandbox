// Calorie summary card showing BMR, TDEE, consumed, burned, net, remaining
// Phase 5: Dashboard Layout

import { StyleSheet, View, Text } from 'react-native';
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
}: CalorieSummaryProps) {
  const remainingColor =
    remaining >= 0 ? Colors.success : Colors.danger;

  const progressPct = calorieTarget > 0
    ? Math.min((consumed / calorieTarget) * 100, 100)
    : 0;

  return (
    <DashboardCard title="Calories">
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.grid}>
        <View style={styles.column}>
          <CalorieRow label="BMR" value={bmr} />
          <CalorieRow label="TDEE" value={tdee} />
          <CalorieRow label="Target" value={calorieTarget} color={Colors.accent} />
        </View>
        <View style={styles.divider} />
        <View style={styles.column}>
          <CalorieRow label="Consumed" value={consumed} />
          <CalorieRow label="Burned" value={burned} />
          <CalorieRow label="Net" value={net} />
        </View>
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
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: 12,
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
  progressBarContainer: {
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
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
