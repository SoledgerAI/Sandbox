// TF-05: Dashboard quick-action tiles — shared registry
// Each tile maps a stable ID (persisted in SETTINGS_DASHBOARD_TILES) to a
// short label, icon, log route, and optional tag gate. A tagGate of null
// means the tile is always available regardless of the user's enabled tags.

export interface DashboardTile {
  id: string;
  label: string;
  icon: string;
  route: string;
  tagGate: string | null;
}

export const ALL_DASHBOARD_TILES: DashboardTile[] = [
  { id: 'food',         label: 'Food',        icon: 'restaurant-outline', route: '/log/food',              tagGate: 'nutrition.food' },
  { id: 'drinks',       label: 'Drinks',      icon: 'water-outline',      route: '/log/water',             tagGate: 'hydration.water' },
  { id: 'weight',       label: 'Weight',      icon: 'scale-outline',      route: '/log/body',              tagGate: 'body.measurements' },
  { id: 'workout',      label: 'Workout',     icon: 'fitness-outline',    route: '/log/workout',           tagGate: 'fitness.workout' },
  { id: 'supplements',  label: 'Supplements', icon: 'medkit-outline',     route: '/log/supplements',       tagGate: 'supplements.daily' },
  { id: 'sleep',        label: 'Sleep',       icon: 'moon-outline',       route: '/log/sleep',             tagGate: 'sleep.tracking' },
  { id: 'recovery',     label: 'Recovery',    icon: 'pulse-outline',      route: '/log/wearable',          tagGate: 'sleep.tracking' },
  { id: 'mood',         label: 'Mood',        icon: 'happy-outline',      route: '/log/mood',              tagGate: 'mental.wellness' },
  { id: 'habits',       label: 'Habits',      icon: 'checkbox-outline',   route: '/log/habits',            tagGate: null },
  { id: 'body-metrics', label: 'Body',        icon: 'body-outline',       route: '/log/body-measurements', tagGate: 'body.measurements' },
  { id: 'medications',  label: 'Meds',        icon: 'medical-outline',    route: '/log/medications',       tagGate: null },
  { id: 'meditation',   label: 'Meditate',    icon: 'leaf-outline',       route: '/log/meditation',        tagGate: 'mental.wellness' },
  { id: 'stress',       label: 'Stress',      icon: 'pulse-outline',      route: '/log/stress',            tagGate: 'mental.wellness' },
  { id: 'journal',      label: 'Journal',     icon: 'book-outline',       route: '/log/journal',           tagGate: null },
  { id: 'strength',     label: 'Strength',    icon: 'barbell-outline',    route: '/log/strength',          tagGate: 'strength.training' },
];

export const DEFAULT_DASHBOARD_TILES: string[] = [
  'food', 'drinks', 'weight',
  'workout', 'supplements', 'sleep',
];

// After defaults, fill remaining slots from this priority list when a default
// tile is hidden because its category is not enabled.
export const PRIORITY_FILL_ORDER: string[] = [
  'mood', 'habits', 'body-metrics', 'medications',
];

export const MAX_DASHBOARD_TILES = 6;

export function getTileById(id: string): DashboardTile | undefined {
  return ALL_DASHBOARD_TILES.find((t) => t.id === id);
}

// S29-D: Authoritative list of every log route registered under app/log/.
// Used to validate dashboard tile + snapshot routes at dev-time so a typo
// like '/log/mood_mental' (file is mood-mental.tsx) surfaces on boot
// instead of as an "Unmatched Route" page when the user taps a tile.
export const KNOWN_LOG_ROUTES: ReadonlySet<string> = new Set([
  '/log/allergies',
  '/log/bloodpressure',
  '/log/bloodwork',
  '/log/body',
  '/log/body-measurements',
  '/log/breastfeeding',
  '/log/caffeine',
  '/log/custom',
  '/log/cycle',
  '/log/digestive',
  '/log/doctor',
  '/log/food',
  '/log/glucose',
  '/log/gratitude',
  '/log/habits',
  '/log/injury',
  '/log/journal',
  '/log/medications',
  '/log/meditation',
  '/log/migraine',
  '/log/mobility',
  '/log/mood',
  '/log/mood-mental',
  '/log/nutrient-report',
  '/log/pain',
  '/log/pantry',
  '/log/perimenopause',
  '/log/personalcare',
  '/log/reps',
  '/log/sexual',
  '/log/sleep',
  '/log/social',
  '/log/strength',
  '/log/stress',
  '/log/substances',
  '/log/sunlight',
  '/log/supplements',
  '/log/therapy',
  '/log/water',
  '/log/wearable',
  '/log/workout',
]);

/**
 * Validate that every tile route resolves to a known log route. Returns
 * the offenders (empty array means all good). Pure, no side effects.
 */
export function findUnresolvableTileRoutes(): DashboardTile[] {
  return ALL_DASHBOARD_TILES.filter((t) => !KNOWN_LOG_ROUTES.has(t.route));
}

/**
 * Resolve the user's selection into a list of tiles to render.
 * Filters out tiles whose tagGate category is disabled, then fills any
 * remaining slots from the priority list and the full registry (deduped),
 * capped at MAX_DASHBOARD_TILES.
 */
export function resolveVisibleTiles(
  selection: string[],
  enabledTags: string[],
): DashboardTile[] {
  const isAvailable = (tile: DashboardTile): boolean =>
    tile.tagGate === null || enabledTags.includes(tile.tagGate);

  const seen = new Set<string>();
  const result: DashboardTile[] = [];

  const pushIfAvailable = (id: string) => {
    if (seen.has(id)) return;
    const tile = getTileById(id);
    if (tile == null || !isAvailable(tile)) return;
    seen.add(id);
    result.push(tile);
  };

  for (const id of selection) pushIfAvailable(id);
  if (result.length >= MAX_DASHBOARD_TILES) return result.slice(0, MAX_DASHBOARD_TILES);

  for (const id of PRIORITY_FILL_ORDER) {
    if (result.length >= MAX_DASHBOARD_TILES) break;
    pushIfAvailable(id);
  }

  for (const tile of ALL_DASHBOARD_TILES) {
    if (result.length >= MAX_DASHBOARD_TILES) break;
    pushIfAvailable(tile.id);
  }

  return result;
}
