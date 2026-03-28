// Generic dashboard card component
// Phase 5: Dashboard Layout
// Phase 18: Added device source indicator for device-synced data

import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

interface DashboardCardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional device source label (e.g., "Apple Health", "Strava") */
  deviceSource?: string | null;
}

export function DashboardCard({ title, children, style, deviceSource }: DashboardCardProps) {
  return (
    <View style={[styles.card, style]}>
      {(title != null || deviceSource) && (
        <View style={styles.titleRow}>
          {title != null && <Text style={styles.title}>{title}</Text>}
          {deviceSource != null && (
            <View style={styles.deviceBadge}>
              <Ionicons name="sync-outline" size={10} color={Colors.accent} />
              <Text style={styles.deviceText}>{deviceSource}</Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deviceText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '500',
  },
});
