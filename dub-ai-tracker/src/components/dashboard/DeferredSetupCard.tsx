// Deferred setup prompt card for Dashboard
// P1-08: Express onboarding — cards appear Days 1-4 after onboarding
// Each card: [Set Up] navigates to relevant Settings screen
//            [Not Now] dismisses for the day, retries next day, max 3 times

import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import type { DeferredSetupKey } from '../../hooks/useDeferredSetup';

interface DeferredSetupCardProps {
  title: string;
  description: string;
  icon: string;
  route: string;
  itemKey: DeferredSetupKey;
  onSetUp: (key: DeferredSetupKey) => void;
  onDismiss: (key: DeferredSetupKey) => void;
}

export function DeferredSetupCard({
  title,
  description,
  icon,
  route,
  itemKey,
  onSetUp,
  onDismiss,
}: DeferredSetupCardProps) {
  function handleSetUp() {
    onSetUp(itemKey);
    router.push(route as any);
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon as any} size={22} color={Colors.accent} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss(itemKey)}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Not Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.setupButton}
          onPress={handleSetUp}
          activeOpacity={0.7}
        >
          <Text style={styles.setupText}>Set Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: Colors.secondaryText,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    minHeight: 48,
    justifyContent: 'center',
  },
  dismissText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  setupButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.accent,
  },
  setupText: {
    color: Colors.primaryBackground,
    fontSize: 14,
    fontWeight: '600',
  },
});
