// Sprint 22 — 7-day nutrient average + trend (the "Bloomberg terminal" view)
// Pure helpers used by the report screen; no storage access here so unit
// tests can drive them with in-memory report fixtures.

import type {
  DailyNutrientReport,
  NutrientDailyTotal,
} from './nutrientAggregator';
import { getAccount } from '../constants/nutrientAccounts';

export interface NutrientAverageRow {
  code: string;
  name: string;
  unit: string;
  avg_total: number;        // mean across window
  avg_food: number;
  avg_supp: number;
  rda: number | null;
  ul: number | null;
  pct_rda: number | null;   // percentage of RDA at avg_total
  pct_ul: number | null;    // percentage of UL at avg_total
  prev_avg: number;         // mean across previous window (for trend)
  trend_direction: 'up' | 'down' | 'stable';
  trend_pct: number;        // absolute percentage delta; 0 when stable
}

interface SumBucket {
  unit: string;
  name: string;
  sum_total: number;
  sum_food: number;
  sum_supp: number;
}

function emptyBucket(): SumBucket {
  return { unit: '', name: '', sum_total: 0, sum_food: 0, sum_supp: 0 };
}

function sumTotals(reports: DailyNutrientReport[]): Map<string, SumBucket> {
  const out = new Map<string, SumBucket>();
  for (const r of reports) {
    for (const t of r.totals) {
      const b = out.get(t.code) ?? emptyBucket();
      b.name = t.name;
      b.unit = t.unit;
      b.sum_total += t.total;
      b.sum_food += t.food_sourced;
      b.sum_supp += t.supplement_sourced;
      out.set(t.code, b);
    }
  }
  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Compare current vs previous-window average and classify direction.
 * Stable bucket: |delta| < 5% (per spec). Mirrors the "Bloomberg" view.
 */
export function computeTrend(
  current: number,
  previous: number,
): { direction: 'up' | 'down' | 'stable'; pct: number } {
  if (previous <= 0) {
    if (current <= 0) return { direction: 'stable', pct: 0 };
    return { direction: 'up', pct: 100 };
  }
  const deltaPct = ((current - previous) / previous) * 100;
  if (Math.abs(deltaPct) < 5) return { direction: 'stable', pct: 0 };
  return {
    direction: deltaPct > 0 ? 'up' : 'down',
    pct: Math.round(Math.abs(deltaPct)),
  };
}

/**
 * Build one averaged row per nutrient code, optionally with a prior-window
 * comparison. `reports` is the current window (e.g. last 7 days); if
 * `priorReports` is provided, trend vs that window is also computed.
 *
 * Nutrients that appear in `priorReports` but not in `reports` are still
 * emitted so the UI can show a "dropped to zero" trend.
 */
export function buildNutrientAverages(
  reports: DailyNutrientReport[],
  sex: 'male' | 'female',
  priorReports: DailyNutrientReport[] = [],
): NutrientAverageRow[] {
  const days = Math.max(reports.length, 1);
  const priorDays = Math.max(priorReports.length, 1);
  const current = sumTotals(reports);
  const prior = sumTotals(priorReports);

  const codes = new Set<string>([...current.keys(), ...prior.keys()]);
  const rows: NutrientAverageRow[] = [];

  for (const code of codes) {
    const acct = getAccount(code);
    if (!acct) continue;

    const cur = current.get(code) ?? emptyBucket();
    const pre = prior.get(code) ?? emptyBucket();
    const avg_total = round3(cur.sum_total / days);
    const avg_food = round3(cur.sum_food / days);
    const avg_supp = round3(cur.sum_supp / days);
    const prev_avg = round3(pre.sum_total / priorDays);
    const rda = sex === 'male' ? acct.rda_male : acct.rda_female;
    const ul = acct.ul;

    const pct_rda =
      rda != null && rda > 0 ? Math.round((avg_total / rda) * 100) : null;
    const pct_ul =
      ul != null && ul > 0 ? Math.round((avg_total / ul) * 100) : null;

    const trend = computeTrend(avg_total, prev_avg);

    rows.push({
      code,
      name: acct.name,
      unit: acct.unit,
      avg_total,
      avg_food,
      avg_supp,
      rda,
      ul,
      pct_rda,
      pct_ul,
      prev_avg,
      trend_direction: trend.direction,
      trend_pct: trend.pct,
    });
  }

  rows.sort(
    (a, b) =>
      (getAccount(a.code)?.display_order ?? 999) -
      (getAccount(b.code)?.display_order ?? 999),
  );
  return rows;
}

/**
 * Trend colour policy ("Bloomberg" rules):
 * - UL nutrients: trending DOWN toward safe = good (green); trending UP
 *   toward/past UL = bad (red). Stable = neutral.
 * - RDA nutrients without UL: trending toward RDA = good; away = amber.
 * - Anything else: neutral.
 *
 * Returns a semantic classification so the screen can pick the concrete
 * colour from the shared palette.
 */
export function classifyTrendSemantic(
  row: NutrientAverageRow,
): 'good' | 'bad' | 'neutral' {
  if (row.trend_direction === 'stable') return 'neutral';

  // UL-bounded: closer to UL is worse.
  if (row.ul != null) {
    if (row.trend_direction === 'up') return 'bad';
    return 'good';
  }

  // RDA-only: closer to RDA is better. Without an RDA, we can't classify.
  if (row.rda == null) return 'neutral';
  const curGap = Math.abs(row.avg_total - row.rda);
  const prevGap = Math.abs(row.prev_avg - row.rda);
  if (curGap < prevGap) return 'good';
  if (curGap > prevGap) return 'bad';
  return 'neutral';
}

/**
 * Helper for single-day totals: percentage-of-RDA met counter used by the
 * summary card row ("RDA Met: 18/24"). Counts totals where pct_rda >= 100.
 */
export function countRdaMet(totals: NutrientDailyTotal[]): {
  met: number;
  tracked: number;
} {
  let met = 0;
  let tracked = 0;
  for (const t of totals) {
    if (t.rda != null && t.rda > 0) {
      tracked += 1;
      if ((t.pct_rda ?? 0) >= 100) met += 1;
    }
  }
  return { met, tracked };
}
