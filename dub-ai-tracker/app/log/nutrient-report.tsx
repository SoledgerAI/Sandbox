// Sprint 22 — Nutrient P&L ("Daily Nutrient Report")
// The Bloomberg terminal view: per-nutrient totals vs RDA / UL for a
// specific day, or 7-day averages with trend-direction arrows.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '../../src/components/common/ScreenWrapper';
import { Colors } from '../../src/constants/colors';
import { Spacing } from '../../src/constants/spacing';
import { FontSize, FontWeight } from '../../src/constants/typography';
import { LoadingIndicator } from '../../src/components/common/LoadingIndicator';
import { storageGet, STORAGE_KEYS } from '../../src/utils/storage';
import { todayDateString } from '../../src/utils/dayBoundary';
import type { UserProfile } from '../../src/types/profile';
import { getAccount } from '../../src/constants/nutrientAccounts';
import {
  getDailyNutrientReport,
  type DailyNutrientReport,
  type NutrientAlert,
  type NutrientDailyTotal,
} from '../../src/services/nutrientAggregator';
import {
  buildNutrientAverages,
  classifyTrendSemantic,
  countRdaMet,
  type NutrientAverageRow,
} from '../../src/services/nutrientAverage';

const FAT_SOLUBLE = new Set<string>([
  'NUT-MIC-VA',
  'NUT-MIC-VD',
  'NUT-MIC-VE',
  'NUT-MIC-VK',
]);

type Sex = 'male' | 'female';

