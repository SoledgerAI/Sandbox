// Settings > Personalization
// H6 split: extracted from (tabs)/settings.tsx
// Sex, Age Range, ZIP, Intermittent Fasting, Population Comparison

import { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { hapticSelection } from '../../src/utils/haptics';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type { AppSettings, UserProfile, BiologicalSex } from '../../src/types/profile';
import {
  type Equipment,
  FULL_GYM_EXPANSION,
} from '../../src/config/exerciseCatalog';
import {
  getUserSex,
  setUserSex as saveUserSex,
  getUserAgeRange,
  setUserAgeRange as saveUserAgeRange,
  getUserZip,
  setUserZip as saveUserZip,
} from '../../src/services/onboardingService';
import type { AgeRange } from '../../src/services/onboardingService';

type FastingProtocol = '16:8' | '18:6' | '20:4' | 'custom';

const FASTING_PROTOCOL_DEFAULTS: Record<FastingProtocol, { start: number; end: number }> = {
  '16:8': { start: 12, end: 20 },
  '18:6': { start: 12, end: 18 },
  '20:4': { start: 14, end: 18 },
  'custom': { start: 12, end: 20 },
};

function formatHour(h: number): string {
  if (h > 12) return `${h - 12}pm`;
  if (h === 12) return '12pm';
  return `${h}am`;
}

async function patchSettings(patch: Partial<AppSettings>): Promise<void> {
  const s = (await storageGet<AppSettings>(STORAGE_KEYS.SETTINGS)) || ({} as AppSettings);
  await storageSet(STORAGE_KEYS.SETTINGS, { ...s, ...patch });
}

export default function PersonalizationScreen() {
  const [loading, setLoading] = useState(true);

  const [userSex, setUserSexState] = useState<BiologicalSex | null>(null);
  const [userAgeRange, setUserAgeRangeState] = useState<AgeRange | null>(null);
  const [userZip, setUserZipState] = useState<string | null>(null);
  const [showSexPicker, setShowSexPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showZipInput, setShowZipInput] = useState(false);

  const [showPopulationComparison, setShowPopulationComparison] = useState(false);
  const [hasProfileForComparison, setHasProfileForComparison] = useState(false);

  const [fastingEnabled, setFastingEnabled] = useState(false);
  const [fastingProtocol, setFastingProtocol] = useState<FastingProtocol>('16:8');
  const [eatingWindowStart, setEatingWindowStart] = useState(12);
  const [eatingWindowEnd, setEatingWindowEnd] = useState(20);
  const [showFastingProtocol, setShowFastingProtocol] = useState(false);

  // S36: Strength equipment election. Stored as Equipment[]; "Full gym" is
  // a display checkbox that maps to the FULL_GYM_EXPANSION items.
  const [equipment, setEquipment] = useState<Equipment[]>(['bodyweight']);

  useEffect(() => {
    (async () => {
      const [profile, sex, age, zip, appSettings, equip] = await Promise.all([
        storageGet<UserProfile>(STORAGE_KEYS.PROFILE),
        getUserSex(),
        getUserAgeRange(),
        getUserZip(),
        storageGet<AppSettings>(STORAGE_KEYS.SETTINGS),
        storageGet<Equipment[]>(STORAGE_KEYS.SETTINGS_EQUIPMENT),
      ]);
      setUserSexState(sex);
      setUserAgeRangeState(age);
      setUserZipState(zip);
      setHasProfileForComparison(!!profile?.dob && !!profile?.sex && profile.sex !== 'prefer_not_to_say');
      if (appSettings?.show_population_comparison) setShowPopulationComparison(true);
      if (appSettings?.fasting_enabled) setFastingEnabled(true);
      if (appSettings?.fasting_protocol) setFastingProtocol(appSettings.fasting_protocol);
      if (appSettings?.eating_window_start != null) setEatingWindowStart(appSettings.eating_window_start);
      if (appSettings?.eating_window_end != null) setEatingWindowEnd(appSettings.eating_window_end);
      if (Array.isArray(equip) && equip.length > 0) setEquipment(equip);
      setLoading(false);
    })();
  }, []);

  const fullGymChecked = FULL_GYM_EXPANSION.every((eq) => equipment.includes(eq));

  async function toggleEquipment(item: Equipment | 'full_gym') {
    hapticSelection();
    let next: Equipment[];
    if (item === 'full_gym') {
      next = fullGymChecked
        ? equipment.filter((eq) => !FULL_GYM_EXPANSION.includes(eq))
        : Array.from(new Set([...equipment, ...FULL_GYM_EXPANSION]));
    } else {
      next = equipment.includes(item)
        ? equipment.filter((eq) => eq !== item)
        : [...equipment, item];
    }
    setEquipment(next);
    await storageSet(STORAGE_KEYS.SETTINGS_EQUIPMENT, next);
  }

  async function handleSexChange(sex: BiologicalSex) {
    await saveUserSex(sex);
    setUserSexState(sex);
    setShowSexPicker(false);
  }

  async function handleAgeChange(range: AgeRange) {
    await saveUserAgeRange(range);
    setUserAgeRangeState(range);
    setShowAgePicker(false);
  }

  async function handleZipSave(zip: string) {
    if (zip && /^\d{5}$/.test(zip)) {
      await saveUserZip(zip);
      setUserZipState(zip);
    }
    setShowZipInput(false);
  }

  async function handlePopulationComparisonToggle(enabled: boolean) {
    await patchSettings({ show_population_comparison: enabled });
    setShowPopulationComparison(enabled);
  }

  async function handleFastingToggle(enabled: boolean) {
    await patchSettings({ fasting_enabled: enabled });
    setFastingEnabled(enabled);
  }

  async function handleFastingProtocol(protocol: FastingProtocol) {
    const d = FASTING_PROTOCOL_DEFAULTS[protocol];
    await patchSettings({ fasting_protocol: protocol, eating_window_start: d.start, eating_window_end: d.end });
    setFastingProtocol(protocol);
    setEatingWindowStart(d.start);
    setEatingWindowEnd(d.end);
    setShowFastingProtocol(false);
  }

  async function handleEatingWindowChange(start: number, end: number) {
    await patchSettings({ eating_window_start: start, eating_window_end: end });
    setEatingWindowStart(start);
    setEatingWindowEnd(end);
  }

  const sexDisplayLabel = userSex === 'male' ? 'Male' : userSex === 'female' ? 'Female' : userSex === 'intersex' ? 'Intersex' : userSex === 'prefer_not_to_say' ? 'Prefer not to say' : 'Not set';

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Personalization</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={styles.loader}><LoadingIndicator /></View>
        ) : (
          <View style={styles.section}>
            <PickerRow
              icon="person-outline"
              label="Sex"
              value={sexDisplayLabel}
              expanded={showSexPicker}
              onPress={() => setShowSexPicker(!showSexPicker)}
            />
            {showSexPicker && (
              <PickerOptions
                options={(['male', 'female', 'prefer_not_to_say'] as BiologicalSex[]).map((v) => ({
                  value: v,
                  label: v === 'male' ? 'Male' : v === 'female' ? 'Female' : 'Prefer not to say',
                }))}
                selected={userSex}
                onSelect={handleSexChange}
              />
            )}

            <PickerRow
              icon="calendar-outline"
              label="Age Range"
              value={userAgeRange || 'Not set'}
              expanded={showAgePicker}
              onPress={() => setShowAgePicker(!showAgePicker)}
            />
            {showAgePicker && (
              <PickerOptions
                options={(['18-29', '30-44', '45-59', '60+'] as AgeRange[]).map((v) => ({ value: v, label: v }))}
                selected={userAgeRange}
                onSelect={handleAgeChange}
              />
            )}

            <PickerRow
              icon="location-outline"
              label="ZIP Code"
              value={userZip || 'Not set'}
              expanded={showZipInput}
              onPress={() => setShowZipInput(!showZipInput)}
            />
            {showZipInput && (
              <View style={styles.pickerGroup}>
                <ZipInputRow currentZip={userZip} onSave={handleZipSave} />
              </View>
            )}

            <ToggleRow
              icon="timer-outline"
              label="Intermittent Fasting"
              subtitle="I practice intermittent fasting"
              value={fastingEnabled}
              onValueChange={handleFastingToggle}
            />

            {fastingEnabled && (
              <>
                <PickerRow
                  icon="nutrition-outline"
                  label="Protocol"
                  value={fastingProtocol}
                  expanded={showFastingProtocol}
                  onPress={() => setShowFastingProtocol(!showFastingProtocol)}
                />
                {showFastingProtocol && (
                  <PickerOptions
                    options={(['16:8', '18:6', '20:4', 'custom'] as FastingProtocol[]).map((v) => {
                      const d = FASTING_PROTOCOL_DEFAULTS[v];
                      return {
                        value: v,
                        label: v === 'custom' ? 'Custom' : `${v} (${formatHour(d.start)} – ${formatHour(d.end)})`,
                      };
                    })}
                    selected={fastingProtocol}
                    onSelect={handleFastingProtocol}
                  />
                )}

                <View style={styles.settingRow}>
                  <Ionicons name="restaurant-outline" size={22} color={Colors.accent} />
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Eating Window</Text>
                    <Text style={styles.settingSubtitle}>
                      {formatHour(eatingWindowStart)} – {formatHour(eatingWindowEnd)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => handleEatingWindowChange(Math.max(0, eatingWindowStart - 1), eatingWindowEnd)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="remove-circle-outline" size={24} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEatingWindowChange(Math.min(23, eatingWindowStart + 1), eatingWindowEnd)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add-circle-outline" size={24} color={Colors.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <ToggleRow
              icon="people-outline"
              label="Show population comparison"
              subtitle={
                hasProfileForComparison
                  ? 'Compare your metrics to age/sex averages'
                  : 'Set your date of birth and biological sex in Profile to enable'
              }
              value={showPopulationComparison}
              onValueChange={handlePopulationComparisonToggle}
              disabled={!hasProfileForComparison}
            />

            <Text style={styles.sectionHeader}>Strength Training Equipment</Text>
            <Text style={styles.sectionSubheader}>
              Filters the exercise picker to what you can actually do.
            </Text>
            <CheckboxRow icon="body-outline"      label="Bodyweight only"  checked={equipment.includes('bodyweight')} onPress={() => toggleEquipment('bodyweight')} />
            <CheckboxRow icon="barbell-outline"   label="Dumbbells"        checked={equipment.includes('dumbbells')}  onPress={() => toggleEquipment('dumbbells')} />
            <CheckboxRow icon="barbell-outline"   label="Barbell + plates" checked={equipment.includes('barbell')}    onPress={() => toggleEquipment('barbell')} />
            <CheckboxRow icon="ellipse-outline"   label="Kettlebells"      checked={equipment.includes('kettlebell')} onPress={() => toggleEquipment('kettlebell')} />
            <CheckboxRow icon="reorder-four-outline" label="Resistance bands" checked={equipment.includes('bands')}    onPress={() => toggleEquipment('bands')} />
            <CheckboxRow icon="business-outline"  label="Full gym"         subtitle="Cables, machines, smith, TRX, bench" checked={fullGymChecked} onPress={() => toggleEquipment('full_gym')} />
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function CheckboxRow({ icon, label, subtitle, checked, onPress }: { icon: string; label: string; subtitle?: string; checked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={22} color={Colors.accent} />
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {subtitle != null && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? Colors.accent : Colors.secondaryText}
      />
    </TouchableOpacity>
  );
}

function PickerRow({ icon, label, value, expanded, onPress }: { icon: string; label: string; value: string; expanded: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={22} color={Colors.accent} />
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSubtitle}>{value}</Text>
      </View>
      <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={Colors.secondaryText} />
    </TouchableOpacity>
  );
}

function PickerOptions<T extends string>({ options, selected, onSelect }: { options: { value: T; label: string }[]; selected: T | null; onSelect: (v: T) => void }) {
  return (
    <View style={styles.pickerGroup}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.pickerOption, selected === opt.value && styles.pickerOptionSelected]}
          onPress={() => onSelect(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pickerOptionText, selected === opt.value && styles.pickerOptionTextSelected]}>
            {opt.label}
          </Text>
          {selected === opt.value && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ToggleRow({ icon, label, subtitle, value, onValueChange, disabled }: { icon: string; label: string; subtitle: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon as any} size={22} color={Colors.accent} />
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => { hapticSelection(); onValueChange(v); }}
        disabled={disabled}
        trackColor={{ false: Colors.divider, true: Colors.accent }}
        thumbColor={Colors.text}
      />
    </View>
  );
}

function ZipInputRow({ currentZip, onSave }: { currentZip: string | null; onSave: (zip: string) => void }) {
  const [value, setValue] = useState(currentZip || '');
  return (
    <View style={styles.zipRow}>
      <TextInput
        style={styles.zipInput}
        value={value}
        onChangeText={(text) => setValue(text.replace(/[^0-9]/g, '').slice(0, 5))}
        placeholder="00000"
        placeholderTextColor={Colors.divider}
        keyboardType="number-pad"
        maxLength={5}
        returnKeyType="done"
        onSubmitEditing={() => onSave(value)}
      />
      <TouchableOpacity style={styles.zipSaveBtn} onPress={() => onSave(value)} activeOpacity={0.7}>
        <Text style={styles.zipSaveBtnText}>Save</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: Spacing.lg, paddingTop: 12, paddingBottom: Spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  loader: { paddingVertical: 40 },
  section: { gap: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, borderRadius: 10, padding: Spacing.lg, gap: Spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { color: Colors.text, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  settingSubtitle: { color: Colors.secondaryText, fontSize: 12, marginTop: 2 },
  pickerGroup: { backgroundColor: Colors.inputBackground, borderRadius: 10, padding: 6, gap: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8 },
  pickerOptionSelected: { backgroundColor: Colors.cardBackground },
  pickerOptionText: { color: Colors.text, fontSize: 15 },
  pickerOptionTextSelected: { color: Colors.accentText, fontWeight: '600' },
  zipRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  zipInput: { flex: 1, backgroundColor: Colors.cardBackground, color: Colors.text, fontSize: 18, fontWeight: '600', textAlign: 'center', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, letterSpacing: 4 },
  zipSaveBtn: { backgroundColor: Colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  zipSaveBtnText: { color: Colors.primaryBackground, fontSize: 15, fontWeight: '600' },
  sectionHeader: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 4,
  },
  sectionSubheader: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginBottom: 8,
  },
});
