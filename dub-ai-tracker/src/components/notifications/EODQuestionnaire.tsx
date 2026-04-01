// Swipeable End-of-Day Questionnaire
// Phase 15: EOD Questionnaire and Notifications

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { NotificationCard, SummaryCard } from './NotificationCard';
import { sendMessage, hasApiKey } from '../../services/anthropic';
import { buildCoachContext } from '../../ai/context_builder';
import { buildSystemPrompt } from '../../ai/coach_system_prompt';
import { storageGet, STORAGE_KEYS, dateKey } from '../../utils/storage';
import type { FoodEntry, WaterEntry } from '../../types';
import type { WorkoutEntry } from '../../types/workout';
import { calculateBmr, calculateTdee, calculateCalorieTarget, computeAge, lbsToKg, inchesToCm } from '../../utils/calories';
import type { UserProfile } from '../../types/profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

// MASTER-58: Generate a template-based EOD summary without AI
async function generateTemplateSummary(): Promise<string> {
  const today = formatDate(new Date());

  const [foods, waters, workouts, profile] = await Promise.all([
    storageGet<FoodEntry[]>(dateKey(STORAGE_KEYS.LOG_FOOD, today)),
    storageGet<WaterEntry[]>(dateKey(STORAGE_KEYS.LOG_WATER, today)),
    storageGet<WorkoutEntry[]>(dateKey(STORAGE_KEYS.LOG_WORKOUT, today)),
    storageGet<Partial<UserProfile>>(STORAGE_KEYS.PROFILE),
  ]);

  const foodArr = foods ?? [];
  const waterArr = waters ?? [];
  const workoutArr = workouts ?? [];

  const calories = foodArr.reduce((s, f) => s + (f.computed_nutrition?.calories ?? 0), 0);
  const protein = foodArr.reduce((s, f) => s + (f.computed_nutrition?.protein_g ?? 0), 0);
  const waterOz = waterArr.reduce((s, w) => s + w.amount_oz, 0);
  const activeMins = workoutArr.reduce((s, w) => s + (w.duration_minutes ?? 0), 0);

  // Calculate calorie target if profile complete
  let calorieTarget = 0;
  if (profile?.weight_lbs && profile?.height_inches && profile?.dob && profile?.sex) {
    const age = computeAge(profile.dob);
    const bmr = calculateBmr({
      weightKg: lbsToKg(profile.weight_lbs),
      heightCm: inchesToCm(profile.height_inches),
      ageYears: age,
      sex: profile.sex,
    });
    const tdee = calculateTdee(bmr, profile.activity_level ?? 'lightly_active');
    calorieTarget = calculateCalorieTarget({
      tdee,
      goalDirection: profile.goal?.direction ?? 'MAINTAIN',
      sex: profile.sex,
      rateLbsPerWeek: profile.goal?.rate_lbs_per_week ?? undefined,
      surplusCalories: profile.goal?.surplus_calories ?? undefined,
    });
  }

  const parts: string[] = [];

  if (calories > 0) {
    const calStr = `You logged ${Math.round(calories).toLocaleString()} cal`;
    if (calorieTarget > 0) {
      const pct = Math.round((calories / calorieTarget) * 100);
      parts.push(`${calStr} (${pct}% of ${Math.round(calorieTarget)} target).`);
    } else {
      parts.push(`${calStr} today.`);
    }
  } else {
    parts.push('No food was logged today.');
  }

  if (protein > 0) parts.push(`Protein: ${Math.round(protein)}g.`);
  if (waterOz > 0) parts.push(`Water: ${waterOz} oz.`);
  if (activeMins > 0) parts.push(`Active: ${activeMins} min across ${workoutArr.length} workout${workoutArr.length !== 1 ? 's' : ''}.`);

  // Encouraging closer
  if (calories > 0 && waterOz > 0 && activeMins > 0) {
    parts.push('Solid day — you hit nutrition, hydration, and movement. Keep it up!');
  } else if (calories > 0) {
    parts.push('Good logging today. Try to track water and activity too for a fuller picture.');
  } else {
    parts.push('Tomorrow is a fresh start. Even logging one meal helps build the habit.');
  }

  return parts.join(' ');
}

interface EODQuestionnaireProps {
  unloggedTags: string[];
  onDismiss: () => void;
  onRefresh: () => Promise<void>;
}