function shiftDate(dateStr: string, offset: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function displayDate(dateStr: string): string {
  const today = todayDateString();
  if (dateStr === today) return 'Today';
  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function resolveSex(p: Partial<UserProfile> | null): Sex {
  return p?.sex === 'male' ? 'male' : 'female';
}

interface SectionGroup {
  key: string;
  title: string;
  codes: string[];
}

// Compute which codes should appear in each section based on the nutrients
// that actually have non-zero totals in the current view.
function groupCodes(codes: string[]): SectionGroup[] {
  const macros: string[] = [];
  const fatSol: string[] = [];
  const waterSol: string[] = [];
  const minerals: string[] = [];
  for (const code of codes) {
    const acct = getAccount(code);
    if (!acct) continue;
    if (acct.category === 'macro') macros.push(code);
    else if (acct.category === 'micro_vitamin') {
      if (FAT_SOLUBLE.has(code)) fatSol.push(code);
      else waterSol.push(code);
    } else if (acct.category === 'micro_mineral') minerals.push(code);
  }
  const sort = (a: string, b: string) =>
    (getAccount(a)?.display_order ?? 999) -
    (getAccount(b)?.display_order ?? 999);
  macros.sort(sort);
  fatSol.sort(sort);
  waterSol.sort(sort);
  minerals.sort(sort);
  const out: SectionGroup[] = [];
  if (macros.length) out.push({ key: 'macros', title: 'Macronutrients', codes: macros });
  if (fatSol.length) out.push({ key: 'vit-fat', title: 'Vitamins · Fat-soluble', codes: fatSol });
  if (waterSol.length) out.push({ key: 'vit-water', title: 'Vitamins · Water-soluble', codes: waterSol });
  if (minerals.length) out.push({ key: 'minerals', title: 'Minerals', codes: minerals });
  return out;
}

// Progress bar fill colour for a single-day row.
// Palette order (priority): red (over UL) → amber (deficient) → green
// (50–150% RDA) → accent gold (no RDA).
export function pickBarColor(
  row: { pct_rda: number | null; pct_ul: number | null; rda: number | null },
): string {
  if (row.pct_ul != null && row.pct_ul > 100) return Colors.danger;
  if (row.rda != null) {
    const p = row.pct_rda ?? 0;
    if (p < 50) return Colors.warning;        // deficient
    if (p >= 50 && p <= 150) return Colors.success;
    return Colors.accent;                     // over 150% but no UL breach
  }
  return Colors.accent;                       // no RDA → neutral gold
}

function formatAmount(n: number): string {
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

function sendCoachPrompt(nutrientName: string) {
  router.push({
    pathname: '/(tabs)/coach',
    params: { prompt: `@pharmacist tell me about my ${nutrientName.toLowerCase()} intake` },
  });
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function NutrientReportScreen() {
  const { date: paramDate } = useLocalSearchParams<{ date?: string }>();

  const [selectedDate, setSelectedDate] = useState<string>(
    paramDate ?? todayDateString(),
  );
  const [showAverage, setShowAverage] = useState(false);
  const [sex, setSex] = useState<Sex>('female');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DailyNutrientReport | null>(null);
  const [currentWindow, setCurrentWindow] = useState<DailyNutrientReport[]>([]);
  const [priorWindow, setPriorWindow] = useState<DailyNutrientReport[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isToday = selectedDate === todayDateString();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE);
      const resolvedSex = resolveSex(profile);
      setSex(resolvedSex);

      if (showAverage) {
        // Fetch 14 days ending at selectedDate (7 current + 7 prior).
        const dates: string[] = [];
        for (let i = 13; i >= 0; i--) dates.push(shiftDate(selectedDate, -i));
        const reports = await Promise.all(
          dates.map((d) => getDailyNutrientReport(d, resolvedSex)),
        );
        setPriorWindow(reports.slice(0, 7));
        setCurrentWindow(reports.slice(7));
        setReport(reports[reports.length - 1]);
      } else {
        const r = await getDailyNutrientReport(selectedDate, resolvedSex);
        setReport(r);
        setCurrentWindow([]);
        setPriorWindow([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showAverage]);

  useEffect(() => {
    load();
  }, [load]);

  const goBack = useCallback(() => setSelectedDate((d) => shiftDate(d, -1)), []);
  const goForward = useCallback(
    () =>
      setSelectedDate((d) => {
        const next = shiftDate(d, 1);
        return next > todayDateString() ? d : next;
      }),
    [],
  );
  const goToday = useCallback(() => setSelectedDate(todayDateString()), []);

  // ---- Build rows for the current view -----------------------------------

  const averageRows = useMemo<NutrientAverageRow[]>(() => {
    if (!showAverage) return [];
    return buildNutrientAverages(currentWindow, sex, priorWindow).filter(
      (r) => r.avg_total > 0 || r.prev_avg > 0,
    );
  }, [showAverage, currentWindow, priorWindow, sex]);

  const activeCodes = useMemo(() => {
    if (showAverage) return averageRows.map((r) => r.code);
    return (report?.totals ?? []).map((t) => t.code);
  }, [showAverage, averageRows, report]);

  const sections = useMemo(() => groupCodes(activeCodes), [activeCodes]);

  const totalsByCode = useMemo(() => {
    const map = new Map<string, NutrientDailyTotal>();
    for (const t of report?.totals ?? []) map.set(t.code, t);
    return map;
  }, [report]);

  const averagesByCode = useMemo(() => {
    const map = new Map<string, NutrientAverageRow>();
    for (const r of averageRows) map.set(r.code, r);
    return map;
  }, [averageRows]);

  const alertsByCode = useMemo(() => {
    const map = new Map<string, NutrientAlert>();
    for (const a of report?.alerts ?? []) map.set(a.code, a);
    return map;
  }, [report]);

  const rdaStat = useMemo(() => countRdaMet(report?.totals ?? []), [report]);

  const toggleExpanded = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // ---- Render helpers ----------------------------------------------------

  const isEmpty =
    !loading &&
    !showAverage &&
    (report == null || report.totals.length === 0);

  const isAverageEmpty =
    !loading && showAverage && averageRows.length === 0;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={Colors.accent} />
          </TouchableOpacity>
          <Text style={styles.title}>Daily Nutrient Report</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Date + toggle row */}
        <View style={styles.dateSelector}>
          <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.dateArrow}>
            <Ionicons name="chevron-back" size={22} color={Colors.accentText} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={styles.dateLabelWrap}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={Colors.accent}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.dateLabel}>{displayDate(selectedDate)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goForward}
            hitSlop={12}
            style={[styles.dateArrow, isToday && { opacity: 0.3 }]}
            disabled={isToday}
          >
            <Ionicons name="chevron-forward" size={22} color={Colors.accentText} />
          </TouchableOpacity>
        </View>

        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setShowAverage((v) => !v)}
            style={[styles.toggleBtn, showAverage && styles.toggleBtnActive]}
            accessibilityRole="switch"
            accessibilityState={{ checked: showAverage }}
            accessibilityLabel="Toggle 7-day average"
          >
            <Ionicons
              name={showAverage ? 'stats-chart' : 'today-outline'}
              size={14}
              color={showAverage ? Colors.primaryBackground : Colors.accentText}
            />
            <Text
              style={[
                styles.toggleText,
                showAverage && styles.toggleTextActive,
              ]}
            >
              {showAverage ? '7-Day Average' : 'Single Day'}
            </Text>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <LoadingIndicator size="small" />
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          testID="nutrient-report-scroll"
        >
          {/* Summary cards */}
          {!loading && !showAverage && report && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.summaryRow}
            >
              <SummaryCard label="Entries" value={String(report.entries_count)} />
              <SummaryCard
                label="Alerts"
                value={String(report.alerts.length)}
                tint={report.alerts.length > 0 ? Colors.dangerText : undefined}
              />
              <SummaryCard
                label="RDA Met"
                value={`${rdaStat.met}/${rdaStat.tracked}`}
              />
            </ScrollView>
          )}

          {/* Alerts section (single-day only) */}
          {!loading && !showAverage && report && report.alerts.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeader}>Alerts</Text>
              {report.alerts.map((alert) => (
                <AlertCard key={alert.code} alert={alert} />
              ))}
            </View>
          )}

          {/* Empty state */}
          {isEmpty && (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="nutrition-outline"
                size={40}
                color={Colors.secondaryText}
              />
              <Text style={styles.emptyText}>
                No entries logged today. Start logging food and supplements to
                see your nutrient breakdown.
              </Text>
            </View>
          )}

          {isAverageEmpty && (
            <View style={styles.emptyWrap}>
              <Ionicons
                name="calendar-outline"
                size={40}
                color={Colors.secondaryText}
              />
              <Text style={styles.emptyText}>
                Not enough logged data in the last 7 days to show an average.
              </Text>
            </View>
          )}

          {/* Nutrient sections */}
          {!loading &&
            sections.map((section) => (
              <View key={section.key} style={styles.sectionBlock}>
                <Text style={styles.sectionHeader}>{section.title}</Text>
                {section.codes.map((code) => {
                  if (showAverage) {
                    const row = averagesByCode.get(code);
                    if (!row) return null;
                    return (
                      <AverageRow
                        key={code}
                        row={row}
                        expanded={expanded.has(code)}
                        onToggle={() => toggleExpanded(code)}
                      />
                    );
                  }
                  const t = totalsByCode.get(code);
                  if (!t) return null;
                  const alert = alertsByCode.get(code);
                  return (
                    <DailyRow
                      key={code}
                      total={t}
                      alert={alert}
                      expanded={expanded.has(code)}
                      onToggle={() => toggleExpanded(code)}
                    />
                  );
                })}
              </View>
            ))}
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function AlertCard({ alert }: { alert: NutrientAlert }) {
  const acct = getAccount(alert.code);
  const pctOfLimit = Math.round((alert.total / alert.limit) * 100);
  const borderColor = alert.severity === 'critical' ? Colors.danger : '#F59E0B';
  const statusLabel =
    alert.severity === 'critical' ? 'EXCEEDS UPPER LIMIT' : 'APPROACHING LIMIT';
  return (
    <View style={[styles.alertCard, { borderLeftColor: borderColor }]}>
      <Text style={styles.alertTitle}>
        <Ionicons name="warning-outline" size={14} color={borderColor} />
        {'  '}
        {alert.name} — {formatAmount(alert.total)}
        {alert.unit} / {formatAmount(alert.limit)}
        {alert.unit} UL ({pctOfLimit}%)
      </Text>
      <Text style={[styles.alertStatus, { color: borderColor }]}>
        {statusLabel}
      </Text>
      {alert.sources.length > 0 && (
        <View style={styles.alertSources}>
          <Text style={styles.alertSourcesLabel}>Sources:</Text>
          {alert.sources.slice(0, 5).map((s) => (
            <View key={`${s.type}-${s.name}`} style={styles.alertSourceRow}>
              <Text style={styles.alertSourceName} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.alertSourceAmt}>
                {formatAmount(s.amount)}
                {alert.unit} ({s.type === 'supplement' ? 'supp' : 'food'})
              </Text>
            </View>
          ))}
        </View>
      )}
      {acct?.clinical_risk && (
        <Text style={styles.alertRisk}>Risk: {acct.clinical_risk}</Text>
      )}
    </View>
  );
}

