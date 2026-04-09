// Shareable workout summary card — Strava-style post-workout visual
// Task 22: Report Enhancements — shareable summary cards
//
// Uses expo-print to render an HTML card as an image, then expo-sharing
// to open the system share sheet. No react-native-view-shot dependency needed.

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { WorkoutEntry } from '../../types/workout';

interface WorkoutShareData {
  entry: WorkoutEntry;
  streakCount?: number;
}

function buildWorkoutCardHTML(data: WorkoutShareData): string {
  const { entry, streakCount } = data;
  const date = new Date(entry.timestamp);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const metrics: string[] = [];
  metrics.push(`<div class="metric"><span class="metric-value">${entry.duration_minutes}</span><span class="metric-label">min</span></div>`);

  if (entry.distance != null && entry.distance > 0) {
    metrics.push(`<div class="metric"><span class="metric-value">${entry.distance.toFixed(1)}</span><span class="metric-label">${entry.distance_unit ?? 'mi'}</span></div>`);
  }

  if (entry.biometric.avg_heart_rate_bpm != null) {
    metrics.push(`<div class="metric"><span class="metric-value">${entry.biometric.avg_heart_rate_bpm}</span><span class="metric-label">avg HR</span></div>`);
  }

  metrics.push(`<div class="metric"><span class="metric-value">${Math.round(entry.calories_burned)}</span><span class="metric-label">cal</span></div>`);

  if (entry.pack_weight_lbs != null && entry.pack_weight_lbs > 0) {
    metrics.push(`<div class="metric"><span class="metric-value">${entry.pack_weight_lbs}</span><span class="metric-label">lbs pack</span></div>`);
  }

  if (entry.push_count != null && entry.push_count > 0) {
    metrics.push(`<div class="metric"><span class="metric-value">${entry.push_count.toLocaleString()}</span><span class="metric-label">pushes</span></div>`);
  }

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
      background: linear-gradient(135deg, #0D0F1A 0%, #0D1133 100%);
      font-family: -apple-system, 'Helvetica Neue', sans-serif;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      padding: 80px;
    }
    .brand {
      font-size: 28px;
      font-weight: 700;
      color: #D4A843;
      letter-spacing: 2px;
      margin-bottom: 60px;
    }
    .activity-name {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    .date {
      font-size: 22px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 60px;
    }
    .metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 40px;
      flex: 1;
    }
    .metric {
      display: flex;
      flex-direction: column;
      min-width: 200px;
    }
    .metric-value {
      font-size: 64px;
      font-weight: 800;
      color: #D4A843;
      line-height: 1;
    }
    .metric-label {
      font-size: 20px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: auto;
    }
    .streak {
      font-size: 20px;
      color: #D4A843;
    }
    .powered {
      font-size: 16px;
      color: rgba(255,255,255,0.3);
    }
  </style>
</head>
<body>
  <div class="brand">DUB_AI</div>
  <div class="activity-name">${entry.activity_name}</div>
  <div class="date">${dateStr} at ${timeStr}</div>
  <div class="metrics">${metrics.join('')}</div>
  <div class="footer">
    ${streakCount && streakCount > 1 ? `<div class="streak">${streakCount}-day streak</div>` : '<div></div>'}
    <div class="powered">DUB_AI Tracker</div>
  </div>
</body>
</html>`;
}

/**
 * Generate a shareable workout summary card image and open the share sheet.
 */
export async function shareWorkoutSummary(data: WorkoutShareData): Promise<void> {
  const html = buildWorkoutCardHTML(data);

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
      dialogTitle: 'Share Workout',
    });
  }
}
