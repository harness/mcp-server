import type { FilterFieldSpec } from "./types.js";

/**
 * Case-insensitively rewrite list-filter values to their canonical enum
 * forms before the request hits the Harness API.
 *
 * Agents often send lowercase (`"pending"`) when APIs require PascalCase
 * (`"Pending"`) or UPPERCASE (`"CONNECTED"`). Enum metadata lives on
 * `listFilterFields` and is surfaced via `harness_describe`, but the
 * global `harness_list` schema cannot encode per-resource enums — so
 * canonicalize here instead of relying on agents to call describe first.
 *
 * - Case-insensitive match → rewrite to the declared enum value
 * - Comma-separated multi-values are canonicalized token-by-token
 * - Non-string values are left untouched (typed filters stay as-is)
 *
 * Values with no case-insensitive match are passed through unchanged.
 * `listFilterFields.enum` is hand-maintained documentation metadata that
 * can lag the API, and some resources apply their own fallback for
 * unrecognized values, so this must not become a validation gate.
 */
export function canonicalizeListFilterEnums(
  input: Record<string, unknown>,
  fields: FilterFieldSpec[],
): void {
  for (const field of fields) {
    if (!field.enum?.length) continue;
    const raw = input[field.name];
    if (typeof raw !== "string") continue;

    const canonicalByLower = new Map(field.enum.map((v) => [v.toLowerCase(), v]));
    const hasMultiple = raw.includes(",");
    const parts = hasMultiple
      ? raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : [raw.trim()];

    if (parts.length === 0) continue;

    // Rewrite only tokens that match a declared enum (case-insensitive). Unknown
    // tokens stay as-is so hand-maintained enum metadata never becomes a gate.
    // Write back whenever the normalized form differs from the raw string so
    // whitespace around a known value (e.g. " Pending") is fixed too — otherwise
    // agents still hit opaque API 400s after a no-op canonicalize pass.
    // Do not trim/rewrite strings that contain no declared enum tokens.
    let matched = false;
    const canonicalized = parts.map((part) => {
      const canonical = canonicalByLower.get(part.toLowerCase());
      if (canonical === undefined) return part;
      matched = true;
      return canonical;
    });
    if (!matched) continue;

    const next = hasMultiple ? canonicalized.join(",") : canonicalized[0]!;
    if (next !== raw) {
      input[field.name] = next;
    }
  }
}
