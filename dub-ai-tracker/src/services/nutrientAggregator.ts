// Sprint 22 — Daily Nutrient Aggregator (the "Daily P&L")
// Reads all food and supplement entries for a given date, maps them onto
// the nutrient chart of accounts, and emits totals + UL alerts.

import { storageGet, STORAGE_KEYS, dateKey } from '../utils/storage';
import {
  NUTRIENT_ACCOUNTS,
  FOOD_FIELD_TO_ACCOUNT,
  getAccount,
  getRDA,
} from '../constants/nutrientAccounts';
import type { FoodEntry, NutritionInfo } from '../types/food';
import type { SupplementEntry } from '../types';

export type NutrientStatus =
  | 'deficient'
  | 'adequate'
  | 'elevated'
  | 'exceeds_ul';

export interface NutrientDailyTotal {
  code: string;
  name: string;
  unit: string;
  food_sourced: number;
  supplement_sourced: number;
  total: number;
  rda: number | null;
  ul: number | null;
  pct_rda: number | null;
  pct_ul: number | null;
  status: NutrientStatus;
}

export interface NutrientAlertSource {
  name: string;
  amount: number;
  type: 'food' | 'supplement';
}

export interface NutrientAlert {
  code: string;
  name: string;
  severity: 'warning' | 'critical';
  message: string;
  total: number;
  limit: number;
  unit: string;
  sources: NutrientAlertSource[];
}

export interface DailyNutrientReport {
  date: string;
  entries_count: number;
  totals: NutrientDailyTotal[];
  alerts: NutrientAlert[];
}

interface SourceContribution {
  code: string;
  name: string;
  amount: number;
  type: 'food' | 'supplement';
}

// Magnesium's UL applies only to supplement-sourced intake; food magnesium
// has no established UL (NIH ODS).
const SUPPLEMENT_ONLY_UL_CODES = new Set<string>(['NUT-MIC-MG']);

function roundAmount(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export async function getDailyNutrientReport(
  date: string,
  sex: 'male' | 'female',
): Promise<DailyNutrientReport> {
  const [foodEntries, suppEntries] = await Promise.all([
    storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, date)),
    storageGet<SupplementEntry[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, date)),
  ]);

  const foods = foodEntries ?? [];
  const supps = suppEntries ?? [];

  // Running totals per account code
  const foodTotals = new Map<string, number>();
  const suppTotals = new Map<string, number>();
  // Per-code contribution list, for alert source attribution
  const contributions = new Map<string, SourceContribution[]>();

  // --- Food aggregation --------------------------------------------------
  for (const entry of foods) {
    const n = entry.computed_nutrition as NutritionInfo | undefined;
    if (!n) continue;
    const entryName = entry.food_item?.name ?? 'Food entry';

    for (const [field, code] of Object.entries(FOOD_FIELD_TO_ACCOUNT)) {
      const raw = (n as unknown as Record<string, number | null | undefined>)[field];
      if (raw == null) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value === 0) continue;

      foodTotals.set(code, (foodTotals.get(code) ?? 0) + value);
      const list = contributions.get(code) ?? [];
      list.push({ code, name: entryName, amount: value, type: 'food' });
      contributions.set(code, list);
    }
  }

  // --- Supplement aggregation -------------------------------------------
  for (const entry of supps) {
    // Legacy entries lacking a nutrients[] breakdown cannot be split across
    // accounts — skip micronutrient aggregation for them.
    if (!entry.nutrients || entry.nutrients.length === 0) continue;

    for (const line of entry.nutrients) {
      const code = line.code;
      const amount = Number(line.amount);
      if (!code || !Number.isFinite(amount) || amount === 0) continue;

      suppTotals.set(code, (suppTotals.get(code) ?? 0) + amount);
      const list = contributions.get(code) ?? [];
      list.push({ code, name: entry.name, amount, type: 'supplement' });
      contributions.set(code, list);
    }
  }

  // --- Build totals + alerts --------------------------------------------
  const allCodes = new Set<string>([
    ...foodTotals.keys(),
    ...suppTotals.keys(),
  ]);

  const totals: NutrientDailyTotal[] = [];
  const alerts: NutrientAlert[] = [];

  for (const code of allCodes) {
    const acct = getAccount(code);
    if (!acct) continue;
    const food_sourced = roundAmount(foodTotals.get(code) ?? 0);
    const supplement_sourced = roundAmount(suppTotals.get(code) ?? 0);
    const total = roundAmount(food_sourced + supplement_sourced);
    if (total === 0) continue;

    const rda = getRDA(code, sex);
    const ul = acct.ul;
    // Magnesium special case: only supplement-sourced counts against UL.
    const ulCompareValue = SUPPLEMENT_ONLY_UL_CODES.has(code)
      ? supplement_sourced
      : total;

    const pct_rda = rda != null && rda > 0 ? (total / rda) * 100 : null;
    const pct_ul = ul != null && ul > 0 ? (ulCompareValue / ul) * 100 : null;

    let status: NutrientStatus;
    if (ul != null && ulCompareValue > ul) {
      status = 'exceeds_ul';
    } else if (rda != null && total < rda * 0.5) {
      status = 'deficient';
    } else if (rda != null && total > rda) {
      status = 'elevated';
    } else {
      status = 'adequate';
    }

    totals.push({
      code,
      name: acct.name,
      unit: acct.unit,
      food_sourced,
      supplement_sourced,
      total,
      rda,
      ul,
      pct_rda: pct_rda != null ? Math.round(pct_rda) : null,
      pct_ul: pct_ul != null ? Math.round(pct_ul) : null,
      status,
    });

    // Alert generation: warning at 80%+ of UL, critical over UL
    if (ul != null && ul > 0 && ulCompareValue > 0) {
      const ratio = ulCompareValue / ul;
      if (ratio > 1) {
        alerts.push(
          buildAlert(acct, ulCompareValue, ul, 'critical', contributions.get(code) ?? []),
        );
      } else if (ratio > 0.8) {
        alerts.push(
          buildAlert(acct, ulCompareValue, ul, 'warning', contributions.get(code) ?? []),
        );
      }
    }
  }

  totals.sort(
    (a, b) =>
      (getAccount(a.code)?.display_order ?? 999) -
      (getAccount(b.code)?.display_order ?? 999),
  );

  return {
    date,
    entries_count: foods.length + supps.length,
    totals,
    alerts,
  };
}

