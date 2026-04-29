// S33-B: cadence picker modal for habit add/edit.
// Scroll-wheel sub-pickers per §1.8 standing rule. Reuses
// @react-native-picker/picker directly (per Josh's "no wrapper" rule).

import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/colors';
import type { CadenceRule } from '../../types';
import { hasWeekdayBit, setWeekdayBit, clearWeekdayBit } from '../../utils/cadence';

type Kind = 'daily' | 'weekdays' | 'count_per_week' | 'every_n_days';

const KIND_LABELS: Record<Kind, string> = {
  daily: 'Daily',
  weekdays: 'Specific days',
  count_per_week: 'X× per week',
  every_n_days: 'Every N days',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const COUNT_VALUES = Array.from({ length: 7 }, (_, i) => i + 1); // 1..7
const N_DAYS_VALUES = Array.from({ length: 29 }, (_, i) => i + 2); // 2..30

interface Props {
  visible: boolean;
  initial?: { cadence: CadenceRule; target?: number };
  onCancel: () => void;
  onSave: (cadence: CadenceRule, target?: number) => void;
}

export function CadencePickerModal({ visible, initial, onCancel, onSave }: Props) {
  const [kind, setKind] = useState<Kind>('daily');
  const [mask, setMask] = useState<number>(0b0111110); // Mon-Fri default
  const [count, setCount] = useState<number>(3);
  const [n, setN] = useState<number>(2);
  const [target, setTarget] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;
    const c = initial?.cadence ?? { kind: 'daily' };
    setKind(c.kind);
    if (c.kind === 'weekdays') setMask(c.days);
    if (c.kind === 'count_per_week') setCount(c.count);
    if (c.kind === 'every_n_days') setN(c.n);
    setTarget(initial?.target);
  }, [visible, initial]);

  const handleSave = () => {
    let cadence: CadenceRule;
    let savedTarget: number | undefined = target;
    switch (kind) {
      case 'daily':
        cadence = { kind: 'daily' };
        break;
      case 'weekdays':
        cadence = { kind: 'weekdays', days: mask };
        break;
      case 'count_per_week':
        cadence = { kind: 'count_per_week', count };
        // count_per_week implicitly sets target unless user overrode.
        if (savedTarget == null) savedTarget = count;
        break;
      case 'every_n_days':
        cadence = { kind: 'every_n_days', n };
        break;
    }
    onSave(cadence, savedTarget);
  };

  const toggleDay = (i: number) => {
    if (hasWeekdayBit(mask, i)) {
      setMask(clearWeekdayBit(mask, i));
    } else {
      setMask(setWeekdayBit(mask, i));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Cadence</Text>

          {/* Kind segmented selector */}
          <View style={styles.kindRow}>
            {(Object.keys(KIND_LABELS) as Kind[]).map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.kindChip, kind === k && styles.kindChipActive]}
                onPress={() => setKind(k)}
              >
                <Text style={[styles.kindLabel, kind === k && styles.kindLabelActive]}>
                  {KIND_LABELS[k]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Sub-picker contextual to kind */}
          {kind === 'weekdays' && (
            <View style={styles.daysRow}>
              {DAY_NAMES.map((name, i) => (
                <TouchableOpacity
                  key={name}
                  onPress={() => toggleDay(i)}
                  style={[styles.dayChip, hasWeekdayBit(mask, i) && styles.dayChipActive]}
                  accessibilityLabel={`Toggle ${name}`}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      hasWeekdayBit(mask, i) && styles.dayLabelActive,
                    ]}
                  >
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {kind === 'count_per_week' && (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Times per week</Text>
              <Picker
                selectedValue={count}
                onValueChange={(v) => setCount(Number(v))}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {COUNT_VALUES.map((v) => (
                  <Picker.Item key={v} label={String(v)} value={v} color={Colors.text} />
                ))}
              </Picker>
            </View>
          )}

          {kind === 'every_n_days' && (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Every N days</Text>
              <Picker
                selectedValue={n}
                onValueChange={(v) => setN(Number(v))}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {N_DAYS_VALUES.map((v) => (
                  <Picker.Item key={v} label={String(v)} value={v} color={Colors.text} />
                ))}
              </Picker>
            </View>
          )}

          {kind === 'daily' && (
            <Text style={styles.helperText}>Done every day.</Text>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, styles.btnSecondary]}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.btn, styles.btnPrimary]}
              disabled={kind === 'weekdays' && mask === 0}
            >
              <Text style={styles.btnPrimaryText}>Save</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 18,
    paddingBottom: 32,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.divider,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  kindChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  kindChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  kindLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    fontWeight: '500',
  },
  kindLabelActive: {
    color: Colors.accentText,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  dayChip: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 40,
    borderRadius: 8,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.divider,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  dayLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '500',
  },
  dayLabelActive: {
    color: Colors.accentText,
    fontWeight: '700',
  },
  pickerWrap: {
    marginVertical: 8,
  },
  pickerLabel: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginBottom: 4,
  },
  picker: {
    color: Colors.text,
  },
  pickerItem: {
    fontSize: 18,
    color: Colors.text,
  },
  helperText: {
    color: Colors.secondaryText,
    fontSize: 13,
    marginVertical: 12,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.accent,
  },
  btnSecondary: {
    backgroundColor: Colors.inputBackground,
  },
  btnPrimaryText: {
    color: Colors.accentText,
    fontWeight: '700',
    fontSize: 15,
  },
  btnSecondaryText: {
    color: Colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
