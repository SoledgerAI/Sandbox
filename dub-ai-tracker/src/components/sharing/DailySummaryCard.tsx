// Shareable daily summary card — full-day health overview
// Task 22: Report Enhancements — shareable summary cards

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { DailySummary } from '../../types';

interface DailyShareData {
  summary: DailySummary;
  calorieTarget: number;
  proteinTarget: number;
  streakCount?: number;
}

function buildDailySummaryHTML(data: DailyShareData): string {
  const { summary, calorieTarget, proteinTarget, streakCount } = data;
  const dateStr = new Date(summary.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Daily score: use recovery_score if available, otherwise a simple completion metric
  const dailyScore = summary.recovery_score ?? Math.min(
    100,
    Math.round(
      (summary.calories_consumed > 0 ? 25 : 0) +
      (summary.water_oz > 0 ? 25 : 0) +
      (summary.active_minutes > 0 ? 25 : 0) +
      (summary.sleep_hours != null && summary.sleep_hours > 0 ? 25 : 0),
    ),
  );

  const items = [
    { label: 'Calories', value: `${Math.round(summary.calories_consumed)}`, sub: calorieTarget > 0 ? `/ ${calorieTarget}` : '' },
    { label: 'Protein', value: `${Math.round(summary.protein_g)}g`, sub: proteinTarget > 0 ? `/ ${proteinTarget}g` : '' },
    { label: 'Activity', value: `${summary.active_minutes}`, sub: 'min' },
    { label: 'Sleep', value: summary.sleep_hours != null ? `${summary.sleep_hours.toFixed(1)}` : '--', sub: 'hrs' },
    { label: 'Water', value: `${Math.round(summary.water_oz)}`, sub: 'oz' },
  ];

  const metricsHTML = items.map(
    (m) => `<div class="metric"><div class="metric-label">${m.label}</div><div class="metric-value">${m.value} <span class="metric-sub">${m.sub}</span></div></div>`,
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px;
      height: 1080px;
      background: linear-gradient(135deg, #1E2761 0%, #0D1133 100%);
      font-family: -apple-system, 'Helvetica Neue', sans-serif;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      padding: 80px;
    }
    .brand { font-size: 28px; font-weight: 700; color: #D4A843; letter-spacing: 2px; margin-bottom: 40px; }
    .date { font-size: 28px; color: rgba(255,255,255,0.6); margin-bottom: 40px; }
    .score-ring {
      width: 240px; height: 240px; border-radius: 120px;
      border: 12px solid #D4A843; display: flex; flex-direction: column;
      align-items: center; justify-content: center; margin: 0 auto 40px auto;
    }
    .score-value { font-size: 72px; font-weight: 800; color: #D4A843; }
    .score-label { font-size: 18px; color: rgba(255,255,255,0.5); }
    .metrics { display: flex; flex-wrap: wrap; gap: 24px; margin-top: 20px; }
    .metric {
      flex: 1; min-width: 180px; background: rgba(255,255,255,0.08);
      border-radius: 16px; padding: 20px;
    }
    .metric-label { font-size: 14px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .metric-value { font-size: 32px; font-weight: 700; color: #FFFFFF; }
    .metric-sub { font-size: 18px; color: rgba(255,255,255,0.4); }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto; }
    .streak { font-size: 20px; color: #D4A843; }
    .powered { font-size: 16px; color: rgba(255,255,255,0.3); }
  </style>
</head>
<body>
  <div class="brand">DUB_AI</div>
  <div class="date">${dateStr}</div>
  <div class="score-ring">
    <div class="score-value">${dailyScore}</div>
    <div class="score-label">Daily Score</div>
  </div>
  <div class="metrics">${metricsHTML}</div>
  <div class="footer">
    ${streakCount && streakCount > 1 ? `<div class="streak">${streakCount}-day streak</div>` : '<div></div>'}
    <div class="powered">DUB_AI Tracker</div>
  </div>
</body>
</html>`;
}

/**
 * Generate a shareable daily summary card and open the share sheet.
 */
export async function shareDailySummary(data: DailyShareData): Promise<void> {
  const html = buildDailySummaryHTML(data);

  const { uri } = await Print.printToFileAsync({
    html,
    width: 1080,
    height: 1080,
    base64: false,
  });

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Day Summary',
    });
  }
}
