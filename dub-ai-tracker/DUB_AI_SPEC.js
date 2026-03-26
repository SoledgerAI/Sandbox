/**
 * DUB_AI TRACKER — COMPLETE PRODUCT SPECIFICATION
 * ================================================
 * This file is the single source of truth for the entire app.
 * Claude Code: Read this file FIRST before building any phase.
 * Build ONE phase at a time. Do NOT build ahead.
 *
 * TO USE: In Claude Code, say:
 *   "Read the file DUB_AI_SPEC.js in the project root, then build Phase 1 only."
 *   For later phases: "Read DUB_AI_SPEC.js, then build Phase 2 only."
 */
const DUB_AI_SPEC = {
  // ─────────────────────────────────────────────
  // PRODUCT IDENTITY
  // ─────────────────────────────────────────────
  name: "DUB_AI Tracker",
  thesis: "This is an 'I want to get better' app. Not social media. No ego. No leaderboards. No sharing. No badges. Private, data-driven accountability. The AI coach recognizes patterns and proactively surfaces insights. Every feature exists to help the user become healthier.",
  tone: "Clinical expertise delivered with warmth — a world-class nutritionist and personal trainer who lives in your pocket.",
  // ─────────────────────────────────────────────
  // TECH STACK
  // ─────────────────────────────────────────────
  techStack: {
    framework: "React Native + Expo (managed workflow with expo-dev-client)",
    navigation: "Expo Router",
    storage: "AsyncStorage (v1, no backend yet)",
    language: "TypeScript strict mode, no 'any' types",
    healthKit: "react-native-health (iOS), react-native-health-connect (Android)",
    devClient: "expo-dev-client (NOT Expo Go — needed for HealthKit native modules)",
    deployment: "EAS Build for App Store / Google Play",
    aiModel: "claude-sonnet-4-20250514 via Anthropic API",
  },
  // ─────────────────────────────────────────────
  // BRAND
  // ─────────────────────────────────────────────
  brand: {
    primaryBackground: "#1E2761",
    accent: "#D4A843",
    text: "#FFFFFF",
    secondaryText: "#B0B0B0",
    success: "#4CAF50",
    warning: "#D4A843",
    danger: "#E53935",
    aesthetic: "Bloomberg Terminal meets clinical wellness dashboard. Charts everywhere. Data is king.",
  },
  // ─────────────────────────────────────────────
  // CRITICAL DESIGN RULES
  // ─────────────────────────────────────────────
  designRules: [
    "EVERY log entry is timestamped with exact time of day (ISO 8601 with timezone).",
    "NO social features. No sharing. No public profiles. No leaderboards. This is private.",
    "NO gamification ego. No badges, no achievement unlocks. Streaks shown as data, not celebrated with confetti.",
    "ALL tracking categories are elective 'tags'. Nothing is forced. What matters to one person may not matter to the next.",
    "Notification copy is NEVER pushy, guilt-inducing, or shame-based.",
  ],
  // ─────────────────────────────────────────────
  // NAVIGATION
  // ─────────────────────────────────────────────
  navigation: {
    type: "Bottom tab bar, 5 tabs",
    tabs: ["Dashboard", "Log", "Coach", "Trends", "Settings"],
    activeColor: "#D4A843",
    inactiveColor: "#666666",
    barBackground: "#1E2761",
  },
  // ─────────────────────────────────────────────
  // FOLDER STRUCTURE
  // ─────────────────────────────────────────────
  folderStructure: {
    src: {
      components: "Reusable UI components",
      screens: "Screen components for each tab/feature",
      utils: "Helper functions, calculations, formatters",
      types: "TypeScript type definitions",
      hooks: "Custom React hooks (useTagSystem, useProfile, etc.)",
      services: "API services (Anthropic, Strava, weather, etc.)",
      constants: "App constants, theme, config",
      charts: "Chart components and configs",
      data: "Exercise library JSON, product catalog JSON, tag registry",
      ai: "AI Coach prompt builder, pattern recognition engine",
    },
  },
  // ─────────────────────────────────────────────
  // ASYNC STORAGE KEY STRUCTURE
  // ─────────────────────────────────────────────
  storageKeys: {
    profile: "@dubaitracker/profile",
    tags: "@dubaitracker/tags",
    logs: "@dubaitracker/logs/YYYY-MM-DD",
    goals: "@dubaitracker/goals",
    chat: "@dubaitracker/chat/YYYY-MM-DD",
    settings: "@dubaitracker/settings",
    correlations: "@dubaitracker/correlations",
    exercises: "@dubaitracker/exercises",
    therapy: "@dubaitracker/therapy",
    bloodwork: "@dubaitracker/bloodwork",
    measurements: "@dubaitracker/measurements",
    progressPhotos: "@dubaitracker/progressphotos",
    recovery: "@dubaitracker/recovery",
    products: "@dubaitracker/products",
    onboardingComplete: "@dubaitracker/onboarding-complete",
  },
  // ─────────────────────────────────────────────
  // ONBOARDING FLOW
  // ─────────────────────────────────────────────
  onboarding: {
    step1_profile: {
      fields: ["name", "age", "sex (male/female)", "height (ft/in or cm)", "current weight (lbs or kg)", "goal weight", "activity level"],
      activityLevels: [
        { label: "Sedentary", multiplier: 1.2 },
        { label: "Lightly Active", multiplier: 1.375 },
        { label: "Moderately Active", multiplier: 1.55 },
        { label: "Active", multiplier: 1.725 },
        { label: "Very Active", multiplier: 1.9 },
      ],
    },
    step2_weightGoal: {
      options: ["Lose", "Gain", "Maintain"],
      rates: ["0.5 lb/week", "1 lb/week", "1.5 lb/week", "2 lb/week"],
      calorieCalc: "Lose: TDEE - (rate * 500). Gain: TDEE + (rate * 500). Maintain: TDEE.",
      warnIf: "Rate > 2 lb/week",
    },
    step3_structurePreference: {
      options: [
        { id: "coach_me_hard", label: "Coach me hard", description: "All reminders on, detailed tracking, proactive AI nudges, end-of-day check-in, full analytics. Comprehensive default tags." },
        { id: "keep_it_simple", label: "Keep it simple", description: "Minimal reminders, simplified logging, AI Coach available but not pushy. Basic default tags: water, food, workouts, weight, sleep." },
        { id: "customize", label: "I'll customize everything", description: "No defaults. You hand-pick every tag and notification." },
      ],
    },
    step4_tagSelection: "Browse tag library by category. Starter pack pre-selected based on structure preference. User toggles on/off.",
    step5_deviceConnections: "One-tap buttons: Strava, Garmin, Apple Health/Google Health Connect. Skip available.",
    step6_notifications: "Set end-of-day check-in time, morning reminder, water/vitamin/medication schedule. All electable, all skippable.",
  },
  // ─────────────────────────────────────────────
  // TAG SYSTEM (THE CORE ARCHITECTURE)
  // ─────────────────────────────────────────────
  tagSystem: {
    description: "Every trackable metric is a 'tag'. Users build their dashboard by enabling tags from a library. Tags can be added, removed, reordered, configured anytime.",
    tagType: "{ id: string, name: string, category: string, type: 'counter' | 'checklist' | 'measurement' | 'timer' | 'journal' | 'exercise' | 'custom', unit: string, defaultGoal: number | null, icon: string, enabled: boolean, order: number }",
    categories: {
      hydration: [
        { id: "water", name: "Water", type: "counter", unit: "oz", defaultGoalMen: 100, defaultGoalWomen: 75 },
        { id: "coffee", name: "Coffee/Caffeine", type: "counter", unit: "mg caffeine" },
      ],
      nutrition: [
        { id: "food_log", name: "Food Log", type: "journal", unit: "meal", fields: "meal name, calories, protein, carbs, fat, added sugars (g), fiber (g), sodium (mg), photo capture" },
        { id: "calorie_budget", name: "Calorie Budget", type: "measurement", unit: "cal", defaultGoal: "auto from TDEE" },
        { id: "protein_target", name: "Protein Target", type: "measurement", unit: "g", defaultGoal: "1g per lb of goal weight" },
        { id: "added_sugar", name: "Added Sugar Target", type: "measurement", unit: "g", defaultGoalMen: 36, defaultGoalWomen: 25, note: "WHO guidelines" },
        { id: "fasting", name: "Intermittent Fasting", type: "timer", unit: "hours" },
      ],
      fitness: [
        { id: "walks", name: "Walks", type: "measurement", fields: "duration, distance, calories, elevation gain, avg HR, weather" },
        { id: "runs", name: "Runs", type: "measurement", fields: "duration, distance, pace, calories, elevation gain, avg/max HR, weather" },
        { id: "cycling", name: "Cycling", type: "measurement", fields: "duration, distance, avg speed, elevation, HR, weather" },
        { id: "swimming", name: "Swimming", type: "measurement", fields: "duration, laps, stroke type, calories" },
        { id: "pushups", name: "Push-ups", type: "counter", unit: "reps", defaultGoal: 50 },
        { id: "pullups", name: "Pull-ups", type: "counter", unit: "reps" },
        { id: "steps", name: "Steps", type: "counter", unit: "steps", source: "manual or Apple Health/Google Health Connect" },
        { id: "active_minutes", name: "Active Minutes", type: "counter", unit: "min", note: "auto-calculated from activities" },
        { id: "calories_burned", name: "Calories Burned", type: "measurement", unit: "cal", note: "auto-calculated from activities + BMR" },
        { id: "flexibility", name: "Flexibility/Mobility", type: "measurement", fields: "duration, type (stretching/yoga/foam rolling), notes" },
      ],
      body: [
        { id: "weight", name: "Body Weight", type: "measurement", unit: "lbs", note: "trend line, 7-day moving average" },
        { id: "body_fat", name: "Body Fat %", type: "measurement", unit: "%" },
        { id: "measurements", name: "Body Measurements", fields: "waist, hips, chest, arms, thighs (inches or cm), waist-to-hip ratio auto-calculated, monthly reminders" },
        { id: "blood_pressure", name: "Blood Pressure", type: "measurement", fields: "systolic, diastolic, timestamp" },
        { id: "resting_hr", name: "Resting Heart Rate", type: "measurement", unit: "bpm", source: "manual or Apple Health" },
        { id: "hrv", name: "HRV", type: "measurement", unit: "ms", source: "Apple Health/Garmin/Oura", note: "Critical recovery/stress indicator" },
        { id: "spo2", name: "SpO2", type: "measurement", unit: "%", source: "wearable" },
        { id: "bmr", name: "BMR", note: "Mifflin-St Jeor, recalculated monthly from rolling 7-day avg weight" },
        { id: "tdee", name: "TDEE", note: "BMR x activity multiplier" },
        { id: "progress_photos", name: "Progress Photos", note: "monthly, encrypted, side-by-side comparison" },
      ],
      supplements: [
        { id: "vitamins", name: "Vitamins", type: "checklist", note: "Interview-based setup with Amazon order links" },
        { id: "medications", name: "Medications", type: "checklist", note: "Time schedule, push notification reminders" },
        { id: "supplements", name: "Supplements", type: "checklist", note: "Creatine, protein powder, collagen, etc." },
      ],
      substances: [
        { id: "alcohol", name: "Alcohol", fields: "drink count, type (beer/wine/liquor/cocktail/seltzer), estimated standard units, timestamp per drink" },
        { id: "cannabis", name: "Cannabis", fields: "yes/no, method (smoke/vape/edible/tincture), notes, timestamp" },
        { id: "tobacco", name: "Tobacco/Nicotine", fields: "cigarette count / vape sessions / pouches, timestamp" },
        { id: "caffeine", name: "Caffeine", fields: "mg, timestamp" },
      ],
      mentalWellness: [
        { id: "mood", name: "Mood", type: "measurement", fields: "1-10 scale with emoji, optional journal note, timestamped, multiple per day" },
        { id: "gratitude", name: "Gratitude", type: "journal", note: "Free-text, one per day" },
        { id: "meditation", name: "Meditation", type: "timer", fields: "duration, type (guided/unguided/breathwork)" },
        { id: "stress", name: "Stress Level", type: "measurement", fields: "1-10, timestamped, multiple per day" },
        { id: "therapy", name: "Therapy Sessions", fields: "date/time, duration, therapist name, type, modality, pre/post mood, journal, action items" },
      ],
      sleep: [
        { id: "bedtime", name: "Bedtime", note: "manual or synced from watch" },
        { id: "wake_time", name: "Wake Time" },
        { id: "sleep_hours", name: "Total Sleep Hours", defaultGoal: 8 },
        { id: "sleep_quality", name: "Sleep Quality", fields: "1-5 stars" },
        { id: "bathroom_trips", name: "Bathroom Trips", type: "counter" },
        { id: "alarm_used", name: "Alarm Used", fields: "yes/no" },
        { id: "time_to_sleep", name: "Time to Fall Asleep", unit: "minutes" },
        { id: "sleep_notes", name: "Sleep Notes", type: "journal" },
      ],
      healthMarkers: [
        { id: "bloodwork", name: "Bloodwork/Lab Results", fields: "cholesterol, triglycerides, A1C, fasting glucose, testosterone, vitamin D, B12, iron/ferritin, thyroid, CRP, IL-6" },
        { id: "dexa", name: "DEXA Scan", fields: "bone density, lean mass, fat mass" },
      ],
    },
  },
  // ─────────────────────────────────────────────
  // FEATURE: DASHBOARD (Tab 1)
  // ─────────────────────────────────────────────
  dashboard: {
    topSection: [
      "Overall Daily Score — circular progress ring, percentage, green/gold/red",
      "Recovery Score (0-100, color indicator)",
      "BMR/TDEE/Calorie Target summary",
      "Net Calories today (consumed minus burned)",
      "Streak counter (days at 80%+ — shown as data, not celebrated)",
    ],
    cards: "Show ONLY enabled tags. Each card: current value, daily goal, progress ring/bar, last log timestamp, quick-add button. Reorderable via drag-and-drop.",
    sparklines: "Mini 7-day sparkline on each card.",
  },
  // ─────────────────────────────────────────────
  // FEATURE: AI COACH (Tab 3)
  // ─────────────────────────────────────────────
  aiCoach: {
    model: "claude-sonnet-4-20250514",
    systemPrompt: "You are Coach DUB, a world-class RD, NASM-CPT, CSCS, and behavioral wellness expert with 20 years of clinical experience. Direct, specific, reference actual numbers. Factor in time of day. Recognize patterns. Non-judgmental. Keep responses to 2-3 concise paragraphs.",
    suggestedPrompts: [
      "How am I doing today?",
      "What should I eat next?",
      "Quick workout suggestion",
      "End of day review",
      "Help me sleep better",
      "Am I on track this week?",
      "Analyze my workout",
      "Recovery check",
    ],
  },
  // ─────────────────────────────────────────────
  // FORMULAS
  // ─────────────────────────────────────────────
  formulas: {
    bmr: {
      men: "(10 x weight_kg) + (6.25 x height_cm) - (5 x age) + 5",
      women: "(10 x weight_kg) + (6.25 x height_cm) - (5 x age) - 161",
      recalc: "Monthly using rolling 7-day avg weight",
    },
    tdee: "BMR x activity multiplier",
    recoveryScore: "sleep quality (25%) + sleep duration (20%) + HRV (20%) + resting HR (15%) + training load (15%) + alcohol (5%). Scale 0-100.",
  },
  // ─────────────────────────────────────────────
  // BUILD PHASES (22 TOTAL)
  // ─────────────────────────────────────────────
  buildPhases: {
    phase1: {
      name: "Foundation",
      tasks: [
        "Project setup: Expo + TypeScript + expo-dev-client + expo-router + AsyncStorage + expo-secure-store",
        "Folder structure: /src/components, screens, utils, types, hooks, services, constants, data, charts, ai",
        "Navigation: 5-tab bottom bar (Dashboard, Log, Coach, Trends, Settings) with placeholder screens",
        "Tag system architecture: full tag registry, useTagSystem() hook, AsyncStorage persistence",
        "Onboarding flow: profile, weight goal, structure preference, tag selection, flag completion",
        "Dashboard: Overall Daily Score ring, BMR/TDEE card, enabled tag cards with progress bars",
        "Water Intake: fully functional end-to-end (log +8oz/+4oz/+16oz with timestamps, undo, progress ring, 7-day sparkline, AsyncStorage persistence, survives app restart)",
      ],
    },
    phase2: { name: "Counters & Checklists", tasks: ["Push-ups, Pull-ups (counter UI)", "Vitamins (interview + Amazon links)", "Medications (checklist + reminders)"] },
    phase3: { name: "Food Logging", tasks: ["Camera photo capture", "Manual calorie/macro/added sugar entry", "Meal log with timestamps"] },
    phase4: { name: "Strength Training", tasks: ["150+ exercise library", "Set-by-set logging (weight x reps)", "Rest timer", "Previous performance display", "Volume calc", "PRs"] },
    phase5: { name: "Cardio/Outdoor", tasks: ["Walks, Runs, Cycling", "Elevation, HR, weather capture"] },
    phase6: { name: "Sleep", tasks: ["Bedtime/wake time", "Quality/bathroom/alarm", "Watch sync stub"] },
    phase7: { name: "Goals", tasks: ["Goal setting per tag", "Dashboard progress integration", "Weight management calorie calculator"] },
    phase8: { name: "AI Coach", tasks: ["Anthropic API chat", "Data injection per message", "Structure preference adaptation", "Suggested prompts"] },
    phase9: { name: "Pattern Engine", tasks: ["Correlation computation", "Anomaly detection", "Insight card generation"] },
    phase10: { name: "Notifications", tasks: ["All notification types", "Structure-based defaults", "Configurable times/frequencies"] },
    phase11: { name: "End-of-Day", tasks: ["Smart questionnaire", "Swipeable cards", "AI summary"] },
    phase12: { name: "Trends", tasks: ["All 53 chart types", "Calendar heatmap", "Time range selector", "Note: may be 2-3 sub-phases"] },
    phase13: { name: "Marketplace", tasks: ["1,000+ SKU catalog JSON", "Contextual triggers", "Amazon deep links", "Marketplace browse UI"] },
    phase14: { name: "Grocery", tasks: ["Instacart API integration", "Meal plan ordering", "Amazon Fresh links"] },
    phase15: { name: "Device Sync", tasks: ["Strava OAuth", "Apple Health", "Google Health Connect"] },
    phase16: { name: "Body Tracking", tasks: ["Body measurements", "Progress photos (encrypted)", "Bloodwork logging"] },
    phase17: { name: "Health Report", tasks: ["PDF generator", "Section selector", "Wellness compliance card", "FHIR stub"] },
    phase18: { name: "Therapy & Injury", tasks: ["Therapy sessions", "Action items", "Injury/pain tracking", "Recovery score calc"] },
    phase19: { name: "Remaining Tags", tasks: ["Women's health", "Digestive health", "Sexual activity"] },
    phase20: { name: "Substances", tasks: ["Alcohol, cannabis, tobacco, caffeine tracking", "Trend charts"] },
    phase21: { name: "Widget", tasks: ["iOS/Android home screen widget"] },
    phase22: { name: "Polish", tasks: ["Settings completeness", "Encryption", "FHIR stub", "CSV export", "App PIN/biometric lock", "Final QA"] },
  },
};
// Export for reference
module.exports = DUB_AI_SPEC;
