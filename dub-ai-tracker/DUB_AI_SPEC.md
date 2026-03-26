# DUB_AI TRACKER — COMPLETE PRODUCT SPECIFICATION

> **This file is the single source of truth for the entire app.**
> Claude Code: Read this file FIRST before building any phase.
> Build ONE phase at a time. Do NOT build ahead.
>
> **TO USE in Claude Code:**
> - `"Read DUB_AI_SPEC.md, then build Phase 2 only."`
> - For later phases: `"Read DUB_AI_SPEC.md, then build Phase [N] only."`

---

## PRODUCT IDENTITY

- **Name:** DUB_AI Tracker
- **Thesis:** This is an "I want to get better" app. Not social media. No ego. No leaderboards. No sharing. No badges. Private, data-driven accountability. The AI coach recognizes patterns and proactively surfaces insights. Every feature exists to help the user become healthier.
- **Tone:** Clinical expertise delivered with warmth — a world-class nutritionist and personal trainer who lives in your pocket.

---

## TECH STACK

- **Framework:** React Native + Expo (managed workflow with expo-dev-client)
- **Navigation:** Expo Router
- **Storage:** AsyncStorage (v1, no backend yet)
- **Language:** TypeScript strict mode, no `any` types
- **HealthKit:** react-native-health (iOS), react-native-health-connect (Android)
- **Dev Client:** expo-dev-client (NOT Expo Go — needed for HealthKit native modules)
- **Deployment:** EAS Build for App Store / Google Play
- **AI Model:** claude-sonnet-4-20250514 via Anthropic API

---

## BRAND

| Token | Value | Usage |
|-------|-------|-------|
| primaryBackground | `#1E2761` | Dark navy — all screens |
| accent | `#D4A843` | Gold — buttons, active tab, progress |
| text | `#FFFFFF` | White on dark |
| secondaryText | `#B0B0B0` | Light gray |
| success | `#4CAF50` | Green (80%+ goals) |
| warning | `#D4A843` | Gold (50-79% goals) |
| danger | `#E53935` | Red (below 50% goals) |
| cardBackground | `#2A3370` | Card surfaces |

**Aesthetic:** Bloomberg Terminal meets clinical wellness dashboard. Charts everywhere. Data is king.

---

## CRITICAL DESIGN RULES

1. EVERY log entry is timestamped with exact time of day (ISO 8601 with timezone).
2. NO social features. No sharing. No public profiles. No leaderboards. This is private.
3. NO gamification ego. No badges, no achievement unlocks. Streaks shown as data, not celebrated with confetti.
4. ALL tracking categories are elective "tags." Nothing is forced. What matters to one person may not matter to the next.
5. Notification copy is NEVER pushy, guilt-inducing, or shame-based.

---

## NAVIGATION

- Bottom tab bar, 5 tabs: **Dashboard | Log | Coach | Trends | Settings**
- Active: `#D4A843` (gold), Inactive: `#666666` (gray), Bar: `#1E2761` (navy)

---

## FOLDER STRUCTURE

```
src/
  components/    — Reusable UI components
  screens/       — Screen components for each tab/feature
  utils/         — Helper functions, calculations, formatters
  types/         — TypeScript type definitions
  hooks/         — Custom React hooks (useTagSystem, useProfile, etc.)
  services/      — API services (Anthropic, Strava, weather, etc.)
  constants/     — App constants, theme, config
  charts/        — Chart components and configs
  data/          — Exercise library JSON, product catalog JSON, tag registry
  ai/            — AI Coach prompt builder, pattern recognition engine
```

---

## ASYNC STORAGE KEY STRUCTURE

| Key | Pattern |
|-----|---------|
| profile | `@dubaitracker/profile` |
| tags | `@dubaitracker/tags` |
| logs | `@dubaitracker/logs/YYYY-MM-DD` |
| goals | `@dubaitracker/goals` |
| chat | `@dubaitracker/chat/YYYY-MM-DD` |
| settings | `@dubaitracker/settings` |
| correlations | `@dubaitracker/correlations` |
| exercises | `@dubaitracker/exercises` |
| therapy | `@dubaitracker/therapy` |
| bloodwork | `@dubaitracker/bloodwork` |
| measurements | `@dubaitracker/measurements` |
| progressPhotos | `@dubaitracker/progressphotos` |
| recovery | `@dubaitracker/recovery` |
| products | `@dubaitracker/products` |
| onboardingComplete | `@dubaitracker/onboarding-complete` |

