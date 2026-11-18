/**
 * Standard MCP response formatters.
 *
 * Uses compact JSON (no indentation) to minimize token count for LLM consumers.
 * Errors keep minimal formatting for readability in tool-call error surfaces.
 */

export type ContentItem = { type: "text"; text: string };

export interface ToolResult {
  /** Required: MCP SDK's CallToolResult extends Result which has an index signature. */
  [key: string]: unknown;
  content: ContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

/**
 * True when an object at the end of a list array is a synthetic metadata/hint
 * trailer (every key starts with `_`, e.g. `{ _summary }`, `{ _total_cves, _reminder }`,
 * `{ _next_step }`) rather than a real resource entity.
 */
function isTrailingMetadataObject(item: unknown): item is Record<string, unknown> {
  if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
  const keys = Object.keys(item as Record<string, unknown>);
  return keys.length > 0 && keys.every((k) => k.startsWith("_"));
}

/**
 * Coerce registry list payloads into the `{ items, total?, page? }` shape expected by
 * `harness_list`'s output schema and MCP `structuredContent` (objects only — raw arrays
 * cannot be sent as structured content).
 *
 * If an extractor appended a synthetic `_`-prefixed metadata trailer to the end
 * of a bare array, hoist those `_` keys onto the top-level envelope so `items`
 * contains only real entities and `total` is not inflated by +1.
 */
export function normalizeHarnessListPayload(
  result: unknown,
  options?: { page?: number },
): unknown {
  const page = options?.page;
  if (Array.isArray(result)) {
    const last = result.length > 0 ? result[result.length - 1] : undefined;
    if (isTrailingMetadataObject(last)) {
      const items = result.slice(0, -1);
      return {
        ...last,
        items,
        total: items.length,
        ...(page !== undefined ? { page } : {}),
      };
    }
    return {
      items: result,
      total: result.length,
      ...(page !== undefined ? { page } : {}),
    };
  }
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    const r = result as Record<string, unknown>;
    if (!Array.isArray(r.items)) {
      for (const key of ["body", "content", "data", "objects", "features"] as const) {
        const arr = r[key];
        if (Array.isArray(arr)) {
          const total = typeof r.total === "number" ? r.total : arr.length;
          return {
            ...r,
            items: arr,
            total,
            ...(page !== undefined && r.page === undefined ? { page } : {}),
          };
        }
      }
    } else if (Array.isArray(r.items) && r.total === undefined) {
      return { ...r, total: r.items.length };
    }
  }
  return result;
}

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    // MCP structuredContent must be an object; arrays and primitives are intentionally excluded.
    ...(data !== null && typeof data === "object" && !Array.isArray(data)
      ? { structuredContent: data as Record<string, unknown> }
      : {}),
  };
}

export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
