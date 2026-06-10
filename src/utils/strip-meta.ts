/**
 * Recursively strip internal metadata from API responses.
 * Used by Knowledge Graph toolsets to keep response payloads clean.
 */
export function stripInternalMeta(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripInternalMeta);
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