---

## ONBOARDING FLOW

### Step 1: Profile
Fields: name, age, sex (male/female), height (ft/in or cm), current weight (lbs or kg), goal weight, activity level.

Activity levels:
- Sedentary (1.2)
- Lightly Active (1.375)
- Moderately Active (1.55)
- Active (1.725)
- Very Active (1.9)

### Step 2: Weight Goal
Options: Lose / Gain / Maintain
Rates: 0.5 / 1 / 1.5 / 2 lb/week
Calorie calc: Lose = TDEE - (rate x 500). Gain = TDEE + (rate x 500). Maintain = TDEE.
Warn if rate > 2 lb/week.

### Step 3: Structure Preference
- **Coach me hard** — All reminders on, detailed tracking, proactive AI nudges, end-of-day check-in, full analytics. Comprehensive default tags.
- **Keep it simple** — Minimal reminders, simplified logging, AI Coach available but not pushy. Basic default tags: water, food, workouts, weight, sleep.
- **I'll customize everything** — No defaults. Hand-pick every tag and notification.

### Step 4: Tag Selection
Browse tag library by category. Starter pack pre-selected based on structure preference. User toggles on/off.

### Step 5: Device Connections
One-tap buttons: Strava, Garmin, Apple Health/Google Health Connect. Skip available.

### Step 6: Notifications
Set end-of-day check-in time, morning reminder, water/vitamin/medication schedule. All electable, all skippable.

---

## TAG SYSTEM (THE CORE ARCHITECTURE)

Every trackable metric is a "tag." Users build their dashboard by enabling tags from a library. Tags can be added, removed, reordered, configured anytime.

**Tag type definition:**
```typescript
{
  id: string;
  name: string;
  category: string;
  type: 'counter' | 'checklist' | 'measurement' | 'timer' | 'journal' | 'exercise' | 'custom';
  unit: string;
  defaultGoal: number | null;
  icon: string;
  enabled: boolean;
  order: number;
}
```

### Hydration
- **Water** — counter, oz, goal: men 100oz / women 75oz
- **Coffee/Caffeine** — counter, mg caffeine

### Nutrition
- **Food Log** — journal, fields: meal name, calories, protein, carbs, fat, added sugars (g), fiber (g), sodium (mg), photo capture
- **Calorie Budget** — measurement, cal, goal: auto from TDEE
- **Protein Target** — measurement, g, goal: 1g per lb of goal weight
- **Added Sugar Target** — measurement, g, goal: men 36g / women 25g (WHO guidelines)
- **Intermittent Fasting** — timer, hours

### Food Intelligence System
**Thesis:** "Weight loss is math, not guessing. If you know exactly what goes in and exactly what goes out, the outcome is predictable."

**Food Logging Methods:**
1. BARCODE SCAN — scan any packaged food UPC, instant nutrition auto-populated
2. RESTAURANT SEARCH — search by restaurant name, browse menu, select item (Nutritionix: 202K+ restaurant items across 209K locations)
3. NATURAL LANGUAGE — type "grilled chicken breast 6oz with brown rice and broccoli," AI parses into individual items
4. PHOTO + AI VISION — photo of plate, AI estimates contents/calories (stub for v1)
5. RECIPE BUILDER — enter ingredients and quantities, calc total nutrition per serving
6. QUICK LOG — search food database by name, adjust serving size
7. FAVORITES/RECENT — one-tap re-log frequently eaten meals
8. MEAL TEMPLATES — save custom meals for instant re-logging

**Nutrition APIs:**
- Primary: FatSecret (2.3M+ foods, 90%+ barcode match)
- Secondary: Nutritionix (1.9M+ foods, 202K restaurant items, natural language)
- Free: USDA FoodData Central (300K+ foods, government-verified)
- Open Source: Open Food Facts (2.8M products, 150+ countries)

**Math Engine:**
- Weight change = (Calories In - Calories Out) / 3,500 lbs
- Weekly reconciliation: predicted vs actual weight change
- TDEE calibration: auto-suggest adjustment if predicted vs actual diverge 2+ weeks

