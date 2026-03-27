// Type stubs - full definitions built in Phase 2
export interface UserProfile {
  name: string;
  dob: string;
  units: 'imperial' | 'metric';
}

export type EngagementTier = 'precision' | 'structured' | 'balanced' | 'flexible' | 'mindful';