function DailyRow({
  total,
  alert,
  expanded,
  onToggle,
}: {
  total: NutrientDailyTotal;
  alert: NutrientAlert | undefined;
  expanded: boolean;
  onToggle: () => void;
}) {
  const acct = getAccount(total.code);
  const barColor = pickBarColor(total);
  const pct =
    total.pct_ul != null
      ? total.pct_ul
      : total.pct_rda != null
        ? total.pct_rda
        : null;
  const fillPct = pct != null ? Math.min(100, Math.max(0, pct)) : 60;

  const target = total.ul ?? total.rda;
  const targetLabel = total.ul != null ? 'UL' : total.rda != null ? 'RDA' : '';

  return (
    <Pressable
      onPress={onToggle}
      style={styles.nutrientRow}
      accessibilityRole="button"
      accessibilityLabel={`${total.name} ${total.total}${total.unit}${target != null ? ` of ${target}${total.unit} ${targetLabel}` : ''}, tap for details`}
    >
      <View style={styles.nutrientHeader}>
        <Text style={styles.nutrientName}>{total.name}</Text>
        <Text style={styles.nutrientValue}>
          {formatAmount(total.total)}{total.unit}
          {target != null ? (
            <Text style={styles.nutrientTarget}>
              {' '}/ {formatAmount(target)}{total.unit} {targetLabel}
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${fillPct}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={styles.nutrientFooter}>
        <Text style={styles.nutrientPct}>
          {pct != null ? `${pct}%` : 'tracked'}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.secondaryText}
        />
      </View>

      {expanded && (
        <View style={styles.expandWrap}>
          <View style={styles.expandBreakdown}>
            <Text style={styles.expandLine}>
              From food: {formatAmount(total.food_sourced)}{total.unit}
            </Text>
            <Text style={styles.expandLine}>
              From supplements: {formatAmount(total.supplement_sourced)}
              {total.unit}
            </Text>
          </View>
          {alert && alert.sources.length > 0 && (
            <View style={styles.expandBreakdown}>
              <Text style={styles.expandLabel}>Top sources</Text>
              {alert.sources.slice(0, 3).map((s) => (
                <Text key={`${s.type}-${s.name}`} style={styles.expandLine}>
                  {'\u2022'} {s.name} — {formatAmount(s.amount)}{total.unit} (
                  {s.type === 'supplement' ? 'supp' : 'food'})
                </Text>
              ))}
            </View>
          )}
          {acct?.clinical_risk && (
            <Text style={styles.expandRisk}>{acct.clinical_risk}</Text>
          )}
          <TouchableOpacity
            onPress={() => sendCoachPrompt(total.name)}
            style={styles.askCoachBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Ask Coach about ${total.name}`}
          >
            <Ionicons name="chatbubbles-outline" size={14} color={Colors.accent} />
            <Text style={styles.askCoachText}>Ask Coach</Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

function AverageRow({
  row,
  expanded,
  onToggle,
}: {
  row: NutrientAverageRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const acct = getAccount(row.code);
  const target = row.ul ?? row.rda;
  const targetLabel = row.ul != null ? 'UL' : row.rda != null ? 'RDA' : '';
  const pct = row.pct_ul != null ? row.pct_ul : row.pct_rda ?? null;

  const semantic = classifyTrendSemantic(row);
  const trendColor =
    row.trend_direction === 'stable'
      ? Colors.secondaryText
      : semantic === 'good'
        ? Colors.successText
        : semantic === 'bad'
          ? Colors.dangerText
          : Colors.accentText;
  const arrow =
    row.trend_direction === 'up'
      ? '\u2191'
      : row.trend_direction === 'down'
        ? '\u2193'
        : '\u2192';

  return (
    <Pressable onPress={onToggle} style={styles.nutrientRow}>
      <View style={styles.nutrientHeader}>
        <Text style={styles.nutrientName}>{row.name}</Text>
        <Text style={styles.nutrientValue}>
          Avg: {formatAmount(row.avg_total)}{row.unit}
          {target != null ? (
            <Text style={styles.nutrientTarget}>
              {' '}/ {formatAmount(target)}{row.unit} {targetLabel}
            </Text>
          ) : null}
        </Text>
      </View>
      <View style={styles.avgTrendRow}>
        <Text style={styles.nutrientPct}>
          {pct != null ? `${pct}%` : 'tracked'}
        </Text>
        <Text style={[styles.trendText, { color: trendColor }]}>
          Trend: {arrow}
          {row.trend_direction !== 'stable' ? ` ${row.trend_pct}%` : ' stable'}
        </Text>
      </View>
      {expanded && (
        <View style={styles.expandWrap}>
          <Text style={styles.expandLine}>
            7-day avg from food: {formatAmount(row.avg_food)}{row.unit}
          </Text>
          <Text style={styles.expandLine}>
            7-day avg from supplements: {formatAmount(row.avg_supp)}{row.unit}
          </Text>
          <Text style={styles.expandLine}>
            Previous 7-day avg: {formatAmount(row.prev_avg)}{row.unit}
          </Text>
          {acct?.clinical_risk && (
            <Text style={styles.expandRisk}>{acct.clinical_risk}</Text>
          )}
          <TouchableOpacity
            onPress={() => sendCoachPrompt(row.name)}
            style={styles.askCoachBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={14} color={Colors.accent} />
            <Text style={styles.askCoachText}>Ask Coach</Text>
          </TouchableOpacity>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    flex: 1,
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: 10,
  },
  dateArrow: {
    padding: 6,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  toggleRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  toggleBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  toggleText: {
    color: Colors.accentText,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: Colors.primaryBackground,
  },
  loadingWrap: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  summaryRow: {
    gap: 10,
    paddingVertical: 8,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: Colors.secondaryText,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionBlock: {
    marginTop: 18,
    marginBottom: 4,
  },
  sectionHeader: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  alertCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  alertTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  alertStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  alertSources: {
    marginTop: 10,
  },
  alertSourcesLabel: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertSourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  alertSourceName: {
    flex: 1,
    color: Colors.text,
    fontSize: 12,
  },
  alertSourceAmt: {
    color: Colors.accentText,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  alertRisk: {
    color: Colors.dangerText,
    fontSize: 12,
    marginTop: 10,
    lineHeight: 16,
  },
  nutrientRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  nutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  nutrientName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  nutrientValue: {
    color: Colors.text,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  nutrientTarget: {
    color: Colors.secondaryText,
    fontSize: 12,
    fontWeight: '400',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  nutrientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  nutrientPct: {
    color: Colors.secondaryText,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  avgTrendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expandWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
    gap: 4,
  },
  expandBreakdown: {
    marginBottom: 6,
  },
  expandLabel: {
    color: Colors.accentText,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  expandLine: {
    color: Colors.secondaryText,
    fontSize: 12,
    lineHeight: 18,
  },
  expandRisk: {
    color: Colors.dangerText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  askCoachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 168, 67, 0.12)',
    marginTop: 8,
  },
  askCoachText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: Colors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
});