### Fitness
- **Walks** — duration, distance, calories, elevation gain, avg HR, weather
- **Runs** — duration, distance, pace, calories, elevation gain, avg/max HR, weather
- **Cycling** — duration, distance, avg speed, elevation, HR, weather
- **Swimming** — duration, laps, stroke type, calories
- **Push-ups** — counter, reps, default goal 50
- **Pull-ups** — counter, reps
- **Steps** — counter, steps (manual or Apple Health/Google Health Connect)
- **Active Minutes** — counter, min (auto-calculated from activities)
- **Calories Burned** — measurement, cal (auto-calculated from activities + BMR)
- **Flexibility/Mobility** — duration, type, notes

### Strength Training
Preloaded 150+ gym exercises from free-exercise-db (public domain). Organized by muscle group.

Muscle groups: Chest, Back, Shoulders, Biceps, Triceps, Legs/Quads, Legs/Hamstrings, Glutes, Calves, Core, Full Body/Olympic

Logging flow:
1. User taps Workout > Strength
2. Search/browse exercise library by name or filter by muscle group/equipment
3. Per exercise: log WEIGHT (lbs/kg) x REPS x SETS (set by set)
4. Auto-calculate total volume (weight x reps across all sets)
5. Show previous performance ("Last time: 155lb x 8 x 3")
6. Track personal records per exercise
7. Rest timer between sets (configurable, default 90 seconds)
8. Add custom exercises
9. Timestamp each set

### Sexual Activity
- Duration (minutes), timestamp
- Calorie calc: MET 5.8 x body weight x duration
- Included in daily Calories Burned. Non-judgmental.

### Body
- **Body Weight** — lbs, trend line, 7-day moving average
- **Body Fat %** — percentage
- **Body Measurements** — waist, hips, chest, arms, thighs; waist-to-hip ratio auto-calculated; monthly reminders
- **Blood Pressure** — systolic, diastolic, timestamp
- **Resting Heart Rate** — bpm (manual or Apple Health)
- **HRV** — ms (Apple Health/Garmin/Oura). Critical recovery/stress indicator.
- **SpO2** — % (wearable)
- **BMR** — Mifflin-St Jeor, recalculated monthly from rolling 7-day avg weight
- **TDEE** — BMR x activity multiplier
- **Progress Photos** — monthly, encrypted, side-by-side comparison

### Weight Management

Goal types: Lose / Gain / Maintain

**Goal Philosophy Tiers:**
- **All In (100%)** — Zero tolerance. Every calorie counts. No cheat meals. Coach is direct, precise, calls out every deviation.
- **Disciplined (90/10)** — 90% on plan, 10% flexibility (~3 meals/month off-plan). Coach tracks weekly adherence %.
- **Lifestyle (80/20)** — 80% on plan. Coach focuses on trends and weekly averages, not daily perfection.

Settable in onboarding step 2 and changeable in Settings.

**Early Warning System:**
- Weight trending up 2+ weeks when goal is Lose > flag with calorie math
- Calorie intake 15%+ over target for 5+ days > alert
- Added sugar 50%+ over WHO limit for a week > top sources surfaced
- Workout frequency dropped 50%+ below baseline > check-in
- Sleep declining 5+ consecutive days > hormone impact warning
- Alcohol increasing 3+ weeks > non-judgmental data flag
- BP trending upward > suggest doctor visit

### Celebrations
Philosophy: Celebrate genuine progress with micro-moments of delight. NEVER fake enthusiasm. Celebrate RESULTS, not participation.

Examples: weight milestones (5-lb increments), new PRs, streak milestones (7/14/30/60/90/180/365 days at 80%+), first 100% day, health improvements (HR, HRV, BP, bloodwork), body composition changes, substance reduction.

Animations: Subtle gold shimmer, gentle pulse, smooth fill. NEVER confetti cannons or blocking pop-ups.

Every celebration includes a Coach message with SPECIFIC DATA.

### Recovery
Score: sleep quality (25%) + sleep duration vs goal (20%) + HRV vs baseline (20%) + resting HR vs baseline (15%) + training load (15%) + alcohol (5%). Scale 0-100.
Rest day intelligence: when score low or training load high 3+ days, suggest rest.

### Supplements
- **Vitamins** — checklist, interview-based setup with Amazon order links
- **Medications** — checklist, time schedule, push notification reminders
- **Supplements** — checklist (creatine, protein powder, collagen, etc.)

