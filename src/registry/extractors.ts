/**
 * Shared response extractors for Harness API responses.
 * Used across all toolset definitions — eliminates per-file duplication.
 */
import { isRecord } from "../utils/type-guards.js";
import { parseZipCsv } from "../utils/zip-csv.js";

/** Extract `data` from standard NG API responses: `{ status, data, ... }` */
export const ngExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw;
  const r = raw as { data?: unknown };
  return r.data ?? raw;
};

/** Extract paginated content from NG API responses: `{ data: { content, totalElements|totalItems } }` */
export const pageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { content?: unknown[]; totalElements?: number; totalItems?: number } };
  return {
    items: r.data?.content ?? [],
    total: r.data?.totalElements ?? r.data?.totalItems ?? 0,
  };
};

/** Pass-through extractor — returns raw response unchanged. Used for APIs that don't wrap in `data`. */
export const passthrough = (raw: unknown): unknown => raw;

/**
 * STO Global Exemptions extractor.
 * API response: `{ exemptions: [...], pagination: { page, pageSize, totalPages, totalItems }, counts: {...} }`
 * Projects each exemption to a clean, display-friendly shape (issue title, severity, requester name,
 * target name, etc.) so the LLM picks the right columns and skips the opaque IDs. Normalized to the
 * standard `{ items, total, page, pageSize, totalPages, counts }` shape used by all other paginated
 * resources, with an explicit `_nextPageHint` so pagination can't be misinterpreted.
 */
export const stoExemptionsExtract = (raw: unknown, input?: Record<string, unknown>): unknown => {
  type Exemption = {
    id?: string;
    status?: string;
    reason?: string;
    type?: string;
    scope?: string;
    expiration?: number;
    created?: number;
    targetName?: string;
    requesterName?: string;
    requesterEmail?: string;
    approverName?: string;
    approverEmail?: string;
    numOccurrences?: number;
    totalOccurrences?: number;
    issueSummary?: { title?: string; severity?: number; severityCode?: string; lastDetected?: number };
  };
  const r = raw as {
    exemptions?: Exemption[];
    pagination?: { page?: number; pageSize?: number; totalPages?: number; totalItems?: number };
    counts?: unknown;
  };
  const page = r.pagination?.page ?? 0;
  const pageSize = r.pagination?.pageSize ?? 5;
  const totalPages = r.pagination?.totalPages ?? 0;
  const total = r.pagination?.totalItems ?? (r.exemptions?.length ?? 0);
  const hasMore = page + 1 < totalPages;
  const exemptions = r.exemptions ?? [];
  const items = exemptions.map((e) => ({
    issue_title: e.issueSummary?.title,
    severity: e.issueSummary?.severityCode,
    type: e.type,
    status: e.status,
    requested_by: e.requesterName,
    target: e.targetName || undefined,
    scope: e.scope,
    reason: e.reason || undefined,
    approved_by: e.approverName || undefined,
    created_at: e.created,
    expires_at: e.expiration,
    occurrences: e.numOccurrences,
  }));
  // Keep IDs OUT of the items so the LLM can't accidentally render them as a column.
  // Provide them in a separate lookup keyed by row index (1-based) for approve/reject actions.
  const _action_id_by_row: Record<number, string> = {};
  exemptions.forEach((e, idx) => { if (e.id) _action_id_by_row[idx + 1] = e.id; });

  // Reconstruct the active filter set from the actual request input so the
  // next-page hint paginates the SAME query. Dropping any of these would
  // switch the underlying dataset on the next call (Cursor review feedback).
  const filterKeys = ["status", "search"] as const;
  const activeFilters: Record<string, unknown> = {};
  if (input) {
    for (const key of filterKeys) {
      const v = input[key];
      if (v !== undefined && v !== "" && v !== null) activeFilters[key] = v;
    }
  }
  const filterJson = JSON.stringify({ ...activeFilters, page: page + 1, size: pageSize });

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    counts: r.counts,
    _action_id_by_row,
    _display_hint: "Render a compact table with columns: # | Issue Title | Severity | Type | Requested by | Target | Status. NEVER add an 'ID' column — the items contain no ID field by design. If the user asks to approve/reject row N, look up the ID in _action_id_by_row[N].",
    _nextPageHint: hasMore
      ? `For the next page, call harness_list with resource_type='security_exemption' and filters=${filterJson}. You MUST keep size=${pageSize} and ALL other filters identical — the backend computes offset = page × size, so changing size or dropping filters silently shifts the dataset. Pages remaining: ${totalPages - page - 1}.`
      : "No more pages — all exemptions have been returned.",
  };
};

