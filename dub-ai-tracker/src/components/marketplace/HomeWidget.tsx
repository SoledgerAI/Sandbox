// Home Screen Widget Configuration (STRETCH GOAL)
// Phase 22: Marketplace, Influencer System, and Polish
//
// STABILITY WARNING: expo-widgets is experimental/community package.
// Home screen widgets require native code (WidgetKit on iOS, AppWidgetProvider
// on Android) and are among the most complex native integrations in React Native.
// Per Expert 2 Audit (Severity: MEDIUM): treat as STRETCH GOAL.
// Do not let widget instability block v1 launch.
//
// Implementation approach: config plugin with custom native code
// rather than relying on community package.
//
// Widget Display (small size):
//   - Daily score (number)
//   - Calories remaining
//   - Water progress (oz consumed / goal)
//   - Step count
//
// Widget Display (medium size):
//   - All of small + mini sparklines for calories and weight
//
// Tap action: Opens DUB_AI app to Dashboard

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

// Widget data interface -- represents the data sent to native widget
export interface WidgetData {
  dailyScore: number | null;
  caloriesRemaining: number | null;
  caloriesTarget: number | null;
  waterOz: number | null;
  waterGoalOz: number;
  steps: number | null;
  stepsGoal: number;
  // Medium widget additions
  caloriesSparkline: number[]; // last 7 days
  weightSparkline: number[]; // last 7 days
}

// Widget preview component (for settings/preview, not the actual native widget)
export function WidgetPreview({ data }: { data: WidgetData }) {
  return (
    <View style={styles.previewContainer}>
      <Text style={styles.previewTitle}>Widget Preview</Text>
      <Text style={styles.previewSubtitle}>
        Home screen widget requires native build. This is a preview of the widget layout.
      </Text>

      {/* Small widget preview */}
      <View style={styles.widgetSmall}>
        <Text style={styles.widgetLabel}>DUB_AI</Text>

        <View style={styles.widgetRow}>
          <View style={styles.widgetStat}>
            <Ionicons name="trophy-outline" size={16} color={Colors.accent} />
            <Text style={styles.widgetValue}>{data.dailyScore ?? '--'}</Text>
            <Text style={styles.widgetStatLabel}>Score</Text>
          </View>

          <View style={styles.widgetStat}>
            <Ionicons name="flame-outline" size={16} color={Colors.accent} />
            <Text style={styles.widgetValue}>{data.caloriesRemaining ?? '--'}</Text>
            <Text style={styles.widgetStatLabel}>Cal Left</Text>
          </View>
        </View>

        <View style={styles.widgetRow}>
          <View style={styles.widgetStat}>
            <Ionicons name="water-outline" size={16} color={Colors.accent} />
            <Text style={styles.widgetValue}>
              {data.waterOz ?? 0}/{data.waterGoalOz}
            </Text>
            <Text style={styles.widgetStatLabel}>Water (oz)</Text>
          </View>

          <View style={styles.widgetStat}>
            <Ionicons name="footsteps-outline" size={16} color={Colors.accent} />
            <Text style={styles.widgetValue}>
              {data.steps != null ? data.steps.toLocaleString() : '--'}
            </Text>
            <Text style={styles.widgetStatLabel}>Steps</Text>
          </View>
        </View>
      </View>

      <Text style={styles.widgetNote}>
        Tap widget to open DUB_AI Dashboard. Native widget implementation requires
        WidgetKit (iOS) / AppWidgetProvider (Android) via config plugin.
      </Text>
    </View>
  );
}

// Stub function for updating widget data (would call native bridge)
export async function updateWidgetData(data: WidgetData): Promise<void> {
  // In production, this would use a native module to update the widget:
  // iOS: WidgetCenter.shared.reloadAllTimelines()
  // Android: AppWidgetManager.updateAppWidget()
  //
  // For now, this is a no-op stub.
  // console.log('[Widget] Data update queued (stub)');
}

const styles = StyleSheet.create({
  previewContainer: {
    gap: 12,
    padding: 16,
  },
  previewTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  previewSubtitle: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  widgetSmall: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  widgetLabel: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  widgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  widgetStat: {
    alignItems: 'center',
    gap: 2,
  },
  widgetValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  widgetStatLabel: {
    color: Colors.secondaryText,
    fontSize: 10,
  },
  widgetNote: {
    color: Colors.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