### Vitamin Interview
1. "What are your health goals?" (multi-select: general health, energy, immune, bone/joint, muscle recovery, sleep, skin/hair/nails, heart, cognitive, stress)
2. "Dietary restrictions?" (vegan, vegetarian, dairy-free, gluten-free, none)
3. Age and sex pre-filled from profile
4. "Currently taking any vitamins?" (free text or skip)
5. Generate personalized stack: name, dose, timing, why recommended
6. "Order on Amazon" button per vitamin (deep-link with Associates tag)
7. User accepts/rejects/modifies before adding to checklist
8. Re-run anytime from Settings

### Substances (tracked without judgment)
- **Alcohol** — drink count, type (beer/wine/liquor/cocktail/seltzer), standard units, timestamp per drink
- **Cannabis** — yes/no, method, notes, timestamp
- **Tobacco/Nicotine** — cigarette count / vape sessions / pouches, timestamp
- **Caffeine** — mg, timestamp

### Mental Wellness
- **Mood** — 1-10 with emoji, optional journal note, timestamped, multiple per day
- **Gratitude** — free-text, one per day
- **Meditation** — timer: duration, type (guided/unguided/breathwork)
- **Stress Level** — 1-10, timestamped, multiple per day
- **Therapy Sessions** — date/time, duration, therapist name, type (individual/couples/group/family), modality (CBT/DBT/EMDR/talk/other), pre-session mood (1-10), post-session mood (1-10), private journal note (encrypted), follow-up action items (checkable)

### Sleep
- Bedtime, Wake Time (manual or synced)
- Total Sleep Hours (default goal: 8)
- Sleep Quality (1-5 stars)
- Bathroom Trips (counter)
- Alarm Used (yes/no)
- Time to Fall Asleep (minutes)
- Sleep Notes (journal)
- Watch sync: pull sleep stages (awake/light/deep/REM), HR during sleep, HRV, SpO2

### Health Markers
- **Bloodwork** — cholesterol (total/HDL/LDL), triglycerides, A1C, fasting glucose, testosterone, vitamin D, B12, iron/ferritin, thyroid (TSH), CRP, IL-6. Periodic entries, trend charts.
- **DEXA Scan** — bone density, lean mass, fat mass

### Injury/Pain
- Body location, severity (1-10), type (sharp/dull/aching/burning), what aggravates, notes
- AI Coach factors into workout suggestions

### Women's Health
- Period start/end, flow (light/medium/heavy), symptoms
- Cycle phase tracking (menstrual/follicular/ovulatory/luteal) with auto-prediction
- AI Coach adapts nutrition and training by phase
- Fertility window (optional)

### Digestive Health
- Bristol Stool Scale (type 1-7 with visual guide), frequency per day, notes
- Correlate with food log, stress, hydration

### Custom Tags
Users create custom tags: name, unit, daily target, increment, icon, chart type (line/bar/counter), category.

---

## FEATURE: DASHBOARD (Tab 1)

**Top section:**
- Overall Daily Score — circular progress ring, green/gold/red
- Recovery Score (0-100)
- BMR/TDEE/Calorie Target summary
- Net Calories today (consumed minus burned)
- Streak counter (days at 80%+ — data, not celebration)

**Cards:** Show ONLY enabled tags. Each card: current value, daily goal, progress ring/bar, last log timestamp, quick-add button. Reorderable via drag-and-drop.

**Sparklines:** Mini 7-day sparkline on each card.

**Home Widget:** iOS/Android widget: today's score, water +8oz button, quick-log for most-used tags.

---

## FEATURE: AI COACH (Tab 3)

- **Model:** claude-sonnet-4-20250514
- **System Prompt:** You are Coach DUB, a world-class RD, NASM-CPT, CSCS, and behavioral wellness expert with 20 years of clinical experience. You have access to the user's complete logged data, trends, correlations, recovery score, and health markers. Direct, specific, reference actual numbers. Factor in time of day. Recognize patterns. Non-judgmental about substances but clinically accurate. Reference weight goals, BMR/TDEE, recovery score, bloodwork, injury/pain, menstrual cycle phase. Celebrate genuine progress with warmth. Honest when progress stalls. Keep responses to 2-3 concise paragraphs.

