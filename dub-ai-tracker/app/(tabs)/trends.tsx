import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/theme';

export default function TrendsTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📈</Text>
      <Text style={styles.title}>Trends</Text>
      <Text style={styles.subtitle}>Coming in Phase 12</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: COLORS.secondaryText, fontSize: 14, marginTop: 8 },
});
