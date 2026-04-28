// Sprint 26: Data Export Service
// CSV (per data type, zipped) and PDF wellness summary generation
//
// PRIVACY:
// - Journal entries with private=true: EXCLUDED by default (opt-in toggle)
// - Intimacy/sexual data (LOG_SEXUAL): ALWAYS excluded, no toggle
// - Therapy notes: ALWAYS excluded (stripped from therapy entries)
// - API keys: stored in SecureStore, never in export scope
// - Coach DUB conversations: NOT included (API calls, not user data)

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
  deleteAsync,
} from 'expo-file-system/legacy';
import { shareAsync } from 'expo-sharing';
import { storageGet, storageList, dateKey, STORAGE_KEYS } from '../utils/storage';
import { logAuditEvent } from '../utils/audit';
import type { UserProfile } from '../types/profile';
import type { DailySummary } from '../types';

// ============================================================
// Types
// ============================================================

export type ExportFormat = 'csv' | 'pdf';
export type DatePreset = 'all' | '7d' | '30d' | '90d' | 'custom';

export interface ExportOptions {
  format: ExportFormat;
  datePreset: DatePreset;
  customRange?: { start: Date; end: Date };
  includeJournal: boolean;
}

export interface GatheredData {
  [dataType: string]: Record<string, unknown>[];
}

// Storage keys that map to each CSV data type
const LOG_TYPE_MAP: Record<string, string> = {
  sleep: STORAGE_KEYS.LOG_SLEEP,
  mood: STORAGE_KEYS.LOG_MOOD,
  mood_mental: STORAGE_KEYS.LOG_MOOD_MENTAL,
  food: STORAGE_KEYS.LOG_FOOD,
  water: STORAGE_KEYS.LOG_WATER,
  caffeine: STORAGE_KEYS.LOG_CAFFEINE,
  exercise: STORAGE_KEYS.LOG_WORKOUT,
  strength: STORAGE_KEYS.LOG_STRENGTH,
  steps: STORAGE_KEYS.LOG_STEPS,
  medications: STORAGE_KEYS.LOG_MEDICATIONS,
  supplements: STORAGE_KEYS.LOG_SUPPLEMENTS,
  body: STORAGE_KEYS.LOG_BODY,
  body_measurements: STORAGE_KEYS.LOG_BODY_MEASUREMENTS,
  cycle: STORAGE_KEYS.LOG_CYCLE,
  migraines: STORAGE_KEYS.LOG_MIGRAINE,
  meditation: STORAGE_KEYS.LOG_MEDITATION,
  stress: STORAGE_KEYS.LOG_STRESS,
  gratitude: STORAGE_KEYS.LOG_GRATITUDE,
  therapy: STORAGE_KEYS.LOG_THERAPY,
  digestive: STORAGE_KEYS.LOG_DIGESTIVE,
  personalcare: STORAGE_KEYS.LOG_PERSONALCARE,
  injury: STORAGE_KEYS.LOG_INJURY,
  bloodwork: STORAGE_KEYS.LOG_BLOODWORK,
  glucose: STORAGE_KEYS.LOG_GLUCOSE,
  blood_pressure: STORAGE_KEYS.LOG_BP,
  habits: STORAGE_KEYS.LOG_HABITS,
  reps: STORAGE_KEYS.LOG_REPS,
  substances: STORAGE_KEYS.LOG_SUBSTANCES,
  social: STORAGE_KEYS.LOG_SOCIAL,
  sunlight: STORAGE_KEYS.LOG_SUNLIGHT,
  mobility: STORAGE_KEYS.LOG_MOBILITY,
  journal: STORAGE_KEYS.LOG_JOURNAL,
  allergies: STORAGE_KEYS.LOG_ALLERGIES,
  doctor_visits: STORAGE_KEYS.LOG_DOCTOR_VISITS,
  perimenopause: STORAGE_KEYS.LOG_PERIMENOPAUSE,
  breastfeeding: STORAGE_KEYS.LOG_BREASTFEEDING,
  custom: STORAGE_KEYS.LOG_CUSTOM,
};

