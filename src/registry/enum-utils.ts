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
 * - Exact / case-insensitive match → rewrite to the declared enum value
 * - Comma-separated multi-values are canonicalized token-by-token
 * - Unknown values fail loud with the allowed set (never silently dropped)
 * - Non-string values are left untouched (typed filters stay as-is)
 */
export function canonicalizeListFilterEnums(
  resourceType: string,
  input: Record<string, unknown>,
  fields: FilterFieldSpec[],
): void {
  for (const field of fields) {
    if (!field.enum?.length) continue;
    const raw = input[field.name];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== "string") continue;

    const canonicalByLower = new Map(field.enum.map((v) => [v.toLowerCase(), v]));
    const parts = raw.includes(",")
      ? raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
      : [raw.trim()];

    if (parts.length === 0) continue;

    const canonicalized: string[] = [];
    for (const part of parts) {
      const canonical = canonicalByLower.get(part.toLowerCase());
      if (!canonical) {
        throw new Error(
          `${resourceType}: invalid '${field.name}' value '${part}'. ` +
            `Must be one of: ${field.enum.join(", ")}. ` +
            `Use harness_describe(resource_type="${resourceType}") for filter details.`,
        );
      }
      canonicalized.push(canonical);
    }

    input[field.name] = raw.includes(",")
      ? canonicalized.join(",")
      : canonicalized[0]!;
  }
}