/**
 * AI Evals control plane — paginated list: `{ data, page, limit, total_elements }`.
 */
export const aiEvalsListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; total_elements?: number };
  return {
    items: r.data ?? [],
    total: r.total_elements ?? 0,
  };
};

/**
 * AI Evals — bare array response (e.g. suite evaluations, metric set entries list).
 */
export const aiEvalsArrayExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const arr = Array.isArray(raw) ? raw : [];
  return { items: arr, total: arr.length };
};

/**
 * SCS-specific extractor — strips null, undefined, empty string, empty array,
 * and empty object fields recursively from API responses. SCS payloads contain
 * ~40% empty/null fields; removing them yields significant token savings.
 */
export const scsCleanExtract = (raw: unknown): unknown => {
  return stripEmptyFields(raw);
};

/**
 * Factory: SCS list extractor that strips empty fields AND selects only specified
 * fields from each item. Builds on scsCleanExtract to further reduce token usage
 * for list responses by keeping only actionable fields (IDs, names, counts, scores).
 *
 * @param fields - field names to retain from each list item
 */
export const scsListExtract = (fields: string[]) => (raw: unknown): unknown => {
  const cleaned = stripEmptyFields(raw);
  if (!Array.isArray(cleaned)) return cleaned;
  return cleaned.map(item => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      return pickFields(item as Record<string, unknown>, fields);
    }
    return item;
  });
};

function pickFields(obj: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj && obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}

function stripEmptyFields(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripEmptyFields);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      if (value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      const cleaned = stripEmptyFields(value);
      if (typeof cleaned === "object" && cleaned !== null && !Array.isArray(cleaned)
        && Object.keys(cleaned as Record<string, unknown>).length === 0) continue;
      result[key] = cleaned;
    }
    return result;
  }
  return obj;
}

/**
 * Factory for HAR (Artifact Registry) list responses.
 * HAR wraps lists as `{ data: { <arrayKey>: [...], itemCount, pageIndex, ... }, status }`.
 * Normalizes to `{ items, total, pageIndex, pageSize, pageCount }` so the deep link
 * code can find the list via `LIST_ARRAY_KEYS`.
 */
export const harListExtract = (arrayKey: string) => (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  const data = r.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    return {
      items: (d[arrayKey] as unknown[]) ?? [],
      total: (d.itemCount as number) ?? 0,
      pageIndex: d.pageIndex,
      pageSize: d.pageSize,
      pageCount: d.pageCount,
    };
  }
  return raw;
};

/**
 * Factory for v1 list responses (bare arrays).
 * If `wrapperKey` is provided, each item is unwrapped: `{ project: {...} }` → `{...}`.
 * Total is derived from array length since response headers aren't accessible.
 */
export const v1ListExtract = (wrapperKey?: string) => (raw: unknown): { items: unknown[]; total: number } => {
  const arr = Array.isArray(raw) ? raw : [];
  const items = wrapperKey
    ? arr.map(item => (isRecord(item) && wrapperKey in item ? item[wrapperKey] : item))
    : arr;
  return { items, total: items.length };
};

/** Factory for v1 single-item responses that may be wrapped: `{ org: {...} }` → `{...}`. */
export const v1Unwrap = (wrapperKey: string) => (raw: unknown): unknown => {
  if (isRecord(raw) && wrapperKey in raw) {
    return raw[wrapperKey];
  }
  return raw;
};

/**
 * Organization GET/POST/PUT responses: unwrap standard NG `{ status, data: { organization } }`
 * and prefer `organization` over legacy `org` when both could appear.
 */
export const unwrapOrgResponse = (raw: unknown): unknown => {
  const inner = ngExtract(raw);
  if (isRecord(inner)) {
    if ("organization" in inner && inner.organization !== null && typeof inner.organization === "object") {
      return inner.organization;
    }
    if ("org" in inner && inner.org !== null && typeof inner.org === "object") {
      return inner.org;
    }
  }
  return inner;
};

/**
 * Project GET/POST/PUT responses: unwrap NG `{ status, data: { project } }` → project entity.
 */
export const unwrapProjectResponse = (raw: unknown): unknown => {
  const inner = ngExtract(raw);
  if (isRecord(inner) && "project" in inner && inner.project !== null && typeof inner.project === "object") {
    return inner.project;
  }
  return inner;
};

