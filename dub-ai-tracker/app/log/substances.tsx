// Substances logging screen -- alcohol, cannabis, tobacco tabs + sobriety goals
// Phase 8: Hydration, Caffeine, and Substance Logging

import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { SubstanceLogger } from '../../src/components/logging/SubstanceLogger';
import { SobrietyGoals } from '../../src/components/logging/SobrietyGoals';

type ScreenMode = 'log' | 'goals';

export default function SubstancesScreen() {
  const [mode, setMode] = useState<ScreenMode>('log');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Substances</Text>
        <TouchableOpacity
          onPress={() => setMode(mode === 'log' ? 'goals' : 'log')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons
            name={mode === 'log' ? 'flag-outline' : 'list-outline'}
            size={22}
            color={Colors.accent}
          />
        </TouchableOpacity>
      </View>

      {/* Mode toggle label */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'log' && styles.modeTabActive]}
          onPress={() => setMode('log')}
        >
          <Text style={[styles.modeTabText, mode === 'log' && styles.modeTabTextActive]}>
            Log
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'goals' && styles.modeTabActive]}
          onPress={() => setMode('goals')}
        >
          <Text style={[styles.modeTabText, mode === 'goals' && styles.modeTabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'log' ? <SubstanceLogger /> : <SobrietyGoals />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  modeBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
  },
  modeTabActive: {
    backgroundColor: Colors.cardBackground,
  },
  modeTabText: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  modeTabTextActive: {
    color: Colors.accentText,
    fontWeight: '700',
  },
});
