export interface WaterEntry {
  id: string;
  amount: number; // oz
  timestamp: string; // ISO 8601
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  water: WaterEntry[];
}

export interface UserProfile {
  name: string;
  age: number;
  sex: 'male' | 'female';
  heightFeet: number;
  heightInches: number;
  currentWeight: number; // lbs
  goalWeight: number; // lbs
  activityLevel: string;
}
