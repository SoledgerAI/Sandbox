// On-device PDF generation for Health Report
// Phase 21: Reporting, Health Report PDF, and Celebrations
//
// CRITICAL: Therapy notes are NEVER included (not even as an option).
// CRITICAL: Mood/gratitude raw entries are NEVER included (summary statistics only).
// Coach chat history is NEVER included.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  storageGet,
  storageList,
  dateKey,
  STORAGE_KEYS,
} from '../utils/storage';
import { logAuditEvent } from '../utils/audit';
import type {
  DailySummary,
  BodyEntry,
  SleepEntry,
  BloodworkEntry,
  SupplementEntry,
  InjuryEntry,
  CycleEntry,
  SubstanceEntry,
} from '../types';
import type { UserProfile } from '../types/profile';

// ============================================================
// Health Report Section Types
// ============================================================

export type HealthReportSection =
  | 'weight_body_composition'
  | 'nutrition'
  | 'exercise'
  | 'sleep'
  | 'vital_signs'
  | 'bloodwork'
  | 'supplements'
  | 'medications'
  | 'injury_pain'
  | 'womens_health'
  | 'substance_use';
// EXCLUDED: therapy_notes, mood_raw, gratitude_raw, coach_history, photos

export interface HealthReportConfig {
  sections: HealthReportSection[];
  dateRange: {
    start: string; // YYYY-MM-DD
    end: string;   // YYYY-MM-DD
  };
  includeCharts: boolean;
}

export const SECTION_LABELS: Record<HealthReportSection, string> = {
  weight_body_composition: 'Weight & Body Composition',
  nutrition: 'Nutrition Summary',
  exercise: 'Exercise Summary',
  sleep: 'Sleep Summary',
  vital_signs: 'Vital Signs',
  bloodwork: 'Bloodwork',
  supplements: 'Supplements',
  medications: 'Medications',
  injury_pain: 'Injury / Pain Log',
  womens_health: "Women's Health",
  substance_use: 'Substance Use Summary',
};

