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
 * - Arrays of strings are canonicalized element-by-element (some list filters,
 *   e.g. fme_experiment's status, are passed as arrays rather than CSV strings)
 * - Other non-string values are left untouched (typed filters stay as-is)
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
    const canonicalByLower = new Map(field.enum.map((v) => [v.toLowerCase(), v]));

    if (Array.isArray(raw)) {
      let changed = false;
      const canonicalized = raw.map((part) => {
        if (typeof part !== "string") return part;
        const canonical = canonicalByLower.get(part.toLowerCase());
        if (canonical === undefined || canonical === part) return part;
        changed = true;
        return canonical;
      });
      if (changed) input[field.name] = canonicalized;
      continue;
    }

    if (typeof raw !== "string") continue;

    const hasMultiple = raw.includes(",");
    const parts = hasMultiple
      ? raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : [raw.trim()];

    if (parts.length === 0) continue;

    let changed = false;
    const canonicalized = parts.map((part) => {
      const canonical = canonicalByLower.get(part.toLowerCase());
      if (canonical === undefined || canonical === part) return part;
      changed = true;
      return canonical;
    });

    if (!changed) continue;
    input[field.name] = hasMultiple ? canonicalized.join(",") : canonicalized[0]!;
  }
}
