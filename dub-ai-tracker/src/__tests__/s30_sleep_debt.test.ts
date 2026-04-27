// Sprint 30: tests for sleep_debt context flags computed by buildCoachContext.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCoachContext } from '../ai/context_builder';
import { storageSet, STORAGE_KEYS, dateKey } from '../utils/storage';

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function seedProfile() {
  await AsyncStorage.setItem(
    'dub.profile',
    JSON.stringify({
      name: 'Test User',
      dob: '1994-06-15',
      units: 'imperial',
      sex: 'male',
      height_inches: 70,
      weight_lbs: 180,
      activity_level: 'moderately_active',
      goal: { direction: 'MAINTAIN', target_weight: null, rate_lbs_per_week: null, gain_type: null, surplus_calories: null },
      pronouns: null,
      metabolic_profile: null,
      main_goal: null,
      altitude_acclimated: false,
    }),
  );
  await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));
}

async function seedSleepDay(daysAgo: number, hours: number) {
  await storageSet(dateKey(STORAGE_KEYS.LOG_SLEEP, pastDate(daysAgo)), {
    bedtime: null,
    wake_time: null,
    quality: null,
    bathroom_trips: null,
    alarm_used: null,
    time_to_fall_asleep_min: null,
    notes: null,
    device_data: null,
    source: 'manual',
    total_duration_hours: hours,
    wake_ups: null,
    disturbances: [],
    sleep_aids_used: [],
    nap: false,
  });
}

beforeEach(async () => {
  // @ts-expect-error global jest setup map
  global.__mockStore.clear();
});

describe('sleep_debt_3d', () => {
  it('is undefined when fewer than 2 of last 3 days have data', async () => {
    await seedProfile();
    await seedSleepDay(1, 6); // only 1 day in last 3
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_3d).toBeUndefined();
  });

  it('is true when 3 days avg 6h vs 8h target', async () => {
    await seedProfile();
    await seedSleepDay(1, 6);
    await seedSleepDay(2, 6);
    await seedSleepDay(3, 6);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_target_hours).toBe(8);
    expect(context.sleep_debt_3d).toBe(true);
  });

  it('is false when 3 days avg 7.5h vs 8h target (within 1h margin)', async () => {
    await seedProfile();
    await seedSleepDay(1, 7.5);
    await seedSleepDay(2, 7.5);
    await seedSleepDay(3, 7.5);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_3d).toBe(false);
  });

  it('fires when only 2 of last 3 days have data and avg is below threshold', async () => {
    await seedProfile();
    await seedSleepDay(1, 5);
    await seedSleepDay(2, 5);
    // day 3: missing
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_3d).toBe(true);
  });
});

describe('sleep_debt_7d', () => {
  it('is undefined when fewer than 4 of last 7 days have data', async () => {
    await seedProfile();
    await seedSleepDay(1, 5);
    await seedSleepDay(3, 5);
    await seedSleepDay(5, 5);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_7d).toBeUndefined();
  });

  it('is true when 4+ days avg under target - 1h', async () => {
    await seedProfile();
    await seedSleepDay(1, 5);
    await seedSleepDay(2, 5);
    await seedSleepDay(3, 6);
    await seedSleepDay(4, 6);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_7d).toBe(true);
  });

  it('is false when 4+ days avg above the threshold', async () => {
    await seedProfile();
    await seedSleepDay(1, 7.5);
    await seedSleepDay(2, 7.5);
    await seedSleepDay(3, 8);
    await seedSleepDay(4, 8);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_debt_7d).toBe(false);
  });
});

describe('Sleep target derivation flows through to debt flags', () => {
  it('uses derived target (7.5h) when schedule is configured', async () => {
    await seedProfile();
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '22:30',
      target_wake_time: '06:00',
    });
    // 6h average vs 7.5h target = 1.5h gap → debt
    await seedSleepDay(1, 6);
    await seedSleepDay(2, 6);
    await seedSleepDay(3, 6);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_target_hours).toBe(7.5);
    expect(context.sleep_debt_3d).toBe(true);
  });

  it('does not flag debt when target lowers (e.g. 7h target with 6.5h actual)', async () => {
    await seedProfile();
    await storageSet(STORAGE_KEYS.SETTINGS_SLEEP_SCHEDULE, {
      target_bedtime: '23:00',
      target_wake_time: '06:00',
    });
    await seedSleepDay(1, 6.5);
    await seedSleepDay(2, 6.5);
    await seedSleepDay(3, 6.5);
    const { context } = await buildCoachContext('hello');
    expect(context.sleep_target_hours).toBe(7);
    // 6.5 vs 7 = 0.5h gap, less than the 1h debt threshold
    expect(context.sleep_debt_3d).toBe(false);
  });
});

describe('[SLEEP DEBT] prompt section', () => {
  it('appears in conditionalSections when 3d flag is true', async () => {
    await seedProfile();
    await seedSleepDay(1, 5);
    await seedSleepDay(2, 5);
    await seedSleepDay(3, 5);
    const { conditionalSections } = await buildCoachContext('hello');
    const debt = conditionalSections.find((s) => s.startsWith('[SLEEP DEBT]'));
    expect(debt).toBeDefined();
    expect(debt).toContain('Target: 8h/night');
    expect(debt).toMatch(/Last 3 days averaged/);
  });

  it('is omitted when both flags are undefined', async () => {
    await seedProfile();
    await seedSleepDay(1, 7);
    // only 1 day → both flags undefined
    const { conditionalSections } = await buildCoachContext('hello');
    expect(conditionalSections.find((s) => s.startsWith('[SLEEP DEBT]'))).toBeUndefined();
  });

  it('is omitted when both flags are false', async () => {
    await seedProfile();
    await seedSleepDay(1, 8);
    await seedSleepDay(2, 8);
    await seedSleepDay(3, 8);
    await seedSleepDay(4, 8);
    const { conditionalSections } = await buildCoachContext('hello');
    expect(conditionalSections.find((s) => s.startsWith('[SLEEP DEBT]'))).toBeUndefined();
  });
});