// ============================================================
// Date Helpers
// ============================================================

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateReadable(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getDaysInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// ============================================================
// Data Gathering
// ============================================================

async function gatherDailySummaries(dates: string[]): Promise<DailySummary[]> {
  const summaries: DailySummary[] = [];
  for (const dateStr of dates) {
    const key = dateKey(STORAGE_KEYS.DAILY_SUMMARY, dateStr);
    const summary = await storageGet<DailySummary>(key);
    if (summary) summaries.push(summary);
  }
  return summaries;
}

async function gatherBodyEntries(dates: string[]): Promise<Array<BodyEntry & { date: string }>> {
  const entries: Array<BodyEntry & { date: string }> = [];
  for (const dateStr of dates) {
    const entry = await storageGet<BodyEntry>(dateKey(STORAGE_KEYS.LOG_BODY, dateStr));
    if (entry) entries.push({ ...entry, date: dateStr });
  }
  return entries;
}

async function gatherSleepEntries(dates: string[]): Promise<Array<SleepEntry & { date: string }>> {
  const entries: Array<SleepEntry & { date: string }> = [];
  for (const dateStr of dates) {
    const entry = await storageGet<SleepEntry>(dateKey(STORAGE_KEYS.LOG_SLEEP, dateStr));
    if (entry) entries.push({ ...entry, date: dateStr });
  }
  return entries;
}

// ============================================================
// HTML Section Builders
// ============================================================

function buildWeightSection(
  summaries: DailySummary[],
  bodyEntries: Array<BodyEntry & { date: string }>,
): string {
  const weights = summaries.filter((s) => s.weight_lbs !== null);
  if (weights.length === 0 && bodyEntries.length === 0) {
    return '<p class="no-data">No weight data recorded in this period.</p>';
  }

  const startWeight = weights.length > 0 ? weights[0].weight_lbs : null;
  const endWeight = weights.length > 0 ? weights[weights.length - 1].weight_lbs : null;
  const change = startWeight !== null && endWeight !== null
    ? (endWeight - startWeight).toFixed(1)
    : 'N/A';

  let html = `
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Starting Weight</td><td>${startWeight !== null ? `${startWeight} lbs` : 'N/A'}</td></tr>
      <tr><td>Ending Weight</td><td>${endWeight !== null ? `${endWeight} lbs` : 'N/A'}</td></tr>
      <tr><td>Change</td><td>${change !== 'N/A' ? `${change} lbs` : 'N/A'}</td></tr>
      <tr><td>Measurements Recorded</td><td>${bodyEntries.length}</td></tr>
    </table>`;

  // Body composition from DEXA / body fat entries
  const bfEntries = bodyEntries.filter((b) => b.body_fat_pct !== null);
  if (bfEntries.length > 0) {
    const latest = bfEntries[bfEntries.length - 1];
    html += `
    <table>
      <tr><th>Body Composition</th><th>Latest (${latest.date})</th></tr>
      <tr><td>Body Fat %</td><td>${latest.body_fat_pct}%</td></tr>
    </table>`;
  }

  return html;
}

function buildNutritionSection(summaries: DailySummary[]): string {
  if (summaries.length === 0) {
    return '<p class="no-data">No nutrition data recorded in this period.</p>';
  }

  const n = summaries.length;
  const avgCals = Math.round(summaries.reduce((s, d) => s + d.calories_consumed, 0) / n);
  const avgProtein = Math.round(summaries.reduce((s, d) => s + d.protein_g, 0) / n);
  const avgCarbs = Math.round(summaries.reduce((s, d) => s + d.carbs_g, 0) / n);
  const avgFat = Math.round(summaries.reduce((s, d) => s + d.fat_g, 0) / n);
  const avgFiber = Math.round(summaries.reduce((s, d) => s + d.fiber_g, 0) / n);
  const avgSugar = Math.round(summaries.reduce((s, d) => s + d.sugar_g, 0) / n);
  const avgWater = Math.round(summaries.reduce((s, d) => s + d.water_oz, 0) / n);

  return `
    <table>
      <tr><th>Nutrient</th><th>Daily Average</th></tr>
      <tr><td>Calories</td><td>${avgCals} kcal</td></tr>
      <tr><td>Protein</td><td>${avgProtein}g</td></tr>
      <tr><td>Carbohydrates</td><td>${avgCarbs}g</td></tr>
      <tr><td>Fat</td><td>${avgFat}g</td></tr>
      <tr><td>Fiber</td><td>${avgFiber}g</td></tr>
      <tr><td>Sugar</td><td>${avgSugar}g</td></tr>
      <tr><td>Water</td><td>${avgWater} oz</td></tr>
    </table>
    <p class="footnote">Based on ${n} days of logged data.</p>`;
}

function buildExerciseSection(summaries: DailySummary[]): string {
  const workoutDays = summaries.filter(
    (s) => s.tags_logged.includes('fitness.workout') || s.tags_logged.includes('strength.training'),
  );

  if (workoutDays.length === 0) {
    return '<p class="no-data">No exercise data recorded in this period.</p>';
  }

  const totalActiveMin = summaries.reduce((s, d) => s + d.active_minutes, 0);
  const totalCalsBurned = summaries.reduce((s, d) => s + d.calories_burned, 0);

  return `
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Workout Days</td><td>${workoutDays.length}</td></tr>
      <tr><td>Total Active Minutes</td><td>${totalActiveMin}</td></tr>
      <tr><td>Total Calories Burned</td><td>${totalCalsBurned} kcal</td></tr>
      <tr><td>Avg. Active Min / Day</td><td>${Math.round(totalActiveMin / summaries.length)}</td></tr>
    </table>`;
}

function buildSleepSection(sleepEntries: Array<SleepEntry & { date: string }>): string {
  if (sleepEntries.length === 0) {
    return '<p class="no-data">No sleep data recorded in this period.</p>';
  }

  const durations: number[] = [];
  const qualities: number[] = [];

  for (const entry of sleepEntries) {
    if (entry.bedtime && entry.wake_time) {
      const bed = new Date(entry.bedtime);
      const wake = new Date(entry.wake_time);
      durations.push((wake.getTime() - bed.getTime()) / 3600000);
    }
    if (entry.quality !== null) qualities.push(entry.quality);
  }

  const avgDuration = durations.length > 0
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
    : 'N/A';
  const avgQuality = qualities.length > 0
    ? (qualities.reduce((a, b) => a + b, 0) / qualities.length).toFixed(1)
    : 'N/A';

  return `
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Nights Tracked</td><td>${sleepEntries.length}</td></tr>
      <tr><td>Avg. Duration</td><td>${avgDuration} hours</td></tr>
      <tr><td>Avg. Quality</td><td>${avgQuality} / 5</td></tr>
    </table>`;
}

function buildVitalSignsSection(bodyEntries: Array<BodyEntry & { date: string }>): string {
  const withBP = bodyEntries.filter((b) => b.bp_systolic !== null && b.bp_diastolic !== null);
  const withHR = bodyEntries.filter((b) => b.resting_hr !== null);
  const withHRV = bodyEntries.filter((b) => b.hrv_ms !== null);
  const withSpO2 = bodyEntries.filter((b) => b.spo2_pct !== null);

  if (withBP.length === 0 && withHR.length === 0 && withHRV.length === 0 && withSpO2.length === 0) {
    return '<p class="no-data">No vital signs recorded in this period.</p>';
  }

  let html = '<table><tr><th>Vital Sign</th><th>Latest</th><th>Average</th></tr>';

  if (withBP.length > 0) {
    const latest = withBP[withBP.length - 1];
    const avgSys = Math.round(withBP.reduce((s, b) => s + b.bp_systolic!, 0) / withBP.length);
    const avgDia = Math.round(withBP.reduce((s, b) => s + b.bp_diastolic!, 0) / withBP.length);
    html += `<tr><td>Blood Pressure</td><td>${latest.bp_systolic}/${latest.bp_diastolic} mmHg</td><td>${avgSys}/${avgDia} mmHg</td></tr>`;
  }

  if (withHR.length > 0) {
    const latest = withHR[withHR.length - 1];
    const avg = Math.round(withHR.reduce((s, b) => s + b.resting_hr!, 0) / withHR.length);
    html += `<tr><td>Resting Heart Rate</td><td>${latest.resting_hr} bpm</td><td>${avg} bpm</td></tr>`;
  }

  if (withHRV.length > 0) {
    const latest = withHRV[withHRV.length - 1];
    const avg = Math.round(withHRV.reduce((s, b) => s + b.hrv_ms!, 0) / withHRV.length);
    html += `<tr><td>Heart Rate Variability</td><td>${latest.hrv_ms} ms</td><td>${avg} ms</td></tr>`;
  }

  if (withSpO2.length > 0) {
    const latest = withSpO2[withSpO2.length - 1];
    const avg = Math.round((withSpO2.reduce((s, b) => s + b.spo2_pct!, 0) / withSpO2.length) * 10) / 10;
    html += `<tr><td>SpO2</td><td>${latest.spo2_pct}%</td><td>${avg}%</td></tr>`;
  }

  html += '</table>';
  return html;
}

async function buildBloodworkSection(dates: string[]): Promise<string> {
  // Find most recent bloodwork entry
  const entries: BloodworkEntry[] = [];
  for (const dateStr of dates) {
    const entry = await storageGet<BloodworkEntry>(dateKey(STORAGE_KEYS.LOG_BLOODWORK, dateStr));
    if (entry) entries.push(entry);
  }

  if (entries.length === 0) {
    return '<p class="no-data">No bloodwork data recorded in this period.</p>';
  }

  const latest = entries[entries.length - 1];
  let html = `<p class="footnote">Most recent panel: ${latest.date}${latest.lab_name ? ` (${latest.lab_name})` : ''}</p>`;
  html += '<table><tr><th>Marker</th><th>Value</th><th>Reference Range</th><th>Status</th></tr>';

  for (const marker of latest.markers) {
    const rangeStr = marker.reference_range_low !== null && marker.reference_range_high !== null
      ? `${marker.reference_range_low} - ${marker.reference_range_high} ${marker.unit}`
      : 'N/A';
    const status = marker.flagged ? '<span class="flagged">FLAGGED</span>' : 'Normal';
    html += `<tr><td>${marker.name}</td><td>${marker.value} ${marker.unit}</td><td>${rangeStr}</td><td>${status}</td></tr>`;
  }

  html += '</table>';
  html += '<p class="footnote">Bloodwork values are self-reported and have not been verified by a healthcare provider. Results should be confirmed against original laboratory reports.</p>';
  return html;
}

async function buildSupplementsSection(dates: string[]): Promise<string> {
  const allSupplements = new Map<string, { name: string; dosage: number; unit: string; category: string }>();

  for (const dateStr of dates) {
    const entries = await storageGet<SupplementEntry[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, dateStr));
    if (entries) {
      for (const entry of entries) {
        if (entry.category === 'supplement' || entry.category === 'vitamin') {
          allSupplements.set(entry.name, {
            name: entry.name,
            dosage: entry.dosage,
            unit: entry.unit,
            category: entry.category,
          });
        }
      }
    }
  }

  if (allSupplements.size === 0) {
    return '<p class="no-data">No supplements recorded in this period.</p>';
  }

  let html = '<table><tr><th>Supplement</th><th>Dosage</th><th>Category</th></tr>';
  for (const supp of allSupplements.values()) {
    html += `<tr><td>${supp.name}</td><td>${supp.dosage} ${supp.unit}</td><td>${supp.category}</td></tr>`;
  }
  html += '</table>';
  return html;
}

