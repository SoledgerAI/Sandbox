// S36: Body-region tree picker — extracted for testability and to keep
// StrengthLogger.tsx focused on entry composition. Pure presentational
// component; all state is owned by the parent (election persists via
// onToggleElection, equipment filter via the equipment prop).

import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  EXERCISE_CATALOG,
  filterByEquipment,
  type BodyRegion,
  type Equipment,
  type Exercise,
} from '../../config/exerciseCatalog';

type RegionGroup = 'arms' | 'legs';
type Node =
  | { kind: 'top' }
  | { kind: 'group'; group: RegionGroup }
  | { kind: 'region'; region: BodyRegion; expanded: boolean };

const TOP_REGIONS: Array<
  | { kind: 'leaf'; region: BodyRegion; label: string }
  | { kind: 'group'; group: RegionGroup; label: string }
> = [
  { kind: 'leaf',  region: 'chest',     label: 'Chest' },
  { kind: 'leaf',  region: 'back',      label: 'Back' },
  { kind: 'leaf',  region: 'shoulders', label: 'Shoulders' },
  { kind: 'group', group: 'arms',       label: 'Arms' },
  { kind: 'group', group: 'legs',       label: 'Legs' },
  { kind: 'leaf',  region: 'core',      label: 'Core' },
  { kind: 'leaf',  region: 'full_body', label: 'Full Body' },
];

const ARMS_LEAVES: BodyRegion[] = ['biceps', 'triceps', 'forearms'];
const LEGS_LEAVES: BodyRegion[] = ['quads', 'hamstrings', 'glutes', 'calves'];

const REGION_LABEL: Record<BodyRegion, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', core: 'Core', forearms: 'Forearms',
  traps: 'Traps', full_body: 'Full Body',
};

/** Shoulders region surfaces traps inline per spec. */
function exercisesForLeaf(region: BodyRegion): Exercise[] {
  if (region === 'shoulders') {
    return EXERCISE_CATALOG.filter((e) => e.primary === 'shoulders' || e.primary === 'traps');
  }
  return EXERCISE_CATALOG.filter((e) => e.primary === region);
}

interface LastSessionExercise {
  name: string;
  exercise_id?: string;
}

export interface ExercisePickerTreeProps {
  equipment: Equipment[];
  electedExercises: string[];
  usageCounts: Record<string, number>;
  lastSessionExercises?: LastSessionExercise[];
  onSelect: (name: string, exerciseId: string | null) => void;
  onToggleElection: (exerciseId: string) => void;
  onClose: () => void;
}

