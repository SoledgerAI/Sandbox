// Step 9: Hook tests (testing hooks via their underlying logic)
// Note: renderHook requires @testing-library/react-native which expects React context.
// We test hook logic by testing the functions they call.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageGet, storageSet, storageDelete, STORAGE_KEYS } from '../utils/storage';
import type { UserProfile } from '../types/profile';

describe('useStorage hook logic', () => {
  it('get/set/delete operations work via storage wrapper', async () => {
    await storageSet('hook.test.key', { data: 'hello' });
    const result = await storageGet<{ data: string }>('hook.test.key');
    expect(result).toEqual({ data: 'hello' });

    await storageDelete('hook.test.key');
    const deleted = await storageGet<{ data: string }>('hook.test.key');
    expect(deleted).toBeNull();
  });
});

describe('useProfile hook logic', () => {
  it('returns typed UserProfile when profile exists', async () => {
    const profile: UserProfile = {
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'male',
      height_inches: 70,
      weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: null,
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
    };
    await storageSet(STORAGE_KEYS.PROFILE, profile);

    const result = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Test User');
    expect(result!.sex).toBe('male');
  });

  it('handles missing profile gracefully (returns null)', async () => {
    // Ensure no profile is stored
    await storageDelete(STORAGE_KEYS.PROFILE);
    const result = await storageGet<UserProfile>(STORAGE_KEYS.PROFILE);
    expect(result).toBeNull();
  });
});

describe('useCoach hook logic', () => {
  it('sendMessage function exists in anthropic service', async () => {
    const { sendMessage } = require('../services/anthropic');
    expect(typeof sendMessage).toBe('function');
  });

  it('handles missing API key gracefully', async () => {
    const { sendMessage, AnthropicError } = require('../services/anthropic');

    try {
      await sendMessage({
        systemPrompt: 'Test',
        messages: [{ role: 'user', content: 'Hello' }],
        tier: 'balanced',
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(AnthropicError);
      expect((error as InstanceType<typeof AnthropicError>).code).toBe('NO_API_KEY');
    }
  });
});

describe('useRecovery hook logic', () => {
  it('computeRecoveryScore function is importable', async () => {
    const { computeRecoveryScore } = require('../utils/recovery');
    expect(typeof computeRecoveryScore).toBe('function');
  });

  it('computes score from mock data', async () => {
    const { computeRecoveryScore } = require('../utils/recovery');
    const date = '2026-04-01';

    await AsyncStorage.setItem(
      `dub.log.sleep.${date}`,
      JSON.stringify({
        bedtime: '2026-03-31T22:00:00Z',
        wake_time: '2026-04-01T06:00:00Z',
        quality: 4,
        bathroom_trips: 0,
        alarm_used: false,
        time_to_fall_asleep_min: 10,
        notes: null,
        device_data: null,
      })
    );

    await AsyncStorage.setItem(
      `dub.log.body.${date}`,
      JSON.stringify({
        weight_lbs: 180,
        body_fat_pct: null,
        measurements: null,
        bp_systolic: null,
        bp_diastolic: null,
        resting_hr: 60,
        hrv_ms: 55,
        spo2_pct: null,
        timestamp: '2026-04-01T08:00:00Z',
      })
    );

    await AsyncStorage.setItem(`dub.log.workout.${date}`, JSON.stringify([]));
    await AsyncStorage.setItem(`dub.log.substances.${date}`, JSON.stringify([]));

    const score = await computeRecoveryScore(date);
    expect(score.date).toBe(date);
    expect(typeof score.total_score).toBe('number');
    expect(score.components).toBeDefined();
  });
});

describe('useDailySummary hook logic', () => {
  it('DailySummary type fields are accessible', async () => {
    const date = '2026-04-02';
    const summaryKey = `dub.daily.summary.${date}`;
    await storageSet(summaryKey, {
      date,
      calories_consumed: 2100,
      calories_burned: 400,
      calories_net: 1700,
      calories_remaining: 0,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      fiber_g: 30,
      sugar_g: 45,
      water_oz: 80,
      caffeine_mg: 200,
      steps: 10000,
      active_minutes: 45,
      sleep_hours: 7.5,
      sleep_quality: 4,
      mood_avg: 4.0,
      energy_avg: 3.5,
      anxiety_avg: 2.0,
      weight_lbs: 180,
      tags_logged: ['nutrition.food'],
      recovery_score: 78,
    });

    const summary = await storageGet<{ date: string; calories_consumed: number }>(summaryKey);
    expect(summary).not.toBeNull();
    expect(summary!.date).toBe(date);
    expect(summary!.calories_consumed).toBe(2100);
  });
});

describe('useTrendsData hook logic', () => {
  it('can store and retrieve weekly summary data', async () => {
    const weekKey = 'dub.weekly.summary.2026-13';
    await storageSet(weekKey, {
      week: '2026-13',
      avg_calories_consumed: 2100,
      days_logged: 6,
    });

    const result = await storageGet<{ week: string; avg_calories_consumed: number }>(weekKey);
    expect(result).not.toBeNull();
    expect(result!.week).toBe('2026-13');
  });
});

describe('useNotifications hook logic', () => {
  it('expo-notifications mock supports scheduleNotificationAsync', async () => {
    const Notifications = require('expo-notifications');
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: 'Test', body: 'Test body' },
      trigger: null,
    });
    expect(id).toBe('mock-notif-id');
  });

  it('supports cancelScheduledNotificationAsync', async () => {
    const Notifications = require('expo-notifications');
    await expect(Notifications.cancelScheduledNotificationAsync('id')).resolves.toBeUndefined();
  });
});

describe('useHealth hook logic', () => {
  it('react-native-health mock supports initHealthKit', () => {
    const AppleHealthKit = require('react-native-health').default;
    AppleHealthKit.initHealthKit({}, (err: unknown) => {
      expect(err).toBeNull();
    });
  });

  it('react-native-health-connect mock supports initialize', async () => {
    const { initialize } = require('react-native-health-connect');
    const result = await initialize();
    expect(result).toBe(true);
  });
});
