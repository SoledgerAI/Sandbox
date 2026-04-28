// S36: Strength Coverage chart — horizontal bars per body region
// showing 4-week rolling average sessions/week against a configurable
// target. Plain Views (no SVG dependency) since the bars are linear
// and we're rendering 13 of them.

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import {
  getRegionWeeklyAverages,
  getStrengthTargetPerWeek,
  type RegionWeekly,
} from '../../services/strengthService';
import { ALL_BODY_REGIONS, type BodyRegion } from '../../config/exerciseCatalog';

const REGION_LABEL: Record<BodyRegion, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps',
  triceps: 'Triceps', quads: 'Quads', hamstrings: 'Hamstrings',
  glutes: 'Glutes', calves: 'Calves', core: 'Core', forearms: 'Forearms',
  traps: 'Traps', full_body: 'Full Body',
};

const BRAND_GOLD = '#D4A843';

export function StrengthCoverageChart() {
  const [averages, setAverages] = useState<RegionWeekly[]>([]);
  const [target, setTarget] = useState<number>(2);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await getStrengthTargetPerWeek();
      const a = await getRegionWeeklyAverages(new Date(), 4);
      setTarget(t);
      setAverages(a);
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return null;

  // Scale bars to the largest of (max average, target * 1.25) so the target
  // line sits at a stable, readable position even when the user is well below.
  const maxValue = Math.max(target * 1.25, ...averages.map((a) => a.sessions_per_week_avg));
  const safeMax = maxValue > 0 ? maxValue : 1;
  const targetPct = (target / safeMax) * 100;

  // Sort: regions with the most coverage first; that puts bars under
  // target near the bottom where the user looks for action items.
  const ordered = ALL_BODY_REGIONS.map((region) => {
    const found = averages.find((a) => a.region === region);
    return found ?? { region, sessions_per_week_avg: 0, weeks_sampled: 4 };
  }).sort((a, b) => b.sessions_per_week_avg - a.sessions_per_week_avg);

  return (
    <View style={styles.container} testID="strength-coverage-chart">
      <View style={styles.bars}>
        {/* Target reference line — a vertical hairline behind the bars */}
        <View style={[styles.targetLine, { left: `${targetPct}%` }]} />
        {ordered.map((row) => {
          const widthPct = (row.sessions_per_week_avg / safeMax) * 100;
          const meets = row.sessions_per_week_avg >= target;
          return (
            <View key={row.region} style={styles.row}>
              <Text style={styles.label}>{REGION_LABEL[row.region]}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${widthPct}%` },
                    meets ? styles.fillMeets : styles.fillBelow,
                  ]}
                  testID={`coverage-bar-${row.region}`}
                />
              </View>
              <Text style={[styles.value, meets ? styles.valueMeets : styles.valueBelow]}>
                {row.sessions_per_week_avg.toFixed(1)}/wk
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.caption}>
        4-week rolling avg · target {target}/wk
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  bars: {
    position: 'relative',
  },
  targetLine: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 1,
    marginLeft: 90,
    backgroundColor: Colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    color: Colors.text,
    fontSize: 12,
    width: 86,
  },
  track: {
    flex: 1,
    height: 14,
    backgroundColor: Colors.inputBackground,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 6,
  },
  fill: {
    height: '100%',
  },
  fillMeets: {
    backgroundColor: BRAND_GOLD,
  },
  fillBelow: {
    backgroundColor: Colors.divider,
  },
  value: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    width: 50,
    textAlign: 'right',
  },
  valueMeets: {
    color: BRAND_GOLD,
    fontWeight: '600',
  },
  valueBelow: {
    color: Colors.secondaryText,
  },
  caption: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
});