/**
 * Project LIST responses: unwrap NG `{ data: { content: [{ project: {...} }, ...] } }`.
 * Each item in `content` is wrapped in a `{ project: {...} }` envelope — unwrap to
 * expose `identifier`, `name`, `orgIdentifier` directly on each item.
 */
export const projectListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { content?: unknown[]; totalElements?: number; totalItems?: number } };
  const rawItems = r.data?.content ?? [];
  const items = rawItems.map(item => {
    if (isRecord(item) && "project" in item && item.project !== null && typeof item.project === "object") {
      return item.project;
    }
    return item;
  });
  return {
    items,
    total: r.data?.totalElements ?? r.data?.totalItems ?? 0,
  };
};

/** Factory for GraphQL field extraction (used by CCM). */
export const gqlExtract = (field: string) => (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  return r.data?.[field] ?? raw;
};

/**
 * Extracts the runtime input template from the Harness pipeline template endpoint.
 * Unwraps `data.inputSetTemplateYaml`, `data.hasInputSets`, `data.modules`, and adds
 * a `_hint` field describing whether inputs are required.
 */
export const runtimeInputExtract = (raw: unknown): unknown => {
  const r = raw as { data?: { inputSetTemplateYaml?: string; hasInputSets?: boolean; modules?: string[] } };
  return {
    inputSetTemplateYaml: r.data?.inputSetTemplateYaml ?? null,
    hasInputSets: r.data?.hasInputSets ?? false,
    modules: r.data?.modules ?? [],
    _hint: r.data?.inputSetTemplateYaml
      ? "This YAML template shows all runtime inputs needed. Fields with '<+input>' are required. Pass matching key-value pairs to harness_execute(action='run', inputs={...})."
      : "This pipeline has no runtime inputs. You can execute it without providing any inputs.",
  };
};

/**
 * Extracts CCM list responses with views/totalCount structure.
 * Maps `data.views` → `items` and `data.totalCount` → `total`.
 * Used by multiple CCM APIs that return this response pattern.
 */
export const ccmViewsExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { views?: unknown[]; totalCount?: number } };
  return {
    items: r.data?.views ?? [],
    total: r.data?.totalCount ?? 0,
  };
};

/**
 * Extracts CCM cost breakdown data from GraphQL perspectiveGrid response.
 * Maps `data.perspectiveGrid.data` → `items` and `data.perspectiveTotalCount` → `total`.
 */
export const ccmBreakdownExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as {
    data?: {
      perspectiveGrid?: { data?: unknown[] };
      perspectiveTotalCount?: number;
    };
  };
  return {
    items: r.data?.perspectiveGrid?.data ?? [],
    total: r.data?.perspectiveTotalCount ?? 0,
  };
};

/**
 * Extracts CCM cost time series stats from GraphQL perspectiveTimeSeriesStats response.
 * Returns the `stats` array from `data.perspectiveTimeSeriesStats.stats`.
 */
export const ccmTimeseriesExtract = (raw: unknown): unknown => {
  const r = raw as {
    data?: { perspectiveTimeSeriesStats?: { stats?: unknown[] } };
  };
  return r.data?.perspectiveTimeSeriesStats?.stats ?? [];
};

/**
 * Extracts CCM cost summary from a dual-mode GraphQL response.
 * When `data.ccmMetaData` is present (metadata query), returns it directly.
 * Otherwise returns `{ trendStats, forecastCost }` for a perspective summary query.
 */
export const ccmSummaryExtract = (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  if (!r.data) return raw;
  if (r.data.ccmMetaData) return r.data.ccmMetaData;
  return {
    trendStats: r.data.perspectiveTrendStats,
    forecastCost: r.data.perspectiveForecastCost,
  };
};

/**
 * Extracts CCM perspective-scoped recommendations from GraphQL response.
 * Returns `{ items, stats }` from `data.recommendationsV2` and `data.recommendationStatsV2`.
 */
export const ccmRecommendationsExtract = (raw: unknown): { items: unknown[]; stats: unknown } => {
  const r = raw as {
    data?: {
      recommendationsV2?: { items?: unknown[] };
      recommendationStatsV2?: unknown;
    };
  };
  return {
    items: r.data?.recommendationsV2?.items ?? [],
    stats: r.data?.recommendationStatsV2,
  };
};

/** Extract dashboard list response: `{ items, pages, resource }` */
export const dashboardListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { items?: number; pages?: number; resource?: unknown[] };
  return {
    items: r.resource ?? [],
    total: r.items ?? 0,
  };
};

