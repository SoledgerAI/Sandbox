// Token estimation utility for monitoring Coach prompt size
// Heuristic only — not for billing (API response has actual usage)

/**
 * Estimate token count using chars/4 heuristic.
 * Rough but sufficient for monitoring prompt size over time.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