async function buildMedicationsSection(dates: string[]): Promise<string> {
  const allMeds = new Map<string, { name: string; dosage: number; unit: string }>();

  for (const dateStr of dates) {
    const entries = await storageGet<SupplementEntry[]>(dateKey(STORAGE_KEYS.LOG_SUPPLEMENTS, dateStr));
    if (entries) {
      for (const entry of entries) {
        if (entry.category === 'medication') {
          allMeds.set(entry.name, {
            name: entry.name,
            dosage: entry.dosage,
            unit: entry.unit,
          });
        }
      }
    }
  }

  if (allMeds.size === 0) {
    return '<p class="no-data">No medications recorded in this period.</p>';
  }

  let html = '<table><tr><th>Medication</th><th>Dosage</th></tr>';
  for (const med of allMeds.values()) {
    html += `<tr><td>${med.name}</td><td>${med.dosage} ${med.unit}</td></tr>`;
  }
  html += '</table>';
  return html;
}

async function buildInjurySection(dates: string[]): Promise<string> {
  const injuries: InjuryEntry[] = [];
  for (const dateStr of dates) {
    const entry = await storageGet<InjuryEntry | InjuryEntry[]>(dateKey(STORAGE_KEYS.LOG_INJURY, dateStr));
    if (entry) {
      if (Array.isArray(entry)) injuries.push(...entry);
      else injuries.push(entry);
    }
  }

  if (injuries.length === 0) {
    return '<p class="no-data">No injury data recorded in this period.</p>';
  }

  let html = '<table><tr><th>Location</th><th>Type</th><th>Severity</th><th>Onset</th><th>Status</th></tr>';
  for (const inj of injuries) {
    const status = inj.resolved_date ? `Resolved ${inj.resolved_date}` : 'Ongoing';
    html += `<tr><td>${inj.body_location}</td><td>${inj.type}</td><td>${inj.severity}/10</td><td>${inj.onset_date}</td><td>${status}</td></tr>`;
  }
  html += '</table>';
  return html;
}

