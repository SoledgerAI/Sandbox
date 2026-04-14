// Settings > Units
// Sprint 26: Centralized unit preferences
// All loggers read from SETTINGS_UNITS for consistent unit display

import { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/colors';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { storageGet, storageSet, STORAGE_KEYS } from '../../src/utils/storage';
import type {
  UnitSettings,
  WeightUnit,
  HeightUnit,
  TemperatureUnit,
  MeasurementUnit,
  HydrationUnit,
} from '../../src/types';
import { DEFAULT_UNIT_SETTINGS } from '../../src/types';

interface UnitOption<T extends string> {
  value: T;
  label: string;
}

const WEIGHT_OPTIONS: UnitOption<WeightUnit>[] = [
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'kg', label: 'Kilograms (kg)' },
];

const HEIGHT_OPTIONS: UnitOption<HeightUnit>[] = [
  { value: 'ft-in', label: 'Feet & Inches' },
  { value: 'cm', label: 'Centimeters' },
];

const TEMP_OPTIONS: UnitOption<TemperatureUnit>[] = [
  { value: 'F', label: 'Fahrenheit (\u00B0F)' },
  { value: 'C', label: 'Celsius (\u00B0C)' },
];

const WATER_OPTIONS: UnitOption<HydrationUnit>[] = [
  { value: 'cups', label: 'Cups' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'ml', label: 'Milliliters (ml)' },
];

const BODY_MEAS_OPTIONS: UnitOption<MeasurementUnit>[] = [
  { value: 'in', label: 'Inches (in)' },
  { value: 'cm', label: 'Centimeters (cm)' },
];

export default function UnitsScreen() {
  const [units, setUnits] = useState<UnitSettings>(DEFAULT_UNIT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storageGet<UnitSettings>(STORAGE_KEYS.SETTINGS_UNITS);
      if (saved) {
        setUnits({ ...DEFAULT_UNIT_SETTINGS, ...saved });
      } else {
        // Migrate from existing scattered settings
        const existingWeight = await storageGet<WeightUnit>(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT);
        const existingMeas = await storageGet<MeasurementUnit>(STORAGE_KEYS.SETTINGS_BODY_MEAS_UNIT);
        const hydrationGoal = await storageGet<{ unit?: HydrationUnit }>(STORAGE_KEYS.SETTINGS_HYDRATION_GOAL);

        const migrated: UnitSettings = {
          ...DEFAULT_UNIT_SETTINGS,
          ...(existingWeight ? { weight: existingWeight } : {}),
          ...(existingMeas ? { bodyMeasurements: existingMeas } : {}),
          ...(hydrationGoal?.unit ? { water: hydrationGoal.unit } : {}),
        };
        setUnits(migrated);
        await storageSet(STORAGE_KEYS.SETTINGS_UNITS, migrated);
      }
      setLoaded(true);
    })();
  }, []);

  async function updateUnit<K extends keyof UnitSettings>(key: K, value: UnitSettings[K]) {
    const updated = { ...units, [key]: value };
    setUnits(updated);
    await storageSet(STORAGE_KEYS.SETTINGS_UNITS, updated);

    // Also update legacy keys for backward compatibility
    if (key === 'weight') {
      await storageSet(STORAGE_KEYS.SETTINGS_BODY_MEAS_WEIGHT_UNIT, value);
    }
    if (key === 'bodyMeasurements') {
      await storageSet(STORAGE_KEYS.SETTINGS_BODY_MEAS_UNIT, value);
    }
  }

  if (!loaded) return null;

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Units</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.accent} />
          <Text style={styles.infoText}>
            These unit preferences apply across all loggers and screens in the app.
          </Text>
        </View>

        <UnitGroup
          label="Weight"
          icon="barbell-outline"
          options={WEIGHT_OPTIONS}
          selected={units.weight}
          onSelect={(v) => updateUnit('weight', v)}
        />

        <UnitGroup
          label="Height"
          icon="resize-outline"
          options={HEIGHT_OPTIONS}
          selected={units.height}
          onSelect={(v) => updateUnit('height', v)}
        />

        <UnitGroup
          label="Temperature"
          icon="thermometer-outline"
          options={TEMP_OPTIONS}
          selected={units.temperature}
          onSelect={(v) => updateUnit('temperature', v)}
        />

        <UnitGroup
          label="Water / Hydration"
          icon="water-outline"
          options={WATER_OPTIONS}
          selected={units.water}
          onSelect={(v) => updateUnit('water', v)}
        />

        <UnitGroup
          label="Body Measurements"
          icon="body-outline"
          options={BODY_MEAS_OPTIONS}
          selected={units.bodyMeasurements}
          onSelect={(v) => updateUnit('bodyMeasurements', v)}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

function UnitGroup<T extends string>({
  label,
  icon,
  options,
  selected,
  onSelect,
}: {
  label: string;
  icon: string;
  options: UnitOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.unitCard}>
      <View style={styles.unitHeader}>
        <Ionicons name={icon as any} size={20} color={Colors.accent} />
        <Text style={styles.unitLabel}>{label}</Text>
      </View>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionBtn, selected === opt.value && styles.optionBtnActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionText, selected === opt.value && styles.optionTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryBackground },
  content: { padding: 16, paddingTop: 12, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: 'bold' },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { color: Colors.secondaryText, fontSize: 13, lineHeight: 18, flex: 1 },
  unitCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  unitLabel: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.divider,
    backgroundColor: Colors.primaryBackground,
  },
  optionBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  optionText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  optionTextActive: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
});