**Data injected per message:**
- Full day's logged data (all active tags, values, goals, %, timestamps)
- Last 7 days summary stats
- Current BMR, TDEE, calorie target, weight goal type/rate
- Recovery score and components
- Active correlation insights
- User profile
- Outstanding therapy action items
- Recent injury/pain logs
- Latest bloodwork values
- Menstrual cycle phase (if tracking)
- Structure preference

**Suggested prompts:** How am I doing today? | What should I eat next? | Quick workout suggestion | End of day review | Help me sleep better | Am I on track this week? | Analyze my workout | Recovery check

---

## FEATURE: PROACTIVE PATTERN RECOGNITION

Run on app open + end-of-day. Minimum 7 data points per side for correlations.

Example insights:
- "You've skipped workouts 3 days in a row — that's unusual for you."
- "Your added sugar averaged 48g/day this week (target: 36g)."
- "You sleep 47 min longer on days you don't drink alcohol."
- "Your mood averages 7.2 on workout days vs 5.1 on rest days."
- "Your bench press volume is up 15% this month."
- "Your resting HR dropped 4 bpm over 6 weeks."
- "Your post-therapy mood averages 2.3 points higher than pre-therapy."

Delivery: Insight cards in Coach tab + optional push notifications (max 2-3/day).

---

## FEATURE: PUSH NOTIFICATIONS (ALL ELECTABLE)

Library: Expo Notifications. ALL notifications electable. Nothing forced. Never pushy or shame-based.

Types: water reminders, meal window, vitamin/medication schedules, movement nudge, workout reminder, bedtime wind-down, morning weigh-in, end-of-day check-in, weekly summary (Sunday), monthly measurements, monthly photo, AI insight (max 3/day).

Structure defaults:
- Coach me hard: ALL ON
- Keep it simple: Only medication + end-of-day ON
- Customize: ALL OFF, build from scratch

---

## FEATURE: END-OF-DAY QUESTIONNAIRE

Trigger: Push notification at configured time (default 9 PM).
Behavior: Smart — ONLY asks about enabled-but-unlogged tags for that day.
Format: Swipeable cards. One question per screen. Big tap targets. Minimal typing.
After: Daily summary card with overall score + 1-2 sentence AI insight + optional journal entry.

---

## FEATURE: DEVICE INTEGRATIONS

- **Strava** — OAuth2, fields: duration, distance, pace, elevation, HR, calories, sport type, splits, weather
- **Garmin** — UI built, API stubbed
- **Apple Health** — react-native-health: steps, distance, flights, active cal, resting HR, HR samples, HRV, SpO2, sleep stages, sleep HR, workouts, weight, body fat %
- **Google Health Connect** — react-native-health-connect: same as Apple Health
- **Oura** — UI built, API stubbed: sleep stages, HRV, resting HR, SpO2, readiness, body temp
- **Weather** — OpenWeatherMap free tier, auto-fetch on outdoor activity via GPS, manual fallback
- **Instacart** — grocery ordering from AI Coach meal plans (Kroger, Costco, Safeway, Publix, 250K+ retailers)

---

## FEATURE: TRENDS (Tab 4) — 53 CHART TYPES

Chart library: victory-native or react-native-chart-kit
Style: Gold `#D4A843` primary data on navy. Animated. Scrollable/zoomable.
Time ranges: 7d, 30d, 90d, 6mo, 1yr, all

Categories: Dashboard heatmap/score trend, Weight/body/composition, Nutrition/macros/sugar, Strength volume/PRs/progression, Cardio elevation/HR/pace, Sleep consistency/quality/stages, Recovery score/HRV/HR, Substances (non-judgmental), Mental wellness mood/therapy/stress, Health markers with reference ranges, Women's health cycles, Correlations, Time-of-day histograms, Weekly/monthly/quarterly summaries.

---

## FEATURE: MARKETPLACE (1,000+ SKUs)

Revenue: Amazon Associates. All links use DUB_AI tag. 1-10% commission.
Disclosure on every product card.

Categories: Supplements (200+), Fitness Equipment (200+), Recovery (150+), Sleep (150+), Hydration/Kitchen (100+), Personal Care (100+), Women's Health (100+), Mindfulness (50+).

Contextual triggers: Products surface when AI Coach advice leads to them.

---

## FEATURE: GROCERY ORDERING

Primary: Instacart Developer API.
Flow: AI Coach generates meal plan > "Add to Instacart Cart" > user selects store.
Weekly meal prep: 7-day plan from macro targets > "Order All Ingredients" button.