// Keys to ALWAYS exclude from export
const EXCLUDED_LOG_KEYS: Set<string> = new Set([
  STORAGE_KEYS.LOG_SEXUAL, // Intimacy data — always excluded, no toggle
]);

// ============================================================
// Date Helpers
// ============================================================

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDateRange(options: ExportOptions): { start: Date; end: Date } | null {
  if (options.datePreset === 'all') return null;
  if (options.datePreset === 'custom' && options.customRange) {
    return options.customRange;
  }
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  const start = new Date();
  const days = options.datePreset === '7d' ? 7 : options.datePreset === '30d' ? 30 : 90;
  start.setDate(start.getDate() - days);
  start.setHours(12, 0, 0, 0);
  return { start, end };
}

function isDateInRange(dateStr: string, range: { start: Date; end: Date } | null): boolean {
  if (!range) return true;
  const d = new Date(dateStr + 'T12:00:00');
  return d >= range.start && d <= range.end;
}

// ============================================================
// Data Gathering
// ============================================================

function stripTherapyNotes(entry: Record<string, unknown>): Record<string, unknown> {
  const { notes, ...rest } = entry;
  return rest;
}

export async function gatherAllData(
  options: ExportOptions,
): Promise<GatheredData> {
  const range = getDateRange(options);
  const result: GatheredData = {};

  for (const [dataType, baseKey] of Object.entries(LOG_TYPE_MAP)) {
    // Always exclude intimacy data
    if (EXCLUDED_LOG_KEYS.has(baseKey)) continue;

    // Skip journal if not opted in
    if (dataType === 'journal' && !options.includeJournal) continue;

    const keys = await storageList(`${baseKey}.`);
    const entries: Record<string, unknown>[] = [];

    for (const key of keys) {
      // Extract date from key
      const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch) continue;
      if (!isDateInRange(dateMatch[1], range)) continue;

      const raw = await storageGet<unknown>(key);
      if (raw == null) continue;

      const items = Array.isArray(raw) ? raw : [raw];
      for (const item of items) {
        if (typeof item === 'object' && item !== null) {
          let entry = { date: dateMatch[1], ...item } as Record<string, unknown>;

          // Strip therapy notes
          if (dataType === 'therapy') {
            entry = stripTherapyNotes(entry);
          }

          entries.push(entry);
        }
      }
    }

    // For journal: always exclude private entries.
    // includeJournal controls whether non-private entries are included.
    if (dataType === 'journal') {
      const filtered = entries.filter((e) => !(e as Record<string, unknown>).private);
      result[dataType] = filtered;
    } else {
      result[dataType] = entries;
    }
  }

  return result;
}

// ============================================================
// CSV Generation
// ============================================================

function escapeCSVValue(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}_${key}` : key;
    if (Array.isArray(value)) {
      result[fullKey] = value.join('; ');
    } else if (typeof value === 'object' && value !== null) {
      const nested = flattenObject(value as Record<string, unknown>, fullKey);
      Object.assign(result, nested);
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

export function generateCSV(dataType: string, entries: Record<string, unknown>[]): string {
  if (entries.length === 0) {
    return `# No ${dataType} data logged\n`;
  }

  // Flatten all entries
  const flattened = entries.map((e) => flattenObject(e));

  // Collect all unique headers
  const headerSet = new Set<string>();
  for (const row of flattened) {
    for (const key of Object.keys(row)) headerSet.add(key);
  }

  // Put date first, then sort the rest
  const headers = ['date', ...Array.from(headerSet).filter((h) => h !== 'date').sort()];

  // Build CSV
  const lines = [headers.map(escapeCSVValue).join(',')];
  for (const row of flattened) {
    const values = headers.map((h) => escapeCSVValue(row[h]));
    lines.push(values.join(','));
  }
  return lines.join('\n');
}

// ============================================================
// PDF Summary Report Generation
// ============================================================

function getDaysInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    dates.push(formatDateStr(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function gatherSummaries(dates: string[]): Promise<DailySummary[]> {
  const summaries: DailySummary[] = [];
  for (const d of dates) {
    const s = await storageGet<DailySummary>(dateKey(STORAGE_KEYS.DAILY_SUMMARY, d));
    if (s) summaries.push(s);
  }
  return summaries;
}

export async function generatePDFHTML(
  options: ExportOptions,
): Promise<string> {
  const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
  const patientName = profile?.name ?? 'User';

  const range = getDateRange(options);
  const now = new Date();
  const startDate = range ? formatDateStr(range.start) : '2020-01-01';
  const endDate = range ? formatDateStr(range.end) : formatDateStr(now);
  const dates = getDaysInRange(startDate, endDate);
  const summaries = await gatherSummaries(dates);

  const rangeLabel = options.datePreset === '7d' ? 'Last 7 Days'
    : options.datePreset === '30d' ? 'Last 30 Days'
    : options.datePreset === '90d' ? 'Last 90 Days'
    : options.datePreset === 'custom' ? `${startDate} to ${endDate}`
    : 'All Time';

  // Compute statistics
  const n = summaries.length;

  // Compliance — read from per-day compliance keys
  let complianceTotal = 0;
  let complianceDayCount = 0;
  for (const d of dates) {
    const c = await storageGet<{ percentage?: number }>(dateKey(STORAGE_KEYS.COMPLIANCE, d));
    if (c?.percentage !== undefined) {
      complianceTotal += c.percentage;
      complianceDayCount++;
    }
  }
  const avgCompliance = complianceDayCount > 0 ? Math.round(complianceTotal / complianceDayCount) : null;

  // Sleep
  const sleepDays = summaries.filter((s) => s.sleep_hours !== undefined && s.sleep_hours !== null);
  const avgSleep = sleepDays.length > 0
    ? (sleepDays.reduce((sum, s) => sum + (s.sleep_hours ?? 0), 0) / sleepDays.length).toFixed(1)
    : null;

  // Mood trend
  const moodDays = summaries.filter((s) => s.mood_avg !== undefined && s.mood_avg !== null);
  let moodTrend = 'No mood data logged';
  if (moodDays.length >= 2) {
    const firstHalf = moodDays.slice(0, Math.floor(moodDays.length / 2));
    const secondHalf = moodDays.slice(Math.floor(moodDays.length / 2));
    const avgFirst = firstHalf.reduce((s, d) => s + (d.mood_avg ?? 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + (d.mood_avg ?? 0), 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    if (Math.abs(diff) < 0.3) {
      moodTrend = `Stable (avg ${((avgFirst + avgSecond) / 2).toFixed(1)}/5)`;
    } else if (diff > 0) {
      moodTrend = `Improving (${avgFirst.toFixed(1)} -> ${avgSecond.toFixed(1)}/5)`;
    } else {
      moodTrend = `Declining (${avgFirst.toFixed(1)} -> ${avgSecond.toFixed(1)}/5)`;
    }
  } else if (moodDays.length === 1) {
    moodTrend = `Single entry: ${(moodDays[0].mood_avg ?? 0).toFixed(1)}/5`;
  }

  // Top stress triggers — gather from stress logs
  const stressTriggers: Record<string, number> = {};
  for (const d of dates) {
    const stressEntry = await storageGet<{ trigger?: string | null }>(
      dateKey(STORAGE_KEYS.LOG_STRESS, d),
    );
    if (stressEntry?.trigger) {
      stressTriggers[stressEntry.trigger] = (stressTriggers[stressEntry.trigger] ?? 0) + 1;
    }
  }
  const topTriggers = Object.entries(stressTriggers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, c]) => `${t.charAt(0).toUpperCase() + t.slice(1)} (${c}x)`)
    .join(', ') || 'No stress data logged';

  // Medication adherence
  const medKeys = await storageList(`${STORAGE_KEYS.LOG_MEDICATIONS}.`);
  let medTotal = 0;
  let medTaken = 0;
  for (const key of medKeys) {
    const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})$/);
    if (!dateMatch || !isDateInRange(dateMatch[1], range)) continue;
    const entry = await storageGet<{ medications?: Array<{ taken?: boolean }> }>(key);
    if (entry?.medications) {
      for (const med of entry.medications) {
        medTotal++;
        if (med.taken) medTaken++;
      }
    }
  }
  const medAdherence = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : null;

  // Weight change
  const weightDays = summaries.filter((s) => s.weight_lbs !== undefined && s.weight_lbs !== null);
  let weightChange = 'No weight data logged';
  if (weightDays.length >= 2) {
    const startW = weightDays[0].weight_lbs!;
    const endW = weightDays[weightDays.length - 1].weight_lbs!;
    const diff = endW - startW;
    weightChange = `${startW.toFixed(1)} -> ${endW.toFixed(1)} lbs (${diff >= 0 ? '+' : ''}${diff.toFixed(1)} lbs)`;
  } else if (weightDays.length === 1) {
    weightChange = `${weightDays[0].weight_lbs!.toFixed(1)} lbs (single measurement)`;
  }

  // Exercise totals
  const totalActiveMin = summaries.reduce((s, d) => s + (d.active_minutes ?? 0), 0);
  const totalCalsBurned = summaries.reduce((s, d) => s + (d.calories_burned ?? 0), 0);
  const workoutDays = summaries.filter(
    (s) => (s.active_minutes ?? 0) > 0,
  ).length;

  const generatedDate = now.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      padding: 40px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 3px solid #1E2761;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 20pt;
      color: #1E2761;
      margin-bottom: 4px;
    }
    .header .subtitle {
      color: #666;
      font-size: 10pt;
    }
    .meta {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
      font-size: 10pt;
    }
    .section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 13pt;
      color: #1E2761;
      border-bottom: 1px solid #ddd;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
      font-size: 10pt;
    }
    th {
      background: #f8f8f8;
      font-weight: 600;
      color: #1E2761;
    }
    .no-data {
      color: #999;
      font-style: italic;
      padding: 4px 0;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }
    .disclaimer {
      margin-top: 20px;
      padding: 10px;
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 4px;
      font-size: 9pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DUB Tracker &mdash; Wellness Report for ${escapeHTML(patientName)}</h1>
    <div class="subtitle">${rangeLabel} | Generated ${generatedDate}</div>
  </div>

  <div class="meta">
    <span><strong>Days in range:</strong> ${dates.length}</span>
    <span><strong>Days with data:</strong> ${n}</span>
  </div>

  <div class="section">
    <h2>Compliance</h2>
    ${avgCompliance !== null
      ? `<table><tr><th>Metric</th><th>Value</th></tr>
         <tr><td>Average Daily Compliance</td><td>${avgCompliance}%</td></tr>
         <tr><td>Days Tracked</td><td>${complianceDayCount}</td></tr></table>`
      : '<p class="no-data">No compliance data logged</p>'}
  </div>

  <div class="section">
    <h2>Sleep</h2>
    ${avgSleep !== null
      ? `<table><tr><th>Metric</th><th>Value</th></tr>
         <tr><td>Average Sleep Duration</td><td>${avgSleep} hours</td></tr>
         <tr><td>Nights Tracked</td><td>${sleepDays.length}</td></tr></table>`
      : '<p class="no-data">No sleep data logged</p>'}
  </div>

  <div class="section">
    <h2>Mood Trend</h2>
    <p>${moodTrend}</p>
  </div>

  <div class="section">
    <h2>Top Stress Triggers</h2>
    <p>${topTriggers}</p>
  </div>

  <div class="section">
    <h2>Medication Adherence</h2>
    ${medAdherence !== null
      ? `<table><tr><th>Metric</th><th>Value</th></tr>
         <tr><td>Adherence Rate</td><td>${medAdherence}%</td></tr>
         <tr><td>Total Doses Scheduled</td><td>${medTotal}</td></tr>
         <tr><td>Doses Taken</td><td>${medTaken}</td></tr></table>`
      : '<p class="no-data">No medication data logged</p>'}
  </div>

  <div class="section">
    <h2>Weight</h2>
    <p>${weightChange}</p>
  </div>

  <div class="section">
    <h2>Exercise</h2>
    ${workoutDays > 0
      ? `<table><tr><th>Metric</th><th>Value</th></tr>
         <tr><td>Active Days</td><td>${workoutDays}</td></tr>
         <tr><td>Total Active Minutes</td><td>${totalActiveMin}</td></tr>
         <tr><td>Total Calories Burned</td><td>${totalCalsBurned} kcal</td></tr></table>`
      : '<p class="no-data">No exercise data logged</p>'}
  </div>

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is generated from self-reported data. It has not been
    verified by a healthcare professional and is intended to supplement, not replace, clinical evaluation.
  </div>

  <div class="footer">
    Generated by DUB Tracker | dubtracker.ai
  </div>
</body>
</html>`;
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// ZIP-like CSV bundle (one file per data type)
// Since expo doesn't have native zip, we create individual files
// and share them, or concatenate into a single combined CSV.
// For mobile, we create a combined CSV with data type sections.
// ============================================================

export async function createExportBundle(
  data: GatheredData,
): Promise<string> {
  const dateStr = formatDateStr(new Date());

  // Build a combined CSV with all data types separated by headers
  const sections: string[] = [];
  const dataTypes = Object.keys(data).sort();

  for (const dataType of dataTypes) {
    const entries = data[dataType];
    const csv = generateCSV(dataType, entries);
    sections.push(`### ${dataType.toUpperCase()} ###\n${csv}`);
  }

  const combined = `# DUB Tracker Data Export - ${dateStr}\n# Generated: ${new Date().toISOString()}\n\n${sections.join('\n\n')}`;

  const fileName = `dub_tracker_export_${dateStr}.csv`;
  const filePath = `${cacheDirectory}${fileName}`;

  await writeAsStringAsync(filePath, combined, {
    encoding: EncodingType.UTF8,
  });

  return filePath;
}

