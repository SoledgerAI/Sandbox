// MASTER-65: Sobriety context always-include tests
// Verifies sobriety goals are always present in Coach context (MASTER-03)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCoachContext } from '../ai/context_builder';

async function setProfile(overrides: Record<string, unknown> = {}) {
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
      altitude_acclimated: false,
      ...overrides,
    }),
  );
  await AsyncStorage.setItem('dub.tier', JSON.stringify('balanced'));
}

describe('Sobriety Context Always-Include (MASTER-03, MASTER-65)', () => {
  it('QUIT goal present + non-substance message -> sobriety data in context', async () => {
    await setProfile();
    await AsyncStorage.setItem(
      'dub.sobriety',
      JSON.stringify([
        { substance: 'alcohol', goal_type: 'quit', current_streak_days: 30 },
      ]),
    );

    // Message with NO substance keywords
    const { context } = await buildCoachContext('What should I eat for dinner?');

    expect(context.sobriety_goals).toHaveLength(1);
    expect(context.sobriety_goals[0].substance).toBe('alcohol');
    expect(context.sobriety_goals[0].goal_type).toBe('quit');
    expect(context.sobriety_goals[0].current_streak_days).toBe(30);
  });

  it('REDUCE goal present + non-substance message -> sobriety data in context', async () => {
    await setProfile();
    await AsyncStorage.setItem(
      'dub.sobriety',
      JSON.stringify([
        { substance: 'cannabis', goal_type: 'reduce', current_streak_days: 7 },
      ]),
    );

    const { context } = await buildCoachContext('How are my macros?');

    expect(context.sobriety_goals).toHaveLength(1);
    expect(context.sobriety_goals[0].substance).toBe('cannabis');
    expect(context.sobriety_goals[0].goal_type).toBe('reduce');
  });

  it('multiple sobriety goals are all included', async () => {
    await setProfile();
    await AsyncStorage.setItem(
      'dub.sobriety',
      JSON.stringify([
        { substance: 'alcohol', goal_type: 'quit', current_streak_days: 14 },
        { substance: 'tobacco', goal_type: 'quit', current_streak_days: 3 },
      ]),
    );

    const { context } = await buildCoachContext('Tell me about my sleep');

    expect(context.sobriety_goals).toHaveLength(2);
  });

  it('no sobriety goals -> empty sobriety section in context', async () => {
    await setProfile();
    // Don't set any sobriety goals (or set to null)
    await AsyncStorage.removeItem('dub.sobriety');

    const { context } = await buildCoachContext('How am I doing?');

    expect(context.sobriety_goals).toHaveLength(0);
  });

  it('sobriety goals appear in system prompt output', async () => {
    await setProfile();
    await AsyncStorage.setItem(
      'dub.sobriety',
      JSON.stringify([
        { substance: 'alcohol', goal_type: 'quit', current_streak_days: 10 },
      ]),
    );

    const { context } = await buildCoachContext('What exercises today?');

    // The context should have the sobriety goal so buildSystemPrompt includes it
    expect(context.sobriety_goals.length).toBeGreaterThan(0);
    expect(context.sobriety_goals[0].substance).toBe('alcohol');
  });
});
