// Generic dashboard card component
// Phase 5: Dashboard Layout

import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface DashboardCardProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function DashboardCard({ title, children, style }: DashboardCardProps) {
  return (
    <View style={[styles.card, style]}>
      {title != null && <Text style={styles.title}>{title}</Text>}
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
  title: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
});