async function buildWomensHealthSection(dates: string[]): Promise<string> {
  const entries: Array<CycleEntry & { date: string }> = [];
  for (const dateStr of dates) {
    const entry = await storageGet<CycleEntry>(dateKey(STORAGE_KEYS.LOG_CYCLE, dateStr));
    if (entry) entries.push({ ...entry, date: dateStr });
  }

  if (entries.length === 0) {
    return '<p class="no-data">No cycle data recorded in this period.</p>';
  }

  const periodDays = entries.filter((e) => e.flow_level !== null).length;
  const phases = entries.filter((e) => e.computed_phase !== null);

  let html = `
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Days Tracked</td><td>${entries.length}</td></tr>
      <tr><td>Period Days</td><td>${periodDays}</td></tr>
    </table>`;

  if (phases.length > 0) {
    const phaseCounts: Record<string, number> = {};
    for (const p of phases) {
      const phase = p.computed_phase!;
      phaseCounts[phase] = (phaseCounts[phase] ?? 0) + 1;
    }
    html += '<table><tr><th>Phase</th><th>Days</th></tr>';
    for (const [phase, count] of Object.entries(phaseCounts)) {
      html += `<tr><td>${phase.charAt(0).toUpperCase() + phase.slice(1)}</td><td>${count}</td></tr>`;
    }
    html += '</table>';
  }

  return html;
}

