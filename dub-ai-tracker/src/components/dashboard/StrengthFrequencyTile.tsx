// S36: Optional dashboard tile showing this ISO week's region session
// counts vs target. Off by default; user opts in via Customize Tiles.
// Displays only the regions the user has trained at least once OR
// regions whose target is unmet — not the full 13-region grid.

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { storageGet, STORAGE_KEYS, storageSubscribe } from '../../utils/storage';
import {
  isoWeekKey,
  getRegionSessions,
  getStrengthTargetPerWeek,
} from '../../services/strengthService';
import { ALL_BODY_REGIONS, type BodyRegion } from '../../config/exerciseCatalog';

const REGION_LABEL: Record<BodyRegion, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', core: 'Core', forearms: 'Forearms',
  traps: 'Traps', full_body: 'Full Body',
};

interface RegionRow {
  region: BodyRegion;
  count: number;
  target: number;
}

export function StrengthFrequencyTile() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [rows, setRows] = useState<RegionRow[]>([]);
  const [target, setTarget] = useState<number>(2);

  async function load() {
    const flag = await storageGet<boolean>(STORAGE_KEYS.STRENGTH_TILE_ENABLED);
    setEnabled(flag === true);
    if (flag !== true) return;
    const t = await getStrengthTargetPerWeek();
    setTarget(t);
    const week = isoWeekKey(new Date());
    const all: RegionRow[] = [];
    for (const region of ALL_BODY_REGIONS) {
      const c = await getRegionSessions(week, region);
      all.push({ region, count: c, target: t });
    }
    // Show regions that were trained OR have an unmet target if any
    // training has happened this week. If nothing trained yet, show top 3.
    const trained = all.filter((r) => r.count > 0);
    const display = trained.length > 0 ? trained : all.slice(0, 3);
    setRows(display);
  }

  useEffect(() => {
    load();
    const unsub = storageSubscribe(
      STORAGE_KEYS.STRENGTH_REGION_SESSIONS_PREFIX,
      () => { load(); },
      { prefix: true },
    );
    const unsubFlag = storageSubscribe(
      STORAGE_KEYS.STRENGTH_TILE_ENABLED,
      () => { load(); },
    );
    return () => { unsub(); unsubFlag(); };
  }, []);

  if (!enabled) return null;

  return (
    <Pressable
      style={styles.container}
      onPress={() => router.push('/log/strength' as never)}
      accessibilityRole="button"
      accessibilityLabel="Strength frequency this week"
      testID="strength-frequency-tile"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Strength This Week</Text>
        <Text style={styles.target}>target {target}/wk</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No sessions yet this week</Text>
      ) : (
        <View style={styles.grid}>
          {rows.map((r) => {
            const meets = r.count >= r.target;
            return (
              <View key={r.region} style={styles.cell}>
                <Text style={[styles.cellLabel, meets && styles.cellLabelMet]} numberOfLines={1}>
                  {REGION_LABEL[r.region]}
                </Text>
                <Text style={[styles.cellValue, meets && styles.cellValueMet]}>
                  {r.count}/{r.target}
                  {meets ? ' ✓' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  target: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  empty: {
    color: Colors.secondaryText,
    fontSize: 13,
    paddingVertical: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cell: {
    flexBasis: '31%',
    flexGrow: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: Colors.inputBackground,
    borderRadius: 8,
  },
  cellLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
  },
  cellLabelMet: {
    color: Colors.text,
  },
  cellValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  cellValueMet: {
    color: '#D4A843',
  },
});
