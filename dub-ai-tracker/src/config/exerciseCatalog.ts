// S36: Strength Training v2 — body-region tree taxonomy + exercise catalog.
//
// Replaces the inline 18-string COMMON_EXERCISES array in StrengthLogger.tsx
// with a typed catalog organized by primary body region and equipment tags.
// See sprint spec for the design rationale (especially: no hardcoded
// "popularity" priors — real popularity is learned from usage_count).

export type BodyRegion =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'forearms'
  | 'traps'
  | 'full_body';

export const ALL_BODY_REGIONS: BodyRegion[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core',
  'forearms', 'traps', 'full_body',
];

export type Equipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bands'
  | 'smith'
  | 'trx'
  | 'bench';

export const ALL_EQUIPMENT: Equipment[] = [
  'bodyweight', 'dumbbells', 'barbell', 'kettlebell',
  'cable', 'machine', 'bands', 'smith', 'trx', 'bench',
];

// "Full gym" in Settings is a display-level convenience that expands
// internally to the equipment items typically gated behind a gym membership.
// Bodyweight, dumbbells, barbell, kettlebell, bands stay user-elected
// individually; full-gym implies the assisted/guided machinery group.
export const FULL_GYM_EXPANSION: Equipment[] = [
  'cable', 'machine', 'smith', 'trx', 'bench',
];

export interface Exercise {
  id: string;                       // stable kebab-case slug
  name: string;                     // display name
  primary: BodyRegion;              // single primary region
  secondary: BodyRegion[];          // 0+ secondary regions
  equipment: Equipment[];           // valid equipment options
  default_order: number;            // alphabetical within region (1-based)
  compound: boolean;                // compound vs isolation
  default_rep_range: [number, number];
  default_sets: number;
  cue_short: string;                // one-sentence form cue
}