async function buildSubstanceSection(dates: string[]): Promise<string> {
  const entries: SubstanceEntry[] = [];
  for (const dateStr of dates) {
    const dayEntries = await storageGet<SubstanceEntry[]>(dateKey(STORAGE_KEYS.LOG_SUBSTANCES, dateStr));
    if (dayEntries) entries.push(...dayEntries);
  }

  if (entries.length === 0) {
    return '<p class="no-data">No substance use recorded in this period.</p>';
  }

  // Summarize by substance type
  const byType = new Map<string, { count: number; totalAmount: number; unit: string }>();
  for (const entry of entries) {
    const existing = byType.get(entry.substance) ?? { count: 0, totalAmount: 0, unit: entry.unit };
    existing.count += 1;
    existing.totalAmount += entry.amount;
    byType.set(entry.substance, existing);
  }

  let html = '<table><tr><th>Substance</th><th>Occurrences</th><th>Total Amount</th></tr>';
  for (const [substance, data] of byType) {
    html += `<tr><td>${substance.charAt(0).toUpperCase() + substance.slice(1)}</td><td>${data.count}</td><td>${data.totalAmount} ${data.unit}</td></tr>`;
  }
  html += '</table>';
  return html;
}

// ============================================================
// Mood Summary (statistics only, NO raw entries)
// ============================================================

function buildMoodSummary(summaries: DailySummary[]): string {
  const moodDays = summaries.filter((s) => s.mood_avg !== null);
  if (moodDays.length === 0) return '';

  const avgMood = (moodDays.reduce((s, d) => s + d.mood_avg!, 0) / moodDays.length).toFixed(1);
  return `
    <div class="mood-summary">
      <p><strong>Mood:</strong> Average ${avgMood}/5 over ${moodDays.length} days tracked.</p>
    </div>`;
}

// ============================================================
// PDF HTML Template
// ============================================================

