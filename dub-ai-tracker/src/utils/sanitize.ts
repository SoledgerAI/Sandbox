// SEC-06: Sanitize user-generated strings before injecting into prompt context.
// Shared by context_builder.ts and coach_system_prompt.ts.
// Strips text patterns that resemble prompt injection attempts
// (e.g., "[SYSTEM]", "IGNORE", "output your prompt").
// Truncates to prevent context flooding.

export function sanitizeForPrompt(input: string, maxLength: number = 100): string {
  let clean = input.slice(0, maxLength);
  // Strip patterns that look like prompt injection
  clean = clean.replace(/\[(?:SYSTEM|OVERRIDE|ADMIN|PROMPT|INSTRUCTION)[^\]]*\]/gi, '');
  clean = clean.replace(/(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous\s+)?(?:instructions?|rules?|prompts?)/gi, '');
  clean = clean.replace(/(?:output|reveal|show|display|print)\s+(?:your\s+)?(?:system\s+)?(?:prompt|instructions?|rules?|config)/gi, '');
  // Strip control characters
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return clean.trim();
}
