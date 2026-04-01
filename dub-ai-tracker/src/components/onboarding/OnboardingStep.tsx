// Generic step container for onboarding
// Phase 3: Onboarding Flow

import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Colors } from '../../constants/colors';

interface OnboardingStepProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function OnboardingStep({ title, subtitle, children }: OnboardingStepProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
  },
  title: {
    color: Colors.accentText,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  body: {
    flex: 1,
  },
});
