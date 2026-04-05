// Rolling consistency display with 28-day dot grid
// Replaces consecutive streak model — "X of 28 days (Y%)" never shows zero-streak shame

import { StyleSheet, View, Text } from 'react-native';
import { Colors } from '../../constants/colors';
import { DashboardCard } from './DashboardCard';
import { consistencyPct } from '../../utils/consistency';
import type { StreakData } from '../../types/profile';

const WINDOW_DAYS = 28;
const GRID_COLS = 7;
const GRID_ROWS = 4;
const DOT_SIZE = 10;
const DOT_GAP = 6;

interface StreakCounterProps {
  streak: StreakData;
}

function buildDotGrid(streak: StreakData): Array<'filled' | 'empty' | 'today' | 'today_filled'> {
  const today = new Date();
  const todayStr = formatDate(today);
  const loggedSet = new Set(streak.logged_dates_28d);
  const dots: Array<'filled' | 'empty' | 'today' | 'today_filled'> = [];

  // 28 dots: index 0 = 27 days ago (oldest), index 27 = today
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const isToday = dateStr === todayStr;
    const isLogged = loggedSet.has(dateStr);

    if (isToday) {
      dots.push(isLogged ? 'today_filled' : 'today');
    } else {
      dots.push(isLogged ? 'filled' : 'empty');
    }
  }

  return dots;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function StreakCounter({ streak }: StreakCounterProps) {
  const daysLogged = streak.logged_dates_28d.length;
  const pct = consistencyPct(streak);
  const dots = buildDotGrid(streak);

  return (
    <DashboardCard>
      <View style={styles.container}>
        {/* Left: consistency text */}
        <View style={styles.textSection}>
          <Text style={styles.primaryNumber}>
            {daysLogged}
            <Text style={styles.primaryOf}> of {WINDOW_DAYS} days</Text>
          </Text>
          <Text style={styles.primaryPct}>{pct}%</Text>
          <Text style={styles.secondaryLabel}>
            Current run: {streak.current_streak} day{streak.current_streak !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Right: 4x7 dot grid */}
        <View style={styles.gridSection}>
          {Array.from({ length: GRID_ROWS }).map((_, row) => (
            <View key={row} style={styles.gridRow}>
              {Array.from({ length: GRID_COLS }).map((_, col) => {
                const idx = row * GRID_COLS + col;
                const state = dots[idx];
                return (
                  <View
                    key={col}
                    style={[
                      styles.dot,
                      state === 'filled' && styles.dotFilled,
                      state === 'empty' && styles.dotEmpty,
                      state === 'today' && styles.dotToday,
                      state === 'today_filled' && styles.dotTodayFilled,
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textSection: {
    flex: 1,
    marginRight: 16,
  },
  primaryNumber: {
    color: Colors.accentText,
    fontSize: 24,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  primaryOf: {
    color: Colors.secondaryText,
    fontSize: 14,
    fontWeight: '400',
  },
  primaryPct: {
    color: Colors.accentText,
    fontSize: 32,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
    marginTop: 2,
  },
  secondaryLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    marginTop: 6,
  },
  gridSection: {
    alignItems: 'flex-end',
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: DOT_GAP,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginHorizontal: DOT_GAP / 2,
  },
  dotFilled: {
    backgroundColor: Colors.accent,
  },
  dotEmpty: {
    backgroundColor: Colors.divider,
  },
  dotToday: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  dotTodayFilled: {
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.accentText,
  },
});