// Catalog entries authored grouped by region for review;
// default_order is assigned programmatically below to keep
// it provably alphabetical-within-region.
const RAW_CATALOG: Omit<Exercise, 'default_order'>[] = [
  // -- Chest --
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['barbell', 'bench'], compound: true, default_rep_range: [5, 8], default_sets: 4, cue_short: 'Drive feet, retract shoulder blades, bar to mid-chest.' },
  { id: 'cable-crossover', name: 'Cable Crossover', primary: 'chest', secondary: [], equipment: ['cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Soft elbow bend, squeeze chest at full adduction.' },
  { id: 'cable-fly', name: 'Cable Fly', primary: 'chest', secondary: [], equipment: ['cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Hug a barrel; keep elbows fixed in slight bend.' },
  { id: 'chest-dip', name: 'Chest Dip', primary: 'chest', secondary: ['triceps'], equipment: ['bodyweight'], compound: true, default_rep_range: [6, 12], default_sets: 3, cue_short: 'Lean torso forward to bias chest over triceps.' },
  { id: 'decline-bench-press', name: 'Decline Bench Press', primary: 'chest', secondary: ['triceps'], equipment: ['barbell', 'dumbbells', 'bench'], compound: true, default_rep_range: [6, 10], default_sets: 3, cue_short: 'Lower bar to lower chest, control the descent.' },
  { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', primary: 'chest', secondary: ['triceps', 'shoulders'], equipment: ['dumbbells', 'bench'], compound: true, default_rep_range: [6, 12], default_sets: 4, cue_short: 'DBs in line with mid-chest, full lockout overhead.' },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', primary: 'chest', secondary: [], equipment: ['dumbbells', 'bench'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Big arc, slight elbow bend, stretch then squeeze.' },
  { id: 'incline-bench-press', name: 'Incline Bench Press', primary: 'chest', secondary: ['shoulders', 'triceps'], equipment: ['barbell', 'dumbbells', 'smith', 'bench'], compound: true, default_rep_range: [6, 10], default_sets: 4, cue_short: '30-45 degree bench; bar to upper chest.' },
  { id: 'machine-fly', name: 'Machine Fly', primary: 'chest', secondary: [], equipment: ['machine'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Pin the back, drive elbows together, squeeze.' },
  { id: 'push-up', name: 'Push-Up', primary: 'chest', secondary: ['triceps', 'shoulders', 'core'], equipment: ['bodyweight'], compound: true, default_rep_range: [8, 20], default_sets: 3, cue_short: 'Hands shoulder-width; elbows ~45 degrees from torso.' },
  { id: 'smith-bench-press', name: 'Smith Bench Press', primary: 'chest', secondary: ['triceps'], equipment: ['smith', 'bench'], compound: true, default_rep_range: [6, 10], default_sets: 3, cue_short: 'Track the bar; chest up, shoulder blades retracted.' },

  // -- Back --
  { id: 'barbell-row', name: 'Barbell Row', primary: 'back', secondary: ['biceps'], equipment: ['barbell'], compound: true, default_rep_range: [6, 10], default_sets: 4, cue_short: 'Hinge ~45 degrees, pull bar to lower ribs.' },
  { id: 'chin-up', name: 'Chin-Up', primary: 'back', secondary: ['biceps'], equipment: ['bodyweight'], compound: true, default_rep_range: [5, 10], default_sets: 3, cue_short: 'Underhand grip; chin clears the bar.' },
  { id: 'dumbbell-row', name: 'Dumbbell Row', primary: 'back', secondary: ['biceps'], equipment: ['dumbbells', 'bench'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'One arm at a time; pull elbow toward hip.' },
  { id: 'face-pull', name: 'Face Pull', primary: 'back', secondary: ['shoulders'], equipment: ['cable', 'bands'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'High-elbow pull toward forehead; externally rotate.' },
  { id: 'inverted-row', name: 'Inverted Row', primary: 'back', secondary: ['biceps'], equipment: ['bodyweight', 'trx'], compound: true, default_rep_range: [8, 15], default_sets: 3, cue_short: 'Body straight, pull chest to bar/handles.' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', primary: 'back', secondary: ['biceps'], equipment: ['cable', 'machine'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Drive elbows down; bar to upper chest.' },
  { id: 'pull-up', name: 'Pull-Up', primary: 'back', secondary: ['biceps'], equipment: ['bodyweight'], compound: true, default_rep_range: [5, 10], default_sets: 3, cue_short: 'Overhand grip; full hang to chin over bar.' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', primary: 'back', secondary: ['biceps'], equipment: ['cable'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Tall chest; pull handle to lower ribs.' },
  { id: 't-bar-row', name: 'T-Bar Row', primary: 'back', secondary: ['biceps'], equipment: ['barbell', 'machine'], compound: true, default_rep_range: [6, 10], default_sets: 3, cue_short: 'Neutral grip; row toward sternum.' },

  // -- Shoulders --
  { id: 'arnold-press', name: 'Arnold Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbells'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Rotate palms from facing-you to facing-out as you press.' },
  { id: 'barbell-overhead-press', name: 'Barbell Overhead Press', primary: 'shoulders', secondary: ['triceps', 'core'], equipment: ['barbell'], compound: true, default_rep_range: [5, 8], default_sets: 4, cue_short: 'Brace core, press straight up, stack ribs over hips.' },
  { id: 'dumbbell-overhead-press', name: 'Dumbbell Overhead Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['dumbbells'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Press DBs from shoulder height to lockout.' },
  { id: 'front-raise', name: 'Front Raise', primary: 'shoulders', secondary: [], equipment: ['dumbbells', 'cable', 'bands'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Raise to eye level; control the lower.' },
  { id: 'lateral-raise', name: 'Lateral Raise', primary: 'shoulders', secondary: [], equipment: ['dumbbells', 'cable', 'bands'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Lead with the elbow; pour-the-water at the top.' },
  { id: 'machine-overhead-press', name: 'Machine Overhead Press', primary: 'shoulders', secondary: ['triceps'], equipment: ['machine'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Settle into the pad; press without flaring excessively.' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', primary: 'shoulders', secondary: [], equipment: ['dumbbells', 'cable', 'machine'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Hinge forward; pull DBs apart with high elbows.' },
  { id: 'upright-row', name: 'Upright Row', primary: 'shoulders', secondary: ['traps'], equipment: ['barbell', 'dumbbells', 'cable'], compound: false, default_rep_range: [10, 12], default_sets: 3, cue_short: 'Pull elbows up and out; keep wrists neutral.' },

  // -- Biceps --
  { id: 'barbell-curl', name: 'Barbell Curl', primary: 'biceps', secondary: [], equipment: ['barbell'], compound: false, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Elbows pinned to sides; drive supination.' },
  { id: 'cable-curl', name: 'Cable Curl', primary: 'biceps', secondary: [], equipment: ['cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Constant tension; squeeze at the top.' },
  { id: 'concentration-curl', name: 'Concentration Curl', primary: 'biceps', secondary: [], equipment: ['dumbbells'], compound: false, default_rep_range: [10, 12], default_sets: 3, cue_short: 'Brace elbow on inner thigh; full ROM.' },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', primary: 'biceps', secondary: [], equipment: ['dumbbells'], compound: false, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Alternate arms; keep elbows still.' },
  { id: 'hammer-curl', name: 'Hammer Curl', primary: 'biceps', secondary: ['forearms'], equipment: ['dumbbells'], compound: false, default_rep_range: [10, 12], default_sets: 3, cue_short: 'Neutral grip; thumbs up throughout.' },
  { id: 'preacher-curl', name: 'Preacher Curl', primary: 'biceps', secondary: [], equipment: ['barbell', 'dumbbells', 'machine'], compound: false, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Triceps pinned to pad; stop short of full extension.' },

  // -- Triceps --
  { id: 'close-grip-bench', name: 'Close-Grip Bench', primary: 'triceps', secondary: ['chest'], equipment: ['barbell', 'bench'], compound: true, default_rep_range: [6, 10], default_sets: 3, cue_short: 'Hands shoulder-width; tuck elbows.' },
  { id: 'overhead-tricep-extension', name: 'Overhead Tricep Extension', primary: 'triceps', secondary: [], equipment: ['dumbbells', 'cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Elbows narrow; full stretch overhead.' },
  { id: 'skull-crusher', name: 'Skull Crusher', primary: 'triceps', secondary: [], equipment: ['barbell', 'dumbbells', 'bench'], compound: false, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Lower toward forehead; elbows stay still.' },
  { id: 'tricep-dip', name: 'Tricep Dip', primary: 'triceps', secondary: ['chest'], equipment: ['bodyweight'], compound: true, default_rep_range: [6, 12], default_sets: 3, cue_short: 'Vertical torso to bias triceps; elbows back.' },
  { id: 'tricep-kickback', name: 'Tricep Kickback', primary: 'triceps', secondary: [], equipment: ['dumbbells', 'cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Pin elbow to side; extend through full lockout.' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', primary: 'triceps', secondary: [], equipment: ['cable'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Elbows pinned; push to full lockout, control return.' },

  // -- Quads --
  { id: 'barbell-squat', name: 'Barbell Squat', primary: 'quads', secondary: ['glutes', 'hamstrings', 'core'], equipment: ['barbell'], compound: true, default_rep_range: [5, 8], default_sets: 4, cue_short: 'Brace core; descend between hips, knees track toes.' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight', 'dumbbells', 'barbell'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Rear foot elevated; descend on the front leg.' },
  { id: 'front-squat', name: 'Front Squat', primary: 'quads', secondary: ['core', 'glutes'], equipment: ['barbell'], compound: true, default_rep_range: [5, 8], default_sets: 3, cue_short: 'Elbows high; upright torso; deep knee bend.' },
  { id: 'goblet-squat', name: 'Goblet Squat', primary: 'quads', secondary: ['glutes'], equipment: ['dumbbells', 'kettlebell'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Hold weight at chest; sit between heels.' },
  { id: 'leg-extension', name: 'Leg Extension', primary: 'quads', secondary: [], equipment: ['machine'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Drive to full lockout; control the descent.' },
  { id: 'leg-press', name: 'Leg Press', primary: 'quads', secondary: ['glutes'], equipment: ['machine'], compound: true, default_rep_range: [8, 15], default_sets: 3, cue_short: 'Feet shoulder-width; do not lock knees hard.' },
  { id: 'lunge', name: 'Lunge', primary: 'quads', secondary: ['glutes', 'hamstrings'], equipment: ['bodyweight', 'dumbbells', 'barbell'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Long step; back knee tracks toward floor.' },
  { id: 'step-up', name: 'Step-Up', primary: 'quads', secondary: ['glutes'], equipment: ['bodyweight', 'dumbbells'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Drive through working leg; tap the floor on return.' },

  // -- Hamstrings --
  { id: 'good-morning', name: 'Good Morning', primary: 'hamstrings', secondary: ['glutes', 'core'], equipment: ['barbell'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Hinge from hips with neutral spine; soft knees.' },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', primary: 'hamstrings', secondary: [], equipment: ['machine'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Curl heels to glutes; do not arch low back.' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', primary: 'hamstrings', secondary: ['glutes', 'back'], equipment: ['barbell', 'dumbbells', 'kettlebell'], compound: true, default_rep_range: [6, 12], default_sets: 3, cue_short: 'Push hips back; bar slides down legs; soft knees.' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', primary: 'hamstrings', secondary: [], equipment: ['machine'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Pin hips down; full ROM under control.' },

  // -- Glutes --
  { id: 'cable-pull-through', name: 'Cable Pull-Through', primary: 'glutes', secondary: ['hamstrings'], equipment: ['cable'], compound: true, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Hinge with the cable between legs; lock out hips.' },
  { id: 'glute-bridge', name: 'Glute Bridge', primary: 'glutes', secondary: ['hamstrings'], equipment: ['bodyweight', 'barbell'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Drive heels; squeeze glutes hard at top.' },
  { id: 'glute-kickback', name: 'Glute Kickback', primary: 'glutes', secondary: [], equipment: ['cable', 'machine', 'bands'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Drive working leg straight back; squeeze the cheek.' },
  { id: 'hip-thrust', name: 'Hip Thrust', primary: 'glutes', secondary: ['hamstrings'], equipment: ['barbell', 'dumbbells', 'bench'], compound: true, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Shoulders on bench; chin tucked; drive through heels.' },

  // -- Calves --
  { id: 'donkey-calf-raise', name: 'Donkey Calf Raise', primary: 'calves', secondary: [], equipment: ['machine', 'bodyweight'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'Hips bent; full stretch then high to the toes.' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', primary: 'calves', secondary: [], equipment: ['machine'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'Pause at the stretch; squeeze at the top.' },
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', primary: 'calves', secondary: [], equipment: ['bodyweight', 'machine', 'dumbbells'], compound: false, default_rep_range: [10, 20], default_sets: 3, cue_short: 'Full ROM; rise high on the ball of the foot.' },

  // -- Core --
  { id: 'ab-wheel', name: 'Ab Wheel', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [5, 10], default_sets: 3, cue_short: 'Tuck pelvis; roll out only as far as you can return.' },
  { id: 'crunch', name: 'Crunch', primary: 'core', secondary: [], equipment: ['bodyweight', 'machine'], compound: false, default_rep_range: [10, 20], default_sets: 3, cue_short: 'Curl ribs to hips; do not yank the neck.' },
  { id: 'dead-bug', name: 'Dead Bug', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [8, 12], default_sets: 3, cue_short: 'Press low back into floor; opposite arm/leg slow.' },
  { id: 'hanging-knee-raise', name: 'Hanging Knee Raise', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [8, 15], default_sets: 3, cue_short: 'No swing; raise knees to chest, control the lower.' },
  { id: 'leg-raise', name: 'Leg Raise', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Pin lower back; raise legs to vertical, lower slow.' },
  { id: 'plank', name: 'Plank', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [30, 60], default_sets: 3, cue_short: 'Straight line head-to-heels; brace, breathe.' },
  { id: 'russian-twist', name: 'Russian Twist', primary: 'core', secondary: [], equipment: ['bodyweight', 'dumbbells', 'kettlebell'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'Lean back ~45 degrees; rotate from the trunk.' },
  { id: 'side-plank', name: 'Side Plank', primary: 'core', secondary: [], equipment: ['bodyweight'], compound: false, default_rep_range: [20, 45], default_sets: 3, cue_short: 'Stack hips; press the down-side shoulder away.' },

  // -- Forearms --
  { id: 'farmer-carry', name: 'Farmer Carry', primary: 'forearms', secondary: ['traps', 'core'], equipment: ['dumbbells', 'kettlebell'], compound: true, default_rep_range: [30, 60], default_sets: 3, cue_short: 'Tall posture; crush the handles; walk smooth.' },
  { id: 'reverse-wrist-curl', name: 'Reverse Wrist Curl', primary: 'forearms', secondary: [], equipment: ['barbell', 'dumbbells'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'Forearms on bench; lift the back of the hand.' },
  { id: 'wrist-curl', name: 'Wrist Curl', primary: 'forearms', secondary: [], equipment: ['barbell', 'dumbbells'], compound: false, default_rep_range: [12, 20], default_sets: 3, cue_short: 'Forearms on bench; let weight roll into fingertips.' },

  // -- Traps --
  { id: 'barbell-shrug', name: 'Barbell Shrug', primary: 'traps', secondary: [], equipment: ['barbell'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Straight up; do not roll the shoulders.' },
  { id: 'dumbbell-shrug', name: 'Dumbbell Shrug', primary: 'traps', secondary: [], equipment: ['dumbbells'], compound: false, default_rep_range: [10, 15], default_sets: 3, cue_short: 'Pause at the top; long ROM.' },

  // -- Full body --
  { id: 'burpee', name: 'Burpee', primary: 'full_body', secondary: ['chest', 'quads', 'core'], equipment: ['bodyweight'], compound: true, default_rep_range: [8, 15], default_sets: 3, cue_short: 'Drop to plank, push-up, jump up; smooth chain.' },
  { id: 'clean', name: 'Clean', primary: 'full_body', secondary: ['back', 'quads', 'shoulders'], equipment: ['barbell', 'dumbbells', 'kettlebell'], compound: true, default_rep_range: [3, 5], default_sets: 4, cue_short: 'Pull from the floor; receive in a quarter squat.' },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', primary: 'full_body', secondary: ['glutes', 'hamstrings', 'core'], equipment: ['kettlebell'], compound: true, default_rep_range: [10, 20], default_sets: 3, cue_short: 'Hinge, hike, pop the hips; bell floats to chest.' },
  { id: 'snatch', name: 'Snatch', primary: 'full_body', secondary: ['back', 'shoulders', 'quads'], equipment: ['barbell', 'dumbbells', 'kettlebell'], compound: true, default_rep_range: [3, 5], default_sets: 4, cue_short: 'One pull from floor to overhead; punch up.' },
  { id: 'thruster', name: 'Thruster', primary: 'full_body', secondary: ['quads', 'shoulders'], equipment: ['barbell', 'dumbbells'], compound: true, default_rep_range: [6, 12], default_sets: 3, cue_short: 'Front squat into press; one continuous drive.' },
  { id: 'turkish-get-up', name: 'Turkish Get-Up', primary: 'full_body', secondary: ['core', 'shoulders'], equipment: ['kettlebell', 'dumbbells'], compound: true, default_rep_range: [3, 6], default_sets: 3, cue_short: 'Press, roll, kneel, stand; reverse the whole sequence.' },
];

function buildCatalog(raw: Omit<Exercise, 'default_order'>[]): Exercise[] {
  const byRegion = new Map<BodyRegion, Omit<Exercise, 'default_order'>[]>();
  for (const ex of raw) {
    const list = byRegion.get(ex.primary) ?? [];
    list.push(ex);
    byRegion.set(ex.primary, list);
  }
  const out: Exercise[] = [];
  for (const region of ALL_BODY_REGIONS) {
    const list = (byRegion.get(region) ?? []).slice().sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    list.forEach((ex, idx) => {
      out.push({ ...ex, default_order: idx + 1 });
    });
  }
  return out;
}

export const EXERCISE_CATALOG: Exercise[] = buildCatalog(RAW_CATALOG);

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISE_CATALOG.find((e) => e.id === id);
}

export function getExercisesByRegion(region: BodyRegion): Exercise[] {
  return EXERCISE_CATALOG.filter((e) => e.primary === region);
}

/**
 * Returns exercises whose equipment tags intersect `owned`.
 * Pure (non-mutating) — input arrays untouched.
 */
export function filterByEquipment(
  catalog: Exercise[],
  owned: Equipment[],
): Exercise[] {
  if (owned.length === 0) return [];
  const ownedSet = new Set(owned);
  return catalog.filter((ex) => ex.equipment.some((eq) => ownedSet.has(eq)));
}

/**
 * Translate the user's display-level equipment selection into the internal
 * filter set. "Full gym" is exploded to its component machinery items;
 * other items pass through. Returned set is deduplicated.
 */
export function expandFullGym(displaySelection: Array<Equipment | 'full_gym'>): Equipment[] {
  const out = new Set<Equipment>();
  for (const item of displaySelection) {
    if (item === 'full_gym') {
      for (const eq of FULL_GYM_EXPANSION) out.add(eq);
    } else {
      out.add(item);
    }
  }
  return Array.from(out);
}
