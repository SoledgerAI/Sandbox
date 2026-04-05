// Curated activity library for DUB_AI Tracker
// 25 activities organized by category with MET values
// Source: Herrmann et al., JSHS 2024 (pacompendium.com) — values rounded for UX clarity

export type ActivityCategory =
  | 'RUN'
  | 'RIDE'
  | 'SWIM'
  | 'WALK'
  | 'STRENGTH'
  | 'CARDIO'
  | 'SPORT'
  | 'OTHER';

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  met: number;
  hasLoadFactor?: boolean;    // activity uses pack weight MET adjustment (e.g. rucking)
  supportsRepCount?: boolean; // enables push/rep count logging (e.g. wheelchair)
}

export const ACTIVITY_CATEGORIES: { key: ActivityCategory; label: string }[] = [
  { key: 'RUN', label: 'Run' },
  { key: 'RIDE', label: 'Ride' },
  { key: 'SWIM', label: 'Swim' },
  { key: 'WALK', label: 'Walk' },
  { key: 'STRENGTH', label: 'Strength' },
  { key: 'CARDIO', label: 'Cardio' },
  { key: 'SPORT', label: 'Sport' },
  { key: 'OTHER', label: 'Other' },
];

export const ACTIVITIES: Activity[] = [
  // RUN
  { id: 'run_outdoor', name: 'Run (outdoor)', category: 'RUN', met: 9.8 },
  { id: 'run_treadmill', name: 'Run (treadmill)', category: 'RUN', met: 9.0 },
  { id: 'trail_run', name: 'Trail run', category: 'RUN', met: 10.0 },

  // RIDE
  { id: 'ride_outdoor', name: 'Ride (outdoor)', category: 'RIDE', met: 7.5 },
  { id: 'ride_indoor', name: 'Ride (indoor / trainer)', category: 'RIDE', met: 6.8 },
  { id: 'mountain_bike', name: 'Mountain bike', category: 'RIDE', met: 8.5 },
  { id: 'ebike', name: 'E-bike ride', category: 'RIDE', met: 4.0 },

  // SWIM
  { id: 'swim_pool', name: 'Swim (pool)', category: 'SWIM', met: 7.0 },
  { id: 'swim_open', name: 'Swim (open water)', category: 'SWIM', met: 8.0 },

  // WALK
  { id: 'walk', name: 'Walk', category: 'WALK', met: 3.5 },
  { id: 'hike', name: 'Hike', category: 'WALK', met: 6.0 },
  // Rucking — Pandolf et al., 1977 load carriage model; base MET adjusted by pack weight
  { id: 'ruck', name: 'Rucking', category: 'WALK', met: 4.5, hasLoadFactor: true },

  // STRENGTH
  { id: 'weight_training', name: 'Weight training', category: 'STRENGTH', met: 5.0 },
  { id: 'crossfit_hiit', name: 'CrossFit / HIIT', category: 'STRENGTH', met: 8.0 },
  { id: 'bodyweight', name: 'Bodyweight / calisthenics', category: 'STRENGTH', met: 4.5 },

  // CARDIO
  { id: 'rowing', name: 'Rowing (machine)', category: 'CARDIO', met: 7.0 },
  { id: 'elliptical', name: 'Elliptical', category: 'CARDIO', met: 5.0 },
  { id: 'stair_climber', name: 'Stair climber', category: 'CARDIO', met: 9.0 },

  // SPORT
  { id: 'yoga', name: 'Yoga', category: 'SPORT', met: 3.0 },
  { id: 'pilates', name: 'Pilates', category: 'SPORT', met: 3.5 },
  { id: 'golf', name: 'Golf (walking)', category: 'SPORT', met: 4.3 },
  { id: 'tennis', name: 'Tennis', category: 'SPORT', met: 7.3 },
  { id: 'pickleball', name: 'Pickleball', category: 'SPORT', met: 5.5 },
  { id: 'basketball', name: 'Basketball', category: 'SPORT', met: 6.5 },
  { id: 'soccer', name: 'Soccer', category: 'SPORT', met: 7.0 },

  // ADAPTIVE — Collins et al., Adapted Physical Activity Quarterly, 2010
  { id: 'wheelchair_push', name: 'Wheelchair Pushing', category: 'CARDIO', met: 3.5, supportsRepCount: true },
  { id: 'handcycle', name: 'Hand Cycling', category: 'RIDE', met: 5.0 },
  { id: 'wheelchair_basketball', name: 'Wheelchair Basketball', category: 'SPORT', met: 6.5 },

  // OTHER
  { id: 'stretching', name: 'Stretching / mobility', category: 'OTHER', met: 2.5 },
  { id: 'other', name: 'Other', category: 'OTHER', met: 4.0 },
];

/** Look up an activity by its ID */
export function getActivityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

/** Get activities grouped by category in display order */
export function getActivitiesByCategory(): { category: ActivityCategory; label: string; activities: Activity[] }[] {
  return ACTIVITY_CATEGORIES.map(({ key, label }) => ({
    category: key,
    label,
    activities: ACTIVITIES.filter((a) => a.category === key),
  }));
}
