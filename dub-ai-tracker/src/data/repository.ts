// DataRepository abstraction (MASTER-12)
// Provides a storage-agnostic interface for v2 migration to SQLite + cloud sync.
// Services should use this interface; the current implementation delegates to AsyncStorage.

export interface DataRepository {
  // Core CRUD
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;

  // Batch operations
  getMultiple<T>(keys: string[]): Promise<Record<string, T | null>>;
  setMultiple<T>(entries: Record<string, T>): Promise<void>;

  // Date-partitioned helpers
  getForDate<T>(prefix: string, date: string): Promise<T | null>;
  setForDate<T>(prefix: string, date: string, value: T): Promise<void>;
  getDateRange<T>(prefix: string, startDate: string, endDate: string): Promise<Record<string, T>>;
}