---

## FEATURE: HEALTH REPORT (Share with Doctor)

PDF generated on-device. Sections: Patient summary, Vital trends with charts, Activity summary, Nutrition, Sleep, Medication adherence, Substance use (optional), Mental health, Bloodwork/labs, AI insights, Wellness compliance card.

Therapy journal notes NEVER included. User chooses what to share. FHIR R5 stub for v2/v3.

---

## FORMULAS

**BMR (Mifflin-St Jeor):**
- Men: (10 x weight_kg) + (6.25 x height_cm) - (5 x age) + 5
- Women: (10 x weight_kg) + (6.25 x height_cm) - (5 x age) - 161
- Recalculated monthly from rolling 7-day avg weight

**TDEE:** BMR x activity multiplier

**MET Values:** Walking 3.5, Running 8-12, Strength 3.5-6, Cycling 6-10, Swimming 6-8, Yoga 2.5-4, HIIT 8, Sex 5.8, Stretching 2.5

**Recovery Score:** sleep quality (25%) + sleep duration (20%) + HRV (20%) + resting HR (15%) + training load (15%) + alcohol (5%). Scale 0-100.

---

## BUILD PHASES (22 TOTAL)

### Phase 1: Foundation — COMPLETE
- Project setup: Expo + TypeScript + expo-dev-client + expo-router + AsyncStorage + expo-secure-store
- Folder structure: /src/components, screens, utils, types, hooks, services, constants, data, charts, ai
- Navigation: 5-tab bottom bar with placeholder screens
- Water Intake: fully functional (log +4/+8/+16oz, timestamps, undo, progress ring, AsyncStorage persistence)
- Dashboard: Overall Daily Score ring, Water card with progress bar

### Phase 2: Counters & Checklists
- Push-ups, Pull-ups (counter UI with +1/-1 buttons, daily goal, progress ring, timestamps, AsyncStorage)
- Vitamins (interview-based setup + Amazon affiliate links)
- Medications (checklist with time-based reminders)

### Phase 3: Food Logging
- Camera photo capture
- Manual calorie/macro/added sugar entry
- Meal log with timestamps

### Phase 4: Strength Training
- 150+ exercise library
- Set-by-set logging (weight x reps)
- Rest timer
- Previous performance display
- Volume calc
- PRs

### Phase 5: Cardio/Outdoor
- Walks, Runs, Cycling
- Elevation, HR, weather capture

### Phase 6: Sleep
- Bedtime/wake time
- Quality/bathroom/alarm
- Watch sync stub

### Phase 7: Goals
- Goal setting per tag
- Dashboard progress integration
- Weight management calorie calculator

### Phase 8: AI Coach
- Anthropic API chat
- Data injection per message
- Structure preference adaptation
- Suggested prompts

### Phase 9: Pattern Engine
- Correlation computation
- Anomaly detection
- Insight card generation

### Phase 10: Notifications
- All notification types
- Structure-based defaults
- Configurable times/frequencies

### Phase 11: End-of-Day
- Smart questionnaire
- Swipeable cards
- AI summary

### Phase 12: Trends
- All 53 chart types
- Calendar heatmap
- Time range selector
- Note: may be 2-3 sub-phases

### Phase 13: Marketplace
- 1,000+ SKU catalog JSON
- Contextual triggers
- Amazon deep links
- Marketplace browse UI

### Phase 14: Grocery
- Instacart API integration
- Meal plan ordering
- Amazon Fresh links

### Phase 15: Device Sync
- Strava OAuth
- Apple Health
- Google Health Connect

### Phase 16: Body Tracking
- Body measurements
- Progress photos (encrypted)
- Bloodwork logging

### Phase 17: Health Report
- PDF generator
- Section selector
- Wellness compliance card
- FHIR stub

### Phase 18: Therapy & Injury
- Therapy sessions
- Action items
- Injury/pain tracking
- Recovery score calc

### Phase 19: Remaining Tags
- Women's health
- Digestive health
- Sexual activity

### Phase 20: Substances
- Alcohol, cannabis, tobacco, caffeine tracking
- Trend charts

### Phase 21: Widget
- iOS/Android home screen widget

### Phase 22: Polish
- Settings completeness
- Encryption
- FHIR stub
- CSV export
- App PIN/biometric lock
- Final QA