function buildAlert(
  acct: (typeof NUTRIENT_ACCOUNTS)[number],
  total: number,
  ul: number,
  severity: 'warning' | 'critical',
  contributions: SourceContribution[],
): NutrientAlert {
  // Merge contributions by source name (sum amounts for repeats)
  const mergedMap = new Map<string, NutrientAlertSource>();
  for (const c of contributions) {
    const key = `${c.type}:${c.name}`;
    const prev = mergedMap.get(key);
    if (prev) {
      prev.amount = roundAmount(prev.amount + c.amount);
    } else {
      mergedMap.set(key, {
        name: c.name,
        amount: roundAmount(c.amount),
        type: c.type,
      });
    }
  }
  const sources = Array.from(mergedMap.values()).sort(
    (a, b) => b.amount - a.amount,
  );

  const pct = Math.round((total / ul) * 100);
  const sourceStr = sources
    .map((s) => `${s.name} (${s.amount}${acct.unit})`)
    .join(', ');

  const displayTotal = roundAmount(total);
  const message =
    severity === 'critical'
      ? `Your ${acct.name.toLowerCase()} intake today is ${displayTotal}${acct.unit} — ${pct - 100}% over the ${ul}${acct.unit} upper limit. Sources: ${sourceStr}.${acct.clinical_risk ? ` ${acct.clinical_risk}` : ''}`
      : `Your ${acct.name.toLowerCase()} intake today is ${displayTotal}${acct.unit} (${pct}% of the ${ul}${acct.unit} upper limit). Sources: ${sourceStr}.`;

  return {
    code: acct.code,
    name: acct.name,
    severity,
    message,
    total: displayTotal,
    limit: ul,
    unit: acct.unit,
    sources,
  };
}

/**
 * Build a concise nutrient-status block for Coach context injection.
 * Skips accounts with zero totals. Flags UL breaches clearly.
 */
export function formatReportForCoach(report: DailyNutrientReport): string {
  if (report.totals.length === 0) {
    return 'DAILY NUTRIENT STATUS (today): no food or supplement entries logged.';
  }
  const lines: string[] = ['DAILY NUTRIENT STATUS (today):'];
  for (const t of report.totals) {
    const pieces: string[] = [];
    if (t.ul != null) {
      const pct = t.pct_ul ?? 0;
      const flag =
        t.status === 'exceeds_ul' ? ' ⚠️ EXCEEDS LIMIT' : '';
      pieces.push(`${t.total}${t.unit} / ${t.ul}${t.unit} UL (${pct}%)${flag}`);
    } else if (t.rda != null) {
      pieces.push(`${t.total}${t.unit} / ${t.rda}${t.unit} RDA (${t.pct_rda ?? 0}%)`);
    } else {
      pieces.push(`${t.total}${t.unit}`);
    }
    lines.push(`${t.name}: ${pieces.join(' ')}`);
    if (t.status === 'exceeds_ul') {
      const alert = report.alerts.find((a) => a.code === t.code);
      if (alert && alert.sources.length > 0) {
        const srcStr = alert.sources
          .map((s) => `${s.name} ${s.amount}${t.unit}`)
          .join(', ');
        lines.push(`  Sources: ${srcStr}`);
      }
    }
  }
  return lines.join('\n');
}