export function EODQuestionnaire({ unloggedTags, onDismiss, onRefresh }: EODQuestionnaireProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedTags, setCompletedTags] = useState<Set<string>>(new Set());
  const [skippedTags, setSkippedTags] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showingSummary, setShowingSummary] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const todayStr = formatDate(new Date());

  // Total cards = unlogged tags + 1 summary card
  const totalCards = unloggedTags.length + 1;

  // Animate card transition
  const animateToNext = useCallback(() => {
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= unloggedTags.length) {
          setShowingSummary(true);
        }
        return next;
      });
    });
  }, [translateX, unloggedTags.length]);

  const animateToPrev = useCallback(() => {
    if (currentIndex <= 0) return;
    Animated.timing(translateX, {
      toValue: SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      translateX.setValue(0);
      setCurrentIndex((prev) => Math.max(0, prev - 1));
      setShowingSummary(false);
    });
  }, [translateX, currentIndex]);

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 10 && Math.abs(gesture.dy) < 50;
      },
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_THRESHOLD) {
          // Swipe left -> next
          animateToNext();
        } else if (gesture.dx > SWIPE_THRESHOLD && currentIndex > 0) {
          // Swipe right -> prev
          animateToPrev();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // Generate AI summary when reaching summary card
  useEffect(() => {
    if (!showingSummary || summary !== null) return;

    let cancelled = false;

    async function generateSummary() {
      const apiKeyExists = await hasApiKey();

      if (!apiKeyExists) {
        // MASTER-58: Template-based summary (no API needed)
        if (!cancelled) setSummaryLoading(true);
        try {
          const templateSummary = await generateTemplateSummary();
          if (!cancelled) setSummary(templateSummary);
        } catch {
          if (!cancelled) setSummary('Could not load today\'s data for summary.');
        } finally {
          if (!cancelled) setSummaryLoading(false);
        }
        return;
      }

      setSummaryLoading(true);
      try {
        const { context, conditionalSections } = await buildCoachContext(
          'Generate my end-of-day summary',
        );
        const systemPrompt = buildSystemPrompt(context, conditionalSections);

        const responseText = await sendMessage({
          systemPrompt,
          messages: [
            {
              role: 'user',
              content:
                'Generate a brief end-of-day summary of my logged data today. ' +
                'Highlight what went well, note anything I missed, and give one ' +
                'actionable suggestion for tomorrow. Keep it under 150 words. ' +
                'Be encouraging — no shaming.',
            },
          ],
          tier: context.tier,
        });

        if (!cancelled) setSummary(responseText);
      } catch {
        if (!cancelled) setSummary('Could not generate summary. Check your connection or API key.');
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    generateSummary();
    return () => { cancelled = true; };
  }, [showingSummary, summary]);

  const handleComplete = useCallback(
    (tagId: string) => {
      setCompletedTags((prev) => new Set(prev).add(tagId));
      onRefresh();
      // Auto-advance after a brief pause
      setTimeout(() => animateToNext(), 300);
    },
    [animateToNext, onRefresh],
  );

  const handleSkip = useCallback(
    (tagId: string) => {
      setSkippedTags((prev) => new Set(prev).add(tagId));
      animateToNext();
    },
    [animateToNext],
  );

  const handleDismiss = useCallback(() => {
    onRefresh();
    onDismiss();
  }, [onDismiss, onRefresh]);

  const progressPct = Math.min(100, ((currentIndex + 1) / totalCards) * 100);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Evening Check-in</Text>
        <Text style={styles.headerCount}>
          {Math.min(currentIndex + 1, totalCards)} / {totalCards}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
      </View>

      {/* Card area */}
      <Animated.View
        style={[styles.cardArea, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {showingSummary || currentIndex >= unloggedTags.length ? (
          <SummaryCard
            summary={summary}
            loading={summaryLoading}
            onDismiss={handleDismiss}
          />
        ) : (
          <NotificationCard
            tagId={unloggedTags[currentIndex]}
            todayStr={todayStr}
            onComplete={handleComplete}
            onSkip={handleSkip}
          />
        )}
      </Animated.View>

      {/* Navigation dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: totalCards }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentIndex && styles.dotActive,
              i < currentIndex && completedTags.has(unloggedTags[i])
                ? styles.dotCompleted
                : undefined,
              i < currentIndex && skippedTags.has(unloggedTags[i])
                ? styles.dotSkipped
                : undefined,
            ]}
          />
        ))}
      </View>

      {/* Swipe hint */}
      {currentIndex === 0 && unloggedTags.length > 1 && (
        <Text style={styles.swipeHint}>Swipe left to skip, or use the buttons above</Text>
      )}
    </View>
  );
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryBackground,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  closeButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
  },
  headerCount: {
    color: Colors.secondaryText,
    fontSize: 14,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.divider,
  },
  dotActive: {
    backgroundColor: Colors.accent,
    width: 20,
  },
  dotCompleted: {
    backgroundColor: Colors.success,
  },
  dotSkipped: {
    backgroundColor: Colors.secondaryText,
  },
  swipeHint: {
    color: Colors.secondaryText,
    fontSize: 12,
    textAlign: 'center',
    paddingBottom: 24,
  },
});