/**
 * Extracts dashboard data from a ZIP ArrayBuffer containing CSVs.
 * Matches v1 `get_dashboard_data` behavior: ZIP → CSV → structured JSON tables.
 */
export const dashboardDataExtract = (raw: unknown): unknown => {
  if (raw instanceof ArrayBuffer) {
    return parseZipCsv(raw);
  }
  return raw;
};

// ---------------------------------------------------------------------------
// Chaos Engineering extractors
// ---------------------------------------------------------------------------

/**
 * Extract chaos paginated list response: { data: [...], pagination: { totalItems } }
 * Used by chaos experiments and templates.
 */
export const chaosPageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; pagination?: { totalItems?: number } };
  return {
    items: r.data ?? [],
    total: r.pagination?.totalItems ?? (Array.isArray(r.data) ? r.data.length : 0),
  };
};

/**
 * Extract chaos service-usage list: { serviceData, serviceTypes, total }.
 * Normalises to the standard { items, total } shape and preserves the
 * `serviceTypes` enum so agents can discover valid service_type filter values
 * without an extra call.
 */
export const chaosServiceUsageExtract = (raw: unknown): { items: unknown[]; total: number; serviceTypes: string[] } => {
  const r = raw as { serviceData?: unknown[]; serviceTypes?: string[]; total?: number };
  return {
    items: r.serviceData ?? [],
    total: r.total ?? (Array.isArray(r.serviceData) ? r.serviceData.length : 0),
    serviceTypes: r.serviceTypes ?? [],
  };
};

/**
 * Extract chaos probe list response: { totalNoOfProbes, data: [...] }
 */
export const chaosProbeListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; totalNoOfProbes?: number };
  return {
    items: r.data ?? [],
    total: r.totalNoOfProbes ?? (Array.isArray(r.data) ? r.data.length : 0),
  };
};

/**
 * Extract chaos infrastructure list response: { totalNoOfInfras, infras: [...] }
 */
export const chaosInfraListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { infras?: unknown[]; totalNoOfInfras?: number };
  return {
    items: r.infras ?? [],
    total: r.totalNoOfInfras ?? (Array.isArray(r.infras) ? r.infras.length : 0),
  };
};

/**
 * Extract chaos K8s infrastructure list response:
 * { infras: [...], totalNoOfInfrastructures, pagination }
 */
export const chaosK8sInfraListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { infras?: unknown[]; totalNoOfInfrastructures?: number };
  return {
    items: r.infras ?? [],
    total: r.totalNoOfInfrastructures ?? (Array.isArray(r.infras) ? r.infras.length : 0),
  };
};

/**
 * Extract chaos hub list response: { items: [...], pagination: { totalItems } }
 */
export const chaosHubListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { items?: unknown[]; pagination?: { totalItems?: number } };
  return {
    items: r.items ?? [],
    total: r.pagination?.totalItems ?? (Array.isArray(r.items) ? r.items.length : 0),
  };
};

/** Extract chaos DR test list response: { drtests: [...] } */
export const chaosDRTestListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { drtests?: unknown[] };
  const items = r.drtests ?? [];
  return { items, total: items.length };
};

// ---------------------------------------------------------------------------
// Feature Management Enterprise (FME) extractors
// ---------------------------------------------------------------------------

/**
 * Flattens `trafficType.id` → `trafficTypeId` at the top level of an FME item.
 * Enables deep link templates to reference `trafficTypeId` directly.
 */
export function flattenTrafficType(item: Record<string, unknown>): void {
  const tt = item.trafficType;
  if (tt && typeof tt === "object" && !Array.isArray(tt)) {
    const ttRecord = tt as Record<string, unknown>;
    if (ttRecord.id !== undefined && item.trafficTypeId === undefined) {
      item.trafficTypeId = ttRecord.id;
    }
  }
}

/** Extract FME feature flag list — passthrough with trafficType.id flattened on each item. */
export const fmeListExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const objects = r.objects;
    if (Array.isArray(objects)) {
      for (const item of objects) {
        if (item && typeof item === "object") {
          flattenTrafficType(item as Record<string, unknown>);
        }
      }
    }
  }
  return raw;
};

/** Extract FME feature flag single item — passthrough with trafficType.id flattened. */
export const fmeGetExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object") {
    flattenTrafficType(raw as Record<string, unknown>);
  }
  return raw;
};