// ============================================================
// Export Orchestrators
// ============================================================

export async function exportCSV(options: ExportOptions): Promise<void> {
  const data = await gatherAllData(options);

  const filePath = await createExportBundle(data);

  const totalEntries = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  const dataTypes = Object.keys(data).filter((k) => data[k].length > 0);

  await logAuditEvent('DATA_EXPORT', {
    format: 'csv',
    date_preset: options.datePreset,
    data_types: dataTypes,
    total_entries: totalEntries,
    journal_included: options.includeJournal,
  });

  await shareAsync(filePath, {
    mimeType: 'text/csv',
    dialogTitle: 'DUB Tracker CSV Export',
    UTI: 'public.comma-separated-values-text',
  });

  // Clean up temp file
  await deleteAsync(filePath, { idempotent: true }).catch(() => {});
}

export async function exportPDF(options: ExportOptions): Promise<void> {
  const html = await generatePDFHTML(options);

  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  await logAuditEvent('DATA_EXPORT', {
    format: 'pdf',
    date_preset: options.datePreset,
    journal_included: false,
  });

  await shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'DUB Tracker Wellness Report',
    UTI: 'com.adobe.pdf',
  });
}

export async function runExport(options: ExportOptions): Promise<void> {
  if (options.format === 'csv') {
    await exportCSV(options);
  } else {
    await exportPDF(options);
  }
}

