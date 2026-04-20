// Sprint 22 — Nutrient Trend Chart
// Per-nutrient daily-total time series with RDA and UL reference lines.
// Data points are coloured by proximity to the upper limit so spikes are
// visible at a glance.

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Circle as SvgCircle,
  G,
  Line,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { storageGet, STORAGE_KEYS } from '../../utils/storage';
import {
  NUTRIENT_ACCOUNTS,
  getAccount,
  type NutrientAccount,
} from '../../constants/nutrientAccounts';
import type { TimeRange } from '../charts/types';
import {
  getDailyNutrientReport,
  type DailyNutrientReport,
} from '../../services/nutrientAggregator';
import type { UserProfile } from '../../types/profile';

const NUTRIENT_OPTIONS: NutrientAccount[] = NUTRIENT_ACCOUNTS.filter(
  (a) =>
    a.category === 'macro' ||
    a.category === 'micro_vitamin' ||
    a.category === 'micro_mineral',
);

function rangeToDays(range: TimeRange): number {
  switch (range) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '6mo': return 180;
    case '1yr': return 365;
    case 'all': return 90; // cap — all-time for nutrient data would be costly
  }
}

function dateMinusDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shortLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function pickDotColor(value: number, ul: number | null): string {
  if (ul == null || ul <= 0) return Colors.accent;
  const pct = (value / ul) * 100;
  if (pct > 100) return Colors.danger;
  if (pct >= 80) return '#F59E0B'; // amber
  return Colors.success;
}

interface NutrientTrendPoint {
  date: string;
  label: string;
  value: number;
}

