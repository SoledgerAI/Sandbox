// Premium card component with consistent styling
// Sprint 15: Global UI Polish — Premium Finish

import { StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface PremiumCardProps {
  children: React.ReactNode;
  elevated?: boolean;
  style?: ViewStyle;
}

export function PremiumCard({ children, elevated = false, style }: PremiumCardProps) {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  elevated: {
    backgroundColor: Colors.elevated,
  },
});
