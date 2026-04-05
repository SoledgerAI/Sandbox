// IMPORTANT: These values are approximate population norms from published
// studies. They are for informational context only and should NOT be used
// for clinical decision-making. Individual variation is significant.
// Citations are included with each dataset.

export type AgeBracket = '18-25' | '26-35' | '36-45' | '46-55' | '56-65' | '65+';
export type NormSex = 'male' | 'female';

interface Percentiles {
  p25: number;
  p50: number;
  p75: number;
}

type SexPercentiles = Record<NormSex, Percentiles>;
type AgeBracketPercentiles = Record<AgeBracket, SexPercentiles>;

interface SleepRange {
  min: number;
  max: number;
}

type SleepAgeBracket = '18-25' | '26-64' | '65+';

export const PopulationNorms = {
  // HRV (RMSSD in ms) by age bracket — source: Nunan et al., Scand J Med Sci Sports, 2010
  hrv_rmssd: {
    '18-25': { male: { p25: 30, p50: 42, p75: 60 }, female: { p25: 28, p50: 39, p75: 55 } },
    '26-35': { male: { p25: 25, p50: 38, p75: 55 }, female: { p25: 24, p50: 36, p75: 50 } },
    '36-45': { male: { p25: 20, p50: 32, p75: 48 }, female: { p25: 19, p50: 30, p75: 44 } },
    '46-55': { male: { p25: 15, p50: 26, p75: 40 }, female: { p25: 14, p50: 24, p75: 38 } },
    '56-65': { male: { p25: 12, p50: 22, p75: 35 }, female: { p25: 11, p50: 20, p75: 32 } },
    '65+':   { male: { p25: 10, p50: 18, p75: 28 }, female: { p25: 9, p50: 16, p75: 25 } },
  } as AgeBracketPercentiles,

  // Resting Heart Rate (bpm) by age bracket — source: Ostchega et al., NHANES 2019
  resting_hr: {
    '18-25': { male: { p25: 58, p50: 66, p75: 74 }, female: { p25: 62, p50: 70, p75: 78 } },
    '26-35': { male: { p25: 58, p50: 66, p75: 74 }, female: { p25: 62, p50: 70, p75: 78 } },
    '36-45': { male: { p25: 60, p50: 68, p75: 76 }, female: { p25: 64, p50: 72, p75: 80 } },
    '46-55': { male: { p25: 60, p50: 68, p75: 76 }, female: { p25: 64, p50: 72, p75: 80 } },
    '56-65': { male: { p25: 58, p50: 66, p75: 74 }, female: { p25: 62, p50: 70, p75: 78 } },
    '65+':   { male: { p25: 56, p50: 64, p75: 72 }, female: { p25: 60, p50: 68, p75: 76 } },
  } as AgeBracketPercentiles,

  // Sleep Duration (hours) by age bracket — source: NSF 2024 guidelines
  sleep_duration: {
    '18-25': { recommended: { min: 7, max: 9 }, acceptable: { min: 6, max: 10 } },
    '26-64': { recommended: { min: 7, max: 9 }, acceptable: { min: 6, max: 10 } },
    '65+':   { recommended: { min: 7, max: 8 }, acceptable: { min: 5, max: 9 } },
  } as Record<SleepAgeBracket, { recommended: SleepRange; acceptable: SleepRange }>,
} as const;

/** Get age bracket from date of birth */
export function getAgeBracket(dateOfBirth: string): AgeBracket {
  const age = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  if (age < 18) return '18-25'; // clamp minors to lowest bracket
  if (age <= 25) return '18-25';
  if (age <= 35) return '26-35';
  if (age <= 45) return '36-45';
  if (age <= 55) return '46-55';
  if (age <= 65) return '56-65';
  return '65+';
}

/** Get sleep age bracket (coarser than HRV/HR brackets) */
export function getSleepAgeBracket(dateOfBirth: string): SleepAgeBracket {
  const age = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
  if (age <= 25) return '18-25';
  if (age <= 64) return '26-64';
  return '65+';
}

/** Get human-readable percentile position */
export function getPercentilePosition(
  value: number,
  p25: number,
  p50: number,
  p75: number,
): string {
  if (value <= p25) return 'Below average';
  if (value <= p50) return 'Average';
  if (value <= p75) return 'Above average';
  return 'Well above average';
}

/** Citation text for population comparisons */
export const POPULATION_NORMS_CITATION =
  'Population averages from published research (Nunan et al. 2010, NHANES 2019, NSF 2024). ' +
  'Individual variation is significant. These are not clinical targets.';