export function NutrientTrendChart({
  timeRange,
}: {
  timeRange: TimeRange;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.min(screenWidth - 48, 420);
  const chartHeight = 180;

  const [selectedCode, setSelectedCode] = useState<string>('NUT-MIC-FE');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [points, setPoints] = useState<NutrientTrendPoint[]>([]);
  const [sex, setSex] = useState<'male' | 'female'>('female');
  const [loading, setLoading] = useState(true);

  const selectedAcct = useMemo(
    () => getAccount(selectedCode) ?? NUTRIENT_OPTIONS[0],
    [selectedCode],
  );

  // Pick a sensible default: iron if the user has supplement data for it,
  // otherwise protein. Runs once when the user profile loads.
  useEffect(() => {
    (async () => {
      const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
      setSex(profile?.sex === 'male' ? 'male' : 'female');
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const days = rangeToDays(timeRange);
      const today = new Date();
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        dates.push(dateMinusDays(today, i));
      }
      const reports = await Promise.all(
        dates.map((d) => getDailyNutrientReport(d, sex)),
      );
      if (cancelled) return;
      const newPoints: NutrientTrendPoint[] = reports.map(
        (r: DailyNutrientReport, i: number) => {
          const t = r.totals.find((x) => x.code === selectedCode);
          return {
            date: dates[i],
            label: shortLabel(dates[i]),
            value: t?.total ?? 0,
          };
        },
      );
      setPoints(newPoints);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCode, timeRange, sex]);

  const hasData = points.some((p) => p.value > 0);

  const rda = sex === 'male' ? selectedAcct.rda_male : selectedAcct.rda_female;
  const ul = selectedAcct.ul;

  const values = points.map((p) => p.value);
  const minVal = 0;
  const rawMax = Math.max(...values, rda ?? 0, ul ?? 0);
  const maxVal = rawMax > 0 ? rawMax * 1.1 : 1;
  const range = maxVal - minVal || 1;

  const padding = { top: 14, right: 12, bottom: 22, left: 40 };
  const chartW = chartWidth - padding.left - padding.right;
  const chartH = chartHeight - padding.top - padding.bottom;

  const toX = (i: number) =>
    padding.left + (i / Math.max(points.length - 1, 1)) * chartW;
  const toY = (v: number) =>
    padding.top + chartH - ((v - minVal) / range) * chartH;

  const linePoints = points
    .map((p, i) => `${toX(i)},${toY(p.value)}`)
    .join(' ');

  const lastValue = points[points.length - 1]?.value ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Nutrient Trend</Text>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            style={styles.picker}
            accessibilityRole="button"
            accessibilityLabel={`Select nutrient. Current: ${selectedAcct.name}`}
          >
            <Text style={styles.pickerText}>{selectedAcct.name}</Text>
            <Ionicons name="chevron-down" size={14} color={Colors.accent} />
          </TouchableOpacity>
        </View>
        <Text style={styles.latestValue}>
          {lastValue.toFixed(lastValue >= 10 ? 0 : 1)}
          {selectedAcct.unit}
        </Text>
      </View>

      {loading ? (
        <View style={{ height: chartHeight, justifyContent: 'center' }}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : !hasData ? (
        <View style={{ height: chartHeight, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.loadingText}>
            No {selectedAcct.name.toLowerCase()} data in this range.
          </Text>
        </View>
      ) : (
        <Svg width={chartWidth} height={chartHeight}>
          {/* Y-axis gridlines at 0 / mid / max */}
          {[0, 0.5, 1].map((frac, i) => {
            const v = minVal + range * frac;
            return (
              <G key={`g-${i}`}>
                <Line
                  x1={padding.left}
                  y1={toY(v)}
                  x2={chartWidth - padding.right}
                  y2={toY(v)}
                  stroke={Colors.divider}
                  strokeWidth={0.5}
                  strokeDasharray="3,4"
                />
                <SvgText
                  x={padding.left - 6}
                  y={toY(v) + 3}
                  fill={Colors.secondaryText}
                  fontSize={9}
                  textAnchor="end"
                >
                  {v >= 100 ? Math.round(v) : v.toFixed(1)}
                </SvgText>
              </G>
            );
          })}

          {/* RDA reference line */}
          {rda != null && rda > 0 && rda <= maxVal && (
            <G>
              <Line
                x1={padding.left}
                y1={toY(rda)}
                x2={chartWidth - padding.right}
                y2={toY(rda)}
                stroke={Colors.success}
                strokeWidth={1}
                strokeDasharray="5,3"
                opacity={0.8}
              />
              <SvgText
                x={chartWidth - padding.right - 2}
                y={toY(rda) - 3}
                fill={Colors.successText}
                fontSize={9}
                textAnchor="end"
              >
                RDA: {rda}{selectedAcct.unit}
              </SvgText>
            </G>
          )}

          {/* UL reference line */}
          {ul != null && ul > 0 && ul <= maxVal && (
            <G>
              <Line
                x1={padding.left}
                y1={toY(ul)}
                x2={chartWidth - padding.right}
                y2={toY(ul)}
                stroke={Colors.danger}
                strokeWidth={1}
                strokeDasharray="6,3"
                opacity={0.8}
              />
              <SvgText
                x={chartWidth - padding.right - 2}
                y={toY(ul) - 3}
                fill={Colors.dangerText}
                fontSize={9}
                textAnchor="end"
              >
                Limit: {ul}{selectedAcct.unit}
              </SvgText>
            </G>
          )}

          {/* Series line */}
          <Polyline
            points={linePoints}
            fill="none"
            stroke={Colors.accent}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Per-point coloured dots */}
          {points.map((p, i) => (
            <SvgCircle
              key={`dot-${i}`}
              cx={toX(i)}
              cy={toY(p.value)}
              r={points.length > 30 ? 1.5 : 3}
              fill={pickDotColor(p.value, ul)}
            />
          ))}

          {/* X-axis labels (first / mid / last) */}
          {points.length > 0 && (
            <>
              <SvgText
                x={toX(0)}
                y={chartHeight - 4}
                fill={Colors.secondaryText}
                fontSize={9}
                textAnchor="start"
              >
                {points[0].label}
              </SvgText>
              {points.length > 2 && (
                <SvgText
                  x={toX(Math.floor(points.length / 2))}
                  y={chartHeight - 4}
                  fill={Colors.secondaryText}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {points[Math.floor(points.length / 2)].label}
                </SvgText>
              )}
              <SvgText
                x={toX(points.length - 1)}
                y={chartHeight - 4}
                fill={Colors.secondaryText}
                fontSize={9}
                textAnchor="end"
              >
                {points[points.length - 1].label}
              </SvgText>
            </>
          )}
        </Svg>
      )}

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Nutrient</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {NUTRIENT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.code}
                  onPress={() => {
                    setSelectedCode(opt.code);
                    setPickerOpen(false);
                  }}
                  style={[
                    styles.modalRow,
                    opt.code === selectedCode && styles.modalRowActive,
                  ]}
                >
                  <Text style={styles.modalRowText}>{opt.name}</Text>
                  {opt.code === selectedCode && (
                    <Ionicons name="checkmark" size={16} color={Colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
    marginTop: 4,
  },
  pickerText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '600',
  },
  latestValue: {
    color: Colors.accentText,
    fontSize: 16,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  loadingText: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.elevated,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalRowActive: {
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
  },
  modalRowText: {
    color: Colors.text,
    fontSize: 14,
  },
});
