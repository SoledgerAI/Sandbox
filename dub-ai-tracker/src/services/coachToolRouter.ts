// Sprint 30: Coach tool tier router
// Pure function — no side effects, no React, no storage. Classifies a tool
// call into one of three confirmation tiers so the chat UI can decide whether
// to auto-commit, render a checklist, or require explicit confirmation.

import type { CoachToolName, ExtractionSource, ToolTier } from '../types/coach';

export interface ClassifyTierInput {
  toolName: CoachToolName;
  toolInput: Record<string, unknown>;
  userMessageHadImage: boolean;
  userMessageText: string;
  /**
   * Caller may override the inferred extraction source. If omitted, the
   * router defaults to `image_vision` when an image was attached and
   * `user_text` otherwise.
   */
  extractionSource?: ExtractionSource;
}

/**
 * Internal field-counter — counts non-null/non-undefined input fields
 * EXCLUDING bookkeeping fields (source, extraction_source, timestamp).
 */
function countMeaningfulFields(input: Record<string, unknown>): number {
  const skip = new Set(['source', 'extraction_source', 'timestamp']);
  let n = 0;
  for (const [k, v] of Object.entries(input)) {
    if (skip.has(k)) continue;
    if (v == null) continue;
    if (typeof v === 'string' && v.length === 0) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    n++;
  }
  return n;
}

function resolveExtractionSource(input: ClassifyTierInput): ExtractionSource {
  if (input.extractionSource) return input.extractionSource;
  const inSchema = input.toolInput.extraction_source;
  if (inSchema === 'user_text' || inSchema === 'image_vision' || inSchema === 'inferred') {
    return inSchema;
  }
  return input.userMessageHadImage ? 'image_vision' : 'user_text';
}

export function classifyTier(input: ClassifyTierInput): ToolTier {
  const extraction = resolveExtractionSource(input);

  // RULE 1 — explicit (highest caution)
  // Future-proof for delete_*/reset_* tools that don't exist yet.
  if (input.toolName.startsWith('delete_') || input.toolName.startsWith('reset_')) {
    return 'explicit';
  }
  // Substance use must be confirmed when the source is an image — never
  // auto-log alcohol or cannabis from a photo alone.
  if (input.toolName === 'log_substance') {
    const cat = input.toolInput.category;
    if ((cat === 'alcohol' || cat === 'cannabis') && extraction === 'image_vision') {
      return 'explicit';
    }
  }

  // RULE 1.5 (Sprint 31) — wearable recovery metrics from a photo/scan
  // always require checklist confirmation regardless of field count.
  // Recovery uses its own extraction_source enum ('image' | 'text' |
  // 'wearable_scan'), so we read the raw input value rather than going
  // through resolveExtractionSource which is keyed on the older enum.
  if (input.toolName === 'log_recovery_metrics') {
    const src = input.toolInput.extraction_source;
    if (src === 'image' || src === 'wearable_scan') {
      return 'checklist';
    }
  }

  // RULE 2 — checklist (multi-field or image-derived)
  if (input.userMessageHadImage) return 'checklist';
  if (countMeaningfulFields(input.toolInput) >= 3) return 'checklist';

  // RULE 3 — auto_commit (single explicit field)
  return 'auto_commit';
}

/** Exported for tests / for consumers that want to display source attribution. */
export { resolveExtractionSource };
