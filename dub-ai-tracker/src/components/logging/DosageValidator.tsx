// Dosage validator -- cross-references supplement intake against NIH UL values
// Phase 13: Supplements, Personal Care, and Remaining Tags

import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import supplementUls from '../../data/supplement_uls.json';

interface ULEntry {
  name: string;
  ul_value: number;
  ul_unit: string;
  ul_note: string | null;
  source: string;
}

const UL_DATA: Record<string, ULEntry> = supplementUls;

// Map common supplement names to UL keys
const NAME_TO_UL_KEY: Record<string, string> = {
  'vitamin d': 'vitamin_d',
  'vitamin d3': 'vitamin_d',
  'd3': 'vitamin_d',
  calcium: 'calcium',
  iron: 'iron',
  zinc: 'zinc',
  'vitamin c': 'vitamin_c',
  'vitamin a': 'vitamin_a',
  folate: 'folate',
  'folic acid': 'folate',
  'b9': 'folate',
  magnesium: 'magnesium',
  niacin: 'niacin_b3',
  'vitamin b3': 'niacin_b3',
  b3: 'niacin_b3',
  'vitamin b6': 'vitamin_b6',
  b6: 'vitamin_b6',
};

export function findULKey(supplementName: string): string | null {
  const lower = supplementName.toLowerCase().trim();
  return NAME_TO_UL_KEY[lower] ?? null;
}

export function checkDosageWarning(
  supplementName: string,
  dailyTotal: number,
  unit: string,
): { exceeded: boolean; ulValue: number; ulUnit: string; supplementDisplayName: string } | null {
  const key = findULKey(supplementName);
  if (!key || !UL_DATA[key]) return null;

  const ul = UL_DATA[key];
  // Only compare if units match (basic normalization)
  const normalizedUnit = unit.toLowerCase().replace(/\./g, '');
  const normalizedUlUnit = ul.ul_unit.toLowerCase().replace(/\./g, '');
  if (normalizedUnit !== normalizedUlUnit) return null;

  return {
    exceeded: dailyTotal > ul.ul_value,
    ulValue: ul.ul_value,
    ulUnit: ul.ul_unit,
    supplementDisplayName: ul.name,
  };
}

interface DosageWarningBannerProps {
  supplementName: string;
  dailyTotal: number;
  unit: string;
}

export function DosageWarningBanner({ supplementName, dailyTotal, unit }: DosageWarningBannerProps) {
  const result = checkDosageWarning(supplementName, dailyTotal, unit);
  if (!result || !result.exceeded) return null;

  return (
    <View style={styles.warningBanner}>
      <Ionicons name="warning" size={20} color={Colors.warning} />
      <View style={styles.warningContent}>
        <Text style={styles.warningText}>
          Your daily {result.supplementDisplayName} intake of {dailyTotal} {unit} exceeds
          the Tolerable Upper Intake Level of {result.ulValue} {result.ulUnit} established
          by the National Academies of Medicine.
        </Text>
        <Text style={styles.disclaimerText}>Consult your healthcare provider.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: '#3D3520',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  disclaimerText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
});