export function ExercisePickerTree({
  equipment,
  electedExercises,
  usageCounts,
  lastSessionExercises,
  onSelect,
  onToggleElection,
  onClose,
}: ExercisePickerTreeProps) {
  const [node, setNode] = useState<Node>({ kind: 'top' });

  const sortRegionExercises = (list: Exercise[]): Exercise[] => {
    const electedSet = new Set(electedExercises);
    return list.slice().sort((a, b) => {
      const ae = electedSet.has(a.id) ? 1 : 0;
      const be = electedSet.has(b.id) ? 1 : 0;
      if (ae !== be) return be - ae;
      const au = usageCounts[a.id] ?? 0;
      const bu = usageCounts[b.id] ?? 0;
      if (au !== bu) return bu - au;
      return a.default_order - b.default_order;
    });
  };

  if (node.kind === 'region') {
    const all = exercisesForLeaf(node.region);
    const filtered = filterByEquipment(all, equipment);
    const visible = node.expanded ? all : filtered;
    const sorted = sortRegionExercises(visible);
    const hiddenCount = all.length - filtered.length;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setNode({ kind: 'top' })} testID="picker-back">
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{REGION_LABEL[node.region]}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {sorted.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No exercises match your equipment yet. Add equipment in Settings or expand below.
            </Text>
          </View>
        ) : (
          sorted.map((ex) => {
            const elected = electedExercises.includes(ex.id);
            const used = (usageCounts[ex.id] ?? 0) > 0;
            return (
              <View key={ex.id} style={styles.exerciseRow}>
                <TouchableOpacity
                  onPress={() => onToggleElection(ex.id)}
                  onLongPress={() => onToggleElection(ex.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  testID={`elect-${ex.id}`}
                >
                  <Ionicons
                    name={elected ? 'star' : 'star-outline'}
                    size={20}
                    color={elected ? Colors.accent : Colors.secondaryText}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.exerciseRowBody}
                  activeOpacity={0.7}
                  onPress={() => onSelect(ex.name, ex.id)}
                  onLongPress={() => onToggleElection(ex.id)}
                  testID={`select-${ex.id}`}
                >
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  {used && (
                    <Text style={styles.exerciseUsageBadge} testID={`usage-${ex.id}`}>
                      ×{usageCounts[ex.id]}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
        {hiddenCount > 0 && (
          <TouchableOpacity
            style={styles.expandAllBtn}
            onPress={() => setNode({ kind: 'region', region: node.region, expanded: !node.expanded })}
            activeOpacity={0.7}
            testID="expand-all-btn"
          >
            <Ionicons
              name={node.expanded ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={Colors.accent}
            />
            <Text style={styles.expandAllText}>
              {node.expanded
                ? `Hide ${hiddenCount} unowned-equipment exercise${hiddenCount === 1 ? '' : 's'}`
                : `Show all ${all.length} exercises in ${REGION_LABEL[node.region]}`}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  if (node.kind === 'group') {
    const leaves = node.group === 'arms' ? ARMS_LEAVES : LEGS_LEAVES;
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pickerHeader}>
          <TouchableOpacity onPress={() => setNode({ kind: 'top' })} testID="picker-back">
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.pickerTitle}>{node.group === 'arms' ? 'Arms' : 'Legs'}</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
        {leaves.map((region) => (
          <TouchableOpacity
            key={region}
            style={styles.regionChip}
            activeOpacity={0.7}
            onPress={() => setNode({ kind: 'region', region, expanded: false })}
            testID={`region-chip-${region}`}
          >
            <Ionicons name="barbell-outline" size={18} color={Colors.accent} />
            <Text style={styles.regionChipLabel}>{REGION_LABEL[region]}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Select Exercise</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {(lastSessionExercises?.length ?? 0) > 0 && (
        <>
          <Text style={styles.sectionLabel}>From Last Session</Text>
          {lastSessionExercises!.map((entry) => (
            <TouchableOpacity
              key={`last_${entry.name}`}
              style={styles.exerciseRow}
              onPress={() => onSelect(entry.name, entry.exercise_id ?? null)}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color={Colors.accent} />
              <Text style={styles.exerciseName}>{entry.name}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
            </TouchableOpacity>
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>Body Region</Text>
      {TOP_REGIONS.map((entry) => {
        if (entry.kind === 'leaf') {
          return (
            <TouchableOpacity
              key={`leaf_${entry.region}`}
              style={styles.regionChip}
              activeOpacity={0.7}
              onPress={() => setNode({ kind: 'region', region: entry.region, expanded: false })}
              testID={`region-chip-${entry.region}`}
            >
              <Ionicons name="barbell-outline" size={18} color={Colors.accent} />
              <Text style={styles.regionChipLabel}>{entry.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.secondaryText} />
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={`group_${entry.group}`}
            style={styles.regionChip}
            activeOpacity={0.7}
            onPress={() => setNode({ kind: 'group', group: entry.group })}
            testID={`region-group-${entry.group}`}
          >
            <Ionicons name="barbell-outline" size={18} color={Colors.accent} />
            <Text style={styles.regionChipLabel}>{entry.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  pickerTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  exerciseName: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseRowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseUsageBadge: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  regionChipLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  expandAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  expandAllText: {
    color: Colors.accentText,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyStateText: {
    color: Colors.secondaryText,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
