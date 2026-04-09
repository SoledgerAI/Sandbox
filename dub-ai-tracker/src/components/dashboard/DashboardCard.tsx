// Generic dashboard card component — Sprint 15: uses PremiumCard styling
// Phase 5: Dashboard Layout
// Phase 18: Added device source indicator for device-synced data

import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { FontSize } from '../../constants/typography';
import { PremiumCard } from '../common/PremiumCard';

interface DashboardCardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Optional device source label (e.g., "Apple Health", "Strava") */
  deviceSource?: string | null;
}

export function DashboardCard({ title, children, style, deviceSource }: DashboardCardProps) {
  return (
    <PremiumCard style={style}>
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
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: Colors.accentText,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  deviceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.elevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  deviceText: {
    color: Colors.accentText,
    fontSize: 11,
    fontWeight: '500',
  },
});
