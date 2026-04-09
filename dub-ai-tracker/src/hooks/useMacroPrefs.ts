// User-configurable macro display preferences
// Sprint 14: Let users choose which nutrition fields to track

import { useState, useEffect, useCallback } from 'react';
import { storageGet, storageSet, STORAGE_KEYS } from '../utils/storage';

export type MacroKey =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'addedSugar'
  | 'fiber'
  | 'sodium'
  | 'cholesterol'
  | 'saturatedFat'
  | 'transFat';

export interface MacroOption {
  key: MacroKey;
  label: string;
  unit: string;
  alwaysOn?: boolean; // calories is always on
}

export const ALL_MACRO_OPTIONS: MacroOption[] = [
  { key: 'calories', label: 'Calories', unit: '', alwaysOn: true },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'addedSugar', label: 'Added Sugar', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg' },
  { key: 'saturatedFat', label: 'Saturated Fat', unit: 'g' },
  { key: 'transFat', label: 'Trans Fat', unit: 'g' },
];

const DEFAULT_MACROS: MacroKey[] = ['calories', 'protein', 'carbs', 'fat'];

export function useMacroPrefs() {
  const [selectedMacros, setSelectedMacros] = useState<MacroKey[]>(DEFAULT_MACROS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storageGet<MacroKey[]>(STORAGE_KEYS.USER_MACROS).then((saved) => {
      if (saved && saved.length > 0) {
        // Ensure calories is always included
        const withCalories: MacroKey[] = saved.includes('calories') ? saved : ['calories' as MacroKey, ...saved];
        setSelectedMacros(withCalories);
      }
      setLoading(false);
    });
  }, []);

  const toggleMacro = useCallback(async (key: MacroKey) => {
    if (key === 'calories') return; // Cannot disable calories
    setSelectedMacros((prev) => {
      const next: MacroKey[] = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      storageSet(STORAGE_KEYS.USER_MACROS, next);
      return next;
    });
  }, []);

  const isMacroEnabled = useCallback(
    (key: MacroKey) => selectedMacros.includes(key),
    [selectedMacros],
  );

  return { selectedMacros, toggleMacro, isMacroEnabled, loading };
}
