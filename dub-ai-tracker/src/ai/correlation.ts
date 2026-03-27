// Cross-tag correlation analysis
// Phase 14: AI Coach
// Implements Spearman rank correlation for Tier 3 analysis

/**
 * Compute Spearman rank correlation coefficient (rho) for two arrays.
 * Returns { rho, significant } where significant is true if |rho| >= 0.4
 * and approximate p < 0.05 (using t-distribution approximation).
 */
export function spearmanCorrelation(x: number[], y: number[]): { rho: number; significant: boolean } {
  const n = x.length;
  if (n < 3 || x.length !== y.length) {
    return { rho: 0, significant: false };
  }

  const rankX = computeRanks(x);
  const rankY = computeRanks(y);

  // Compute Spearman rho using rank differences
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rankX[i] - rankY[i];
    sumD2 += d * d;
  }

  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));

  // Approximate significance test using t-distribution
  // t = rho * sqrt((n - 2) / (1 - rho^2))
  // For p < 0.05, two-tailed, use critical t values
  const significant = isSignificant(rho, n);

  return { rho, significant };
}

function computeRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ value: v, index: i }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    // Find ties
    while (j < indexed.length && indexed[j].value === indexed[i].value) {
      j++;
    }
    // Assign average rank to ties
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].index] = avgRank;
    }
    i = j;
  }

  return ranks;
}

function isSignificant(rho: number, n: number): boolean {
  if (Math.abs(rho) < 0.4) return false;
  if (n < 5) return false;

  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));

  // Critical t values for two-tailed p < 0.05
  // Approximate: for df >= 30, critical t ≈ 2.042; for smaller df, use lookup
  const df = n - 2;
  const criticalT = df >= 30 ? 2.042 : df >= 20 ? 2.086 : df >= 15 ? 2.131 : df >= 10 ? 2.228 : df >= 5 ? 2.571 : 4.303;

  return Math.abs(t) >= criticalT;
}

/**
 * Compare two groups of values by computing difference in means.
 * Returns { diff, diffPct, group1Avg, group2Avg }.
 */
export function groupComparison(group1: number[], group2: number[]): {
  diff: number;
  diffPct: number;
  group1Avg: number;
  group2Avg: number;
} | null {
  if (group1.length === 0 || group2.length === 0) return null;

  const avg1 = group1.reduce((a, b) => a + b, 0) / group1.length;
  const avg2 = group2.reduce((a, b) => a + b, 0) / group2.length;
  const diff = avg1 - avg2;
  const baseline = Math.max(Math.abs(avg1), Math.abs(avg2), 1);
  const diffPct = (diff / baseline) * 100;

  return { diff, diffPct, group1Avg: avg1, group2Avg: avg2 };
}

/**
 * Threshold counting (Tier 1): count how often condition + outcome co-occur.
 */
export function thresholdCount(
  conditionMet: boolean[],
  outcomeMet: boolean[],
): { conditionDays: number; bothDays: number; totalDays: number; rate: number } | null {
  if (conditionMet.length !== outcomeMet.length || conditionMet.length < 7) return null;

  const totalDays = conditionMet.length;
  const conditionDays = conditionMet.filter(Boolean).length;
  const bothDays = conditionMet.filter((c, i) => c && outcomeMet[i]).length;
  const rate = conditionDays > 0 ? bothDays / conditionDays : 0;

  return { conditionDays, bothDays, totalDays, rate };
}
