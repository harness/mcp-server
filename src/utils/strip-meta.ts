/**
 * Recursively strip internal metadata from API responses.
 * Used by Knowledge Graph toolsets to keep response payloads clean.
 *
 * Contract:
 *  - Drops null/undefined/empty-string values and `columnMappingMeta` keys.
 *  - Preserves explicitly-empty collections (e.g. `{relationship_types: []}`)
 *    so callers can distinguish "no related types" from a missing field.
 *  - Prunes metadata-only array rows: a row that becomes `{}` after stripping
 *    (e.g. `{columnMappingMeta: {...}}`) is removed rather than left as a
 *    `{}` placeholder, so `{fields: [{columnMappingMeta: {...}}]}` cleans to
 *    `{fields: []}` instead of `{fields: [{}]}`.
 */
export function stripInternalMeta(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj
      .map(stripInternalMeta)
      .filter((item) => !isEmptyObject(item));
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (value === "") continue;
      if (key === "columnMappingMeta") continue;
      if (key === "column_mapping_meta") continue;
      result[key] = stripInternalMeta(value);
    }
    return result;
  }
  return obj;
}

/** True only for a plain object with no own keys — not arrays, not null. */
function isEmptyObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}
