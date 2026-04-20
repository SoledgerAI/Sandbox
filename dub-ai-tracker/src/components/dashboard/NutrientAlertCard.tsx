// Sprint 22 — Dashboard nutrient UL alert card
// Surfaces critical (over-UL) nutrient alerts for today below the
// calorie summary. Shows at most 2 alert cards; overflow collapses into
// a "N more alerts" tap target that opens a combined detail dialog.

import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useNutrientReport } from '../../hooks/useNutrientReport';

const MAX_VISIBLE = 2;

export function NutrientAlertCard() {
  const { alerts } = useNutrientReport();

  const critical = useMemo(
    () => alerts.filter((a) => a.severity === 'critical'),
    [alerts],
  );

  if (critical.length === 0) return null;

  const visible = critical.slice(0, MAX_VISIBLE);
  const overflowCount = Math.max(0, critical.length - MAX_VISIBLE);

  const openReport = () => {
    router.push('/log/nutrient-report');
  };

  return (
    <View style={styles.wrapper}>
      {visible.map((alert) => (
        <TouchableOpacity
          key={alert.code}
          style={styles.card}
          onPress={openReport}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${alert.name} nutrient alert, tap for full report`}
        >
          <Ionicons name="warning-outline" size={20} color="#F59E0B" />
          <View style={styles.body}>
            <Text style={styles.title}>Nutrient Alert</Text>
            <Text style={styles.subtitle}>
              {alert.name} intake is {alert.total}
              {alert.unit} (limit: {alert.limit}
              {alert.unit})
            </Text>
            <Text style={styles.hint}>Tap to open full report</Text>
          </View>
        </TouchableOpacity>
      ))}
      {overflowCount > 0 && (
        <TouchableOpacity
          style={styles.overflow}
          onPress={openReport}
          activeOpacity={0.7}
        >
          <Text style={styles.overflowText}>
            {overflowCount} more alert{overflowCount > 1 ? 's' : ''} — tap to view
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  body: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: Colors.accentText,
    fontSize: 11,
    marginTop: 4,
  },
  overflow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  overflowText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '500',
  },
});
