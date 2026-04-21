// Settings > Appearance
// H6 split: extracted from (tabs)/settings.tsx
// Theme mode: dark / light / system

import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { hapticSelection } from '../../src/utils/haptics';
import { useTheme, type ThemeMode } from '../../src/contexts/ThemeContext';

export default function AppearanceScreen() {
  const { mode: themeMode, setMode: setThemeMode } = useTheme();

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Appearance</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.section}>
          {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.settingRow}
              onPress={() => { hapticSelection(); setThemeMode(mode); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={mode === 'dark' ? 'moon-outline' : mode === 'light' ? 'sunny-outline' : 'phone-portrait-outline'}
                size={22}
                color={themeMode === mode ? Colors.accent : Colors.secondaryText}
              />
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, themeMode === mode && { color: Colors.accentText }]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </View>
              {themeMode === mode && (
                <Ionicons name="checkmark" size={20} color={Colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: Spacing.lg, paddingTop: 12, paddingBottom: Spacing.xxxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  section: { gap: 6 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  settingInfo: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium },
});
