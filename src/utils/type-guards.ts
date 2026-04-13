/**
 * Runtime type guards for safe narrowing at API boundaries.
 * Use these instead of `as Record<string, unknown>` when the source is external (API responses, user input).
 */

/** Narrow `unknown` to `Record<string, unknown>` with a runtime check. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Safely access a nested record field, returning undefined if the path is not a record. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

/** Safely coerce to string, returning undefined for non-strings. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Safely coerce to number, returning undefined for non-numbers. */
export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/**
 * Coerce a value to a Record.  LLMs sometimes serialize nested objects as JSON
 * strings (e.g. `params: '{"artifact_id":"..."}' `) instead of actual objects.
 * This helper transparently parses JSON strings into records so downstream code
 * can always treat them uniformly.
 */
export function coerceRecord(value: unknown): Record<string, unknown> | undefined {
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (isRecord(parsed)) return parsed;
    } catch { /* not valid JSON — ignore */ }
  }
  return undefined;
}