function buildPDFHTML(
  profile: UserProfile | null,
  config: HealthReportConfig,
  sectionHTMLs: Map<HealthReportSection, string>,
  moodSummary: string,
): string {
  const patientName = profile?.name ?? 'Patient';
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let sectionsHTML = '';
  for (const section of config.sections) {
    const label = SECTION_LABELS[section];
    const content = sectionHTMLs.get(section) ?? '<p class="no-data">No data available.</p>';
    sectionsHTML += `
      <div class="section">
        <h2>${label}</h2>
        ${content}
      </div>`;
  }

  // Add mood summary statistics (NOT raw entries) if present
  if (moodSummary) {
    sectionsHTML += `
      <div class="section">
        <h2>Mood Overview</h2>
        ${moodSummary}
      </div>`;
  }

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
      font-size: 22pt;
      color: #1E2761;
      margin-bottom: 4px;
    }
    .header .subtitle {
      color: #666;
      font-size: 10pt;
    }
    .patient-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 4px;
    }
    .patient-info span {
      font-size: 10pt;
    }
    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 14pt;
      color: #1E2761;
      border-bottom: 1px solid #ddd;
      padding-bottom: 6px;
      margin-bottom: 12px;
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
    .flagged {
      color: #EF5350;
      font-weight: 600;
    }
    .no-data {
      color: #999;
      font-style: italic;
      padding: 8px 0;
    }
    .footnote {
      font-size: 9pt;
      color: #888;
      margin-top: 4px;
    }
    .mood-summary {
      padding: 8px 0;
    }
    .footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #999;
      text-align: center;
    }
    .disclaimer {
      margin-top: 24px;
      padding: 12px;
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
    <h1>DUB_AI Health Report</h1>
    <div class="subtitle">Confidential Patient Health Summary</div>
  </div>

  <div class="patient-info">
    <span><strong>Patient:</strong> ${patientName}</span>
    <span><strong>Date Range:</strong> ${formatDateReadable(config.dateRange.start)} - ${formatDateReadable(config.dateRange.end)}</span>
    <span><strong>Generated:</strong> ${generatedDate}</span>
  </div>

  ${sectionsHTML}

  <div class="disclaimer">
    <strong>Disclaimer:</strong> This report is generated from self-reported data entered by the user into
    the DUB_AI Tracker application. It has not been verified by a healthcare professional. This report
    is intended to supplement, not replace, a clinical evaluation. All data should be confirmed against
    original sources (laboratory reports, medical records) before making clinical decisions.
  </div>

  <div class="footer">
    Generated by DUB_AI Tracker | For healthcare provider use | Not a medical document
  </div>
</body>
</html>`;
}

// ============================================================
// Generate and Share PDF
// ============================================================

/**
 * Generate the Health Report PDF on-device and open share dialog.
 * CRITICAL: Therapy notes, raw mood/gratitude entries, and coach chat are NEVER included.
 */
export async function generateHealthReportPDF(
  config: HealthReportConfig,
): Promise<string> {
  const dates = getDaysInRange(config.dateRange.start, config.dateRange.end);
  const profile = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);

  // Gather common data
  const summaries = await gatherDailySummaries(dates);
  const bodyEntries = await gatherBodyEntries(dates);
  const sleepEntries = await gatherSleepEntries(dates);

  // Build section HTML
  const sectionHTMLs = new Map<HealthReportSection, string>();

  for (const section of config.sections) {
    switch (section) {
      case 'weight_body_composition':
        sectionHTMLs.set(section, buildWeightSection(summaries, bodyEntries));
        break;
      case 'nutrition':
        sectionHTMLs.set(section, buildNutritionSection(summaries));
        break;
      case 'exercise':
        sectionHTMLs.set(section, buildExerciseSection(summaries));
        break;
      case 'sleep':
        sectionHTMLs.set(section, buildSleepSection(sleepEntries));
        break;
      case 'vital_signs':
        sectionHTMLs.set(section, buildVitalSignsSection(bodyEntries));
        break;
      case 'bloodwork':
        sectionHTMLs.set(section, await buildBloodworkSection(dates));
        break;
      case 'supplements':
        sectionHTMLs.set(section, await buildSupplementsSection(dates));
        break;
      case 'medications':
        sectionHTMLs.set(section, await buildMedicationsSection(dates));
        break;
      case 'injury_pain':
        sectionHTMLs.set(section, await buildInjurySection(dates));
        break;
      case 'womens_health':
        sectionHTMLs.set(section, await buildWomensHealthSection(dates));
        break;
      case 'substance_use':
        sectionHTMLs.set(section, await buildSubstanceSection(dates));
        break;
    }
  }

  // Mood: summary statistics only, NEVER raw entries
  const moodSummary = buildMoodSummary(summaries);

  const html = buildPDFHTML(profile, config, sectionHTMLs, moodSummary);

  // Generate PDF using expo-print
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // Log audit event
  await logAuditEvent('HEALTH_REPORT_GENERATED', {
    sections: config.sections,
    date_range_start: config.dateRange.start,
    date_range_end: config.dateRange.end,
  });

  return uri;
}

/**
 * Generate PDF and open the system share dialog.
 */
export async function generateAndShareHealthReport(
  config: HealthReportConfig,
): Promise<void> {
  const uri = await generateHealthReportPDF(config);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Health Report',
      UTI: 'com.adobe.pdf',
    });
  }
}
