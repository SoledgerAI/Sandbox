// S33-A: Modal save/edit dialog for rep presets.
// Three scroll-wheel pickers (sets, reps, weight) per the §1.8 standing
// rule for value entry. Reuses @react-native-picker/picker.

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/colors';
import type { RepPreset } from '../../types';

const SETS_VALUES: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
// 1..50, then 'AMRAP' as the final option.
const REPS_VALUES: Array<number | 'AMRAP'> = [
  ...Array.from({ length: 50 }, (_, i) => i + 1),
  'AMRAP' as const,
];
const WEIGHT_VALUES: number[] = Array.from({ length: 201 }, (_, i) => i * 2.5); // 0..500 in 2.5lb increments

export interface PresetDraft {
  sets: number;
  reps: number | 'AMRAP';
  weight_lb?: number;
  label?: string;
}

interface Props {
  visible: boolean;
  initial?: PresetDraft;
  onCancel: () => void;
  onSave: (draft: PresetDraft) => void;
  isEdit?: boolean;
}

export function PresetSaveDialog({ visible, initial, onCancel, onSave, isEdit }: Props) {
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<number | 'AMRAP'>(10);
  const [weight, setWeight] = useState<number>(0);
  const [hasWeight, setHasWeight] = useState<boolean>(false);
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    if (!visible) return;
    setSets(initial?.sets ?? 3);
    setReps(initial?.reps ?? 10);
    setWeight(initial?.weight_lb ?? 0);
    setHasWeight(initial?.weight_lb != null);
    setLabel(initial?.label ?? '');
  }, [visible, initial]);

  const handleSave = () => {
    const draft: PresetDraft = {
      sets,
      reps,
      ...(hasWeight ? { weight_lb: weight } : {}),
      ...(label.trim().length > 0 ? { label: label.trim() } : {}),
    };
    onSave(draft);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{isEdit ? 'Edit scheme' : 'Save scheme'}</Text>

          <View style={styles.pickerRow}>
            <View style={styles.pickerCol}>
              <Text style={styles.label}>Sets</Text>
              <Picker
                selectedValue={sets}
                onValueChange={(v) => setSets(Number(v))}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                testID="preset-sets-picker"
              >
                {SETS_VALUES.map((v) => (
                  <Picker.Item key={v} label={`${v}`} value={v} />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerCol}>
              <Text style={styles.label}>Reps</Text>
              <Picker
                selectedValue={reps}
                onValueChange={(v) => setReps(v === 'AMRAP' ? 'AMRAP' : Number(v))}
                style={styles.picker}
                itemStyle={styles.pickerItem}
                testID="preset-reps-picker"
              >
                {REPS_VALUES.map((v) => (
                  <Picker.Item key={String(v)} label={String(v)} value={v} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.weightToggleRow}>
            <Text style={styles.label}>Weight (optional)</Text>
            <TouchableOpacity
              style={[styles.toggle, hasWeight && styles.toggleSelected]}
              onPress={() => setHasWeight((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleLabel, hasWeight && styles.toggleLabelSelected]}>
                {hasWeight ? 'Weight set' : 'No weight'}
              </Text>
            </TouchableOpacity>
          </View>
          {hasWeight && (
            <Picker
              selectedValue={weight}
              onValueChange={(v) => setWeight(Number(v))}
              style={styles.picker}
              itemStyle={styles.pickerItem}
              testID="preset-weight-picker"
            >
              {WEIGHT_VALUES.map((v) => (
                <Picker.Item key={v} label={`${v} lb`} value={v} />
              ))}
            </Picker>
          )}

          <Text style={styles.label}>Label (optional)</Text>
          <TextInput
            style={styles.labelInput}
            value={label}
            onChangeText={(t) => setLabel(t.slice(0, 24))}
            placeholder="e.g. warmup, heavy"
            placeholderTextColor={Colors.secondaryText}
            maxLength={24}
          />

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7} testID="preset-save-confirm">
              <Text style={styles.saveBtnText}>{isEdit ? 'Update' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerCol: {
    flex: 1,
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 12,
    marginBottom: 4,
  },
  picker: {
    color: Colors.text,
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
  },
  pickerItem: {
    color: Colors.text,
    fontSize: 16,
  },
  weightToggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  toggle: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  toggleSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  toggleLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  toggleLabelSelected: {
    color: Colors.primaryBackground,
    fontWeight: '600',
  },
  labelInput: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 10,
    padding: 10,
    color: Colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.inputBackground,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveBtnText: {
    color: Colors.primaryBackground,
    fontSize: 15,
    fontWeight: '700',
  },
});