// ============================================================
// Privacy Audit: Complete list of storage keys and their export status
// ============================================================

export const EXPORT_PRIVACY_MAP: Record<string, 'included' | 'excluded_always' | 'excluded_default' | 'not_user_data'> = {
  // Included in CSV export
  [STORAGE_KEYS.LOG_SLEEP]: 'included',
  [STORAGE_KEYS.LOG_MOOD]: 'included',
  [STORAGE_KEYS.LOG_MOOD_MENTAL]: 'included',
  [STORAGE_KEYS.LOG_FOOD]: 'included',
  [STORAGE_KEYS.LOG_WATER]: 'included',
  [STORAGE_KEYS.LOG_CAFFEINE]: 'included',
  [STORAGE_KEYS.LOG_WORKOUT]: 'included',
  [STORAGE_KEYS.LOG_STRENGTH]: 'included',
  [STORAGE_KEYS.LOG_STEPS]: 'included',
  [STORAGE_KEYS.LOG_MEDICATIONS]: 'included',
  [STORAGE_KEYS.LOG_SUPPLEMENTS]: 'included',
  [STORAGE_KEYS.LOG_BODY]: 'included',
  [STORAGE_KEYS.LOG_BODY_MEASUREMENTS]: 'included',
  [STORAGE_KEYS.LOG_RECOVERY_METRICS]: 'included',
  [STORAGE_KEYS.LOG_CYCLE]: 'included',
  [STORAGE_KEYS.LOG_MIGRAINE]: 'included',
  [STORAGE_KEYS.LOG_MEDITATION]: 'included',
  [STORAGE_KEYS.LOG_STRESS]: 'included',
  [STORAGE_KEYS.LOG_GRATITUDE]: 'included',
  [STORAGE_KEYS.LOG_DIGESTIVE]: 'included',
  [STORAGE_KEYS.LOG_PERSONALCARE]: 'included',
  [STORAGE_KEYS.LOG_INJURY]: 'included',
  // S33-A: pain log entries are health-relevant; default included.
  // Indexes are derivable from entries themselves and not needed in
  // exports — but the key constants live under dub.log.* so they
  // must be classified here too. Both indexes treated as not user-
  // visible data (they're internal redundancy, not new information).
  [STORAGE_KEYS.PAIN_LOG_PREFIX]: 'included',
  [STORAGE_KEYS.PAIN_LOG_INDEX_BY_DATE]: 'not_user_data',
  [STORAGE_KEYS.PAIN_LOG_INDEX_BY_AREA]: 'not_user_data',
  [STORAGE_KEYS.LOG_BLOODWORK]: 'included',
  [STORAGE_KEYS.LOG_GLUCOSE]: 'included',
  [STORAGE_KEYS.LOG_BP]: 'included',
  [STORAGE_KEYS.LOG_HABITS]: 'included',
  [STORAGE_KEYS.LOG_REPS]: 'included',
  [STORAGE_KEYS.LOG_SUBSTANCES]: 'included',
  [STORAGE_KEYS.LOG_SOCIAL]: 'included',
  [STORAGE_KEYS.LOG_SUNLIGHT]: 'included',
  [STORAGE_KEYS.LOG_MOBILITY]: 'included',
  [STORAGE_KEYS.LOG_ALLERGIES]: 'included',
  [STORAGE_KEYS.LOG_DOCTOR_VISITS]: 'included',
  [STORAGE_KEYS.LOG_PERIMENOPAUSE]: 'included',
  [STORAGE_KEYS.LOG_BREASTFEEDING]: 'included',
  [STORAGE_KEYS.LOG_CUSTOM]: 'included',

  // Therapy: included but notes are ALWAYS stripped
  [STORAGE_KEYS.LOG_THERAPY]: 'included', // notes field stripped

  // Journal: excluded by default, opt-in toggle
  [STORAGE_KEYS.LOG_JOURNAL]: 'excluded_default',

  // Always excluded — no toggle
  [STORAGE_KEYS.LOG_SEXUAL]: 'excluded_always',

  // Not user log data — never in export
  [STORAGE_KEYS.COACH_HISTORY]: 'not_user_data',
  [STORAGE_KEYS.COACH_PATTERNS]: 'not_user_data',
  [STORAGE_KEYS.FEEDBACK_LOG]: 'not_user_data',
};
