// Settings > My Macros
// H6 split: extracted from (tabs)/settings.tsx
// Per-macro visibility toggles

import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { hapticSelection } from '../../src/utils/haptics';
import { useMacroPrefs, ALL_MACRO_OPTIONS } from '../../src/hooks/useMacroPrefs';

export default function MacrosScreen() {
  const { toggleMacro, isMacroEnabled } = useMacroPrefs();

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>My Macros</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.section}>
          {ALL_MACRO_OPTIONS.map((opt) => (
            <View key={opt.key} style={styles.settingRow}>
              <Ionicons name="nutrition-outline" size={22} color={Colors.accent} />
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{opt.label}{opt.unit ? ` (${opt.unit})` : ''}</Text>
                {opt.alwaysOn && (
                  <Text style={styles.settingSubtitle}>Always tracked</Text>
                )}
              </View>
              <Switch
                value={isMacroEnabled(opt.key)}
                onValueChange={() => { hapticSelection(); toggleMacro(opt.key); }}
                disabled={opt.alwaysOn}
                trackColor={{ false: Colors.divider, true: Colors.accent }}
                thumbColor={Colors.text}
              />
            </View>
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
  settingSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
});
