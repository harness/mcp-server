/**
 * Shared response extractors for Harness API responses.
 * Used across all toolset definitions — eliminates per-file duplication.
 */
import YAML from "yaml";
import { asRecord, isRecord } from "../utils/type-guards.js";
import { parseZipCsv } from "../utils/zip-csv.js";
import {
  extractVariableInputMetadata,
  buildStageMetadataMap,
} from "../utils/runtime-input-metadata.js";
import type { PreflightContext } from "./types.js";

/** Extract `data` from standard NG API responses: `{ status, data, ... }` */
export const ngExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw;
  const r = raw as { data?: unknown };
  return r.data ?? raw;
};

/**
 * Extractor for CCM budget/budget-group writes (create, update, clone). These
 * endpoints return the new/affected entity ID as a BARE STRING under `data`:
 * `{ status: "SUCCESS", data: "<budgetId>" }`. The write tools (harness_create
 * etc.) declare an object outputSchema, so a bare string fails structured-content
 * validation. Wrap the id into `{ id, status }` so callers get a usable object.
 * Falls back to ngExtract behavior for object payloads (e.g. DELETE returning
 * `{ data: true }` or a full entity).
 */
export const ccmBudgetWriteExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw;
  const r = raw as { data?: unknown; status?: unknown };
  if (typeof r.data === "string") {
    // create/clone return the new entity id (no spaces); delete returns a
    // human-readable confirmation message (e.g. "Successfully deleted the budget").
    const key = /\s/.test(r.data) ? "message" : "id";
    return { [key]: r.data, status: r.status ?? "SUCCESS" };
  }
  if (typeof r.data === "boolean" || typeof r.data === "number") {
    return { result: r.data, status: r.status ?? "SUCCESS" };
  }
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

/**
 * Spring Data page at the response root (no NG `{ data }` envelope):
 * `{ content, totalElements }`. Used by Release Management (RMG) list APIs.
 */
export const springPageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { content?: unknown[]; totalElements?: number };
  return {
    items: Array.isArray(r.content) ? r.content : [],
    total: typeof r.totalElements === "number" ? r.totalElements : 0,
  };
};

/** Extract `data` from NG API and wrap primitive values in an object for structuredContent compatibility. */
export const countExtract = (raw: unknown): { count: number; _error?: string } => {
  const r = raw as { data?: unknown };
  const value = r.data ?? raw;
  if (typeof value === "number") {
    return { count: value };
  }
  return { count: 0, _error: "Unexpected response shape — data is not a number" };
};

/** Pass-through extractor — returns raw response unchanged. Used for APIs that don't wrap in `data`. */
export const passthrough = (raw: unknown): unknown => raw;

/**
 * Agent APIs return `id` (the UID), not `identifier`. Alias so deep links can
 * resolve `{agentIdentifier}`. Handles:
 * - create/get entity `{ id }`
 * - NG/gateway envelope `{ data: { id } }`
 * - list as a raw array or `{ data: [...] }` (normalized to `{ items, total }`)
 */
export const agentExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw;
  const unwrapped = unwrapAgentPayload(raw);
  if (Array.isArray(unwrapped)) {
    const items = unwrapped.map(aliasAgentItem);
    return { items, total: items.length };
  }
  if (!isRecord(unwrapped)) return unwrapped;
  aliasAgentRecord(unwrapped);
  return unwrapped;
};

function unwrapAgentPayload(raw: unknown): unknown {
  if (!isRecord(raw) || !("data" in raw)) return raw;
  const data = raw.data;
  if (Array.isArray(data)) return data;
  if (isRecord(data) && looksLikeAgent(data)) return data;
  return raw;
}

function looksLikeAgent(record: Record<string, unknown>): boolean {
  return isScalarId(record.id) || isScalarId(record.uid) || isScalarId(record.identifier) || typeof record.name === "string";
}

function isScalarId(value: unknown): value is string | number {
  return (typeof value === "string" && value !== "") || typeof value === "number";
}

/** Alias id/uid onto identifier. Walk nested data/items/content objects, not only arrays. */
function aliasAgentRecord(record: Record<string, unknown>): void {
  aliasAgentIdentifier(record);
  for (const key of ["items", "data", "content"] as const) {
    const val = record[key];
    if (Array.isArray(val)) {
      record[key] = val.map(aliasAgentItem);
    } else if (isRecord(val)) {
      aliasAgentRecord(val);
    }
  }
}

function aliasAgentIdentifier(record: Record<string, unknown>): void {
  if (typeof record.identifier === "string" && record.identifier !== "") return;
  const id = record.id ?? record.uid;
  if (isScalarId(id)) {
    record.identifier = String(id);
  }
}

function aliasAgentItem(item: unknown): unknown {
  if (isRecord(item)) aliasAgentIdentifier(item);
  return item;
}

/** Offset-paginated list (OffsetPaginatedResult): { entities, totalCount } */
export const offsetListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { entities?: unknown[]; totalCount?: number };
  return {
    items: r.entities ?? [],
    total: r.totalCount ?? 0,
  };
};

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
 * STO Remediation DiffOccurrences
 * (`GET /sto/api/v2/remediation-agent/diff-occurrences`).
 *
 * API shape:
 *   { validationScanId, existingOccurrences: [...], newOccurrences: [...],
 *     existingCount, newCount, matchedCount }
 *
 * Flatten existing+new into `items[]` tagged with `_partition` so agents can
 * tell still-present vs newly introduced occurrences without two list calls.
 * Fingerprint is not on the wire (Diff matching is server-side only).
 */
export const stoRemediationDiffExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined || typeof raw !== "object") return raw;
  const r = raw as {
    validationScanId?: string;
    existingOccurrences?: unknown[];
    newOccurrences?: unknown[];
    // Legacy keys (pre rename) — keep reading briefly for mixed deploys.
    existing?: unknown[];
    new?: unknown[];
    existingCount?: number;
    newCount?: number;
    matchedCount?: number;
  };
  const existingItems = Array.isArray(r.existingOccurrences)
    ? r.existingOccurrences
    : Array.isArray(r.existing)
      ? r.existing
      : [];
  const newItems = Array.isArray(r.newOccurrences)
    ? r.newOccurrences
    : Array.isArray(r.new)
      ? r.new
      : [];
  const tagged = [
    ...existingItems.map((it) =>
      typeof it === "object" && it !== null ? { ...it, _partition: "existing" } : it,
    ),
    ...newItems.map((it) =>
      typeof it === "object" && it !== null ? { ...it, _partition: "new" } : it,
    ),
  ];
  const existingCount =
    typeof r.existingCount === "number" ? r.existingCount : existingItems.length;
  const newCount = typeof r.newCount === "number" ? r.newCount : newItems.length;
  const matchedCount =
    typeof r.matchedCount === "number" ? r.matchedCount : existingCount + newCount;
  return {
    items: tagged,
    total: matchedCount,
    existing_total: existingCount,
    new_total: newCount,
    matched_count: matchedCount,
    validation_scan_id: r.validationScanId,
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
 * Factory for HAR v3 list responses. Shape: `{ page, size, hasMore, items[], meta? }`.
 * Unlike v1, responses are not wrapped in a `data` envelope.
 */
export const harV3ListExtract = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  // Some v3 list endpoints (notably /scans) still return the v1 envelope
  // { data, itemCount, pageIndex, pageSize, pageCount }. Normalize to the v3
  // shape so downstream consumers can rely on `items`.
  if (Array.isArray(raw.data) && !("items" in raw)) {
    return {
      items: raw.data,
      total: typeof raw.itemCount === "number" ? raw.itemCount : raw.data.length,
      page: raw.pageIndex,
      size: raw.pageSize,
      hasMore: typeof raw.pageIndex === "number" && typeof raw.pageCount === "number"
        ? raw.pageIndex + 1 < raw.pageCount
        : undefined,
    };
  }
  const items = (raw.items as unknown[]) ?? [];
  const meta = raw.meta as Record<string, unknown> | undefined;
  const total = typeof meta?.totalCount === "number"
    ? meta.totalCount
    : typeof meta?.total === "number"
      ? meta.total
      : items.length;
  // Project the meta counts agents care about instead of forwarding the raw
  // backend `meta` envelope (which may gain new keys over time).
  const activeCount = typeof meta?.activeCount === "number" ? meta.activeCount : undefined;
  const deletedCount = typeof meta?.deletedCount === "number" ? meta.deletedCount : undefined;
  return {
    items,
    total,
    page: raw.page,
    size: raw.size,
    hasMore: raw.hasMore,
    ...(activeCount !== undefined ? { activeCount } : {}),
    ...(deletedCount !== undefined ? { deletedCount } : {}),
  };
};

/**
 * v3 metadata GETs (GetRegistryMetadataV3 / GetPackageMetadataV3 /
 * GetVersionMetadataV3 / GetFileMetadataV3) return `{ data: [{ id, key, type,
 * value }] }`. Project the array under `items` so it looks like every other
 * v3 list, instead of leaking the backend `data` envelope.
 */
export const harV3DataArrayUnwrap = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  const data = raw.data;
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  return raw;
};

/**
 * v3 GetArtifactScanDetailsV3 returns `{ data: { packageName, scanStatus, ...
 * } }`. Unwrap to the inner object so the scan detail is the top-level payload.
 */
export const harV3DataObjectUnwrap = (raw: unknown): unknown => {
  if (!isRecord(raw)) return raw;
  if (isRecord(raw.data)) return raw.data;
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

function pipelineDefinitionGetParams(input: Record<string, unknown>, registry: PreflightContext["registry"]): Record<string, string> {
  const params: Record<string, string> = {};
  const orgId = input.org_id ?? registry.orgId;
  const projectId = input.project_id ?? registry.projectId;
  if (orgId) params.orgIdentifier = String(orgId);
  if (projectId) params.projectIdentifier = String(projectId);
  if (input.branch) params.branch = String(input.branch);
  if (input.store_type) params.storeType = String(input.store_type);
  if (input.connector_ref) params.connectorRef = String(input.connector_ref);
  if (input.repo_name) params.repoName = String(input.repo_name);
  return params;
}

/**
 * Fetch saved pipeline definition YAML so runtime_input_template can recover
 * `.default()` / `.selectOneFrom()` metadata stripped from the template API.
 * Fail-open: enrichment is best-effort; the template POST still succeeds without it.
 */
export async function runtimeInputTemplatePreflight({
  client,
  input,
  registry,
  signal,
}: PreflightContext): Promise<void> {
  const pipelineId = String(input.pipeline_id ?? input.resource_id ?? "").trim();
  if (!pipelineId) return;

  try {
    const raw = await client.request<unknown>({
      method: "GET",
      path: `/pipeline/api/pipelines/${encodeURIComponent(pipelineId)}`,
      params: pipelineDefinitionGetParams(input, registry),
      signal,
    });
    const yamlPipeline = (raw as { data?: { yamlPipeline?: string } })?.data?.yamlPipeline;
    if (typeof yamlPipeline === "string" && yamlPipeline.trim()) {
      input._pipelineDefinitionYaml = yamlPipeline;
    }
  } catch {
    // Fail-open: template POST still works without definition enrichment.
  }
}

/**
 * Extracts the runtime input template from the Harness pipeline template endpoint.
 * Unwraps `data.inputSetTemplateYaml`, `data.hasInputSets`, `data.modules`, and adds
 * a `_hint` field describing whether inputs are required.
 *
 * When preflight attached `_pipelineDefinitionYaml`, returns `variableInputMetadata`
 * for release-activity authoring. `inputSetTemplateYaml` is returned verbatim from the API.
 */
export const runtimeInputExtract = (raw: unknown, input?: Record<string, unknown>): unknown => {
  const r = raw as { data?: { inputSetTemplateYaml?: string; hasInputSets?: boolean; modules?: string[] } };
  const templateYaml = r.data?.inputSetTemplateYaml ?? null;
  const pipelineDefinitionYaml =
    typeof input?._pipelineDefinitionYaml === "string" ? input._pipelineDefinitionYaml : undefined;
  const variableInputMetadata = extractVariableInputMetadata(pipelineDefinitionYaml);

  const executeHint = templateYaml
    ? "This YAML template shows all runtime inputs needed. Fields with '<+input>' are required — pass key-value pairs via harness_execute(resource_type='pipeline', action='run', inputs={...}) or use input_set_ids for complex inputs."
    : "This pipeline has no runtime inputs. You can execute it without providing any inputs.";
  const activityHint =
    "variableInputMetadata covers pipeline-level variables only (not stage/service/env inputs) — copy default onto matching primitive activity inputs when authoring release activities.";

  return {
    inputSetTemplateYaml: templateYaml,
    hasInputSets: r.data?.hasInputSets ?? false,
    modules: r.data?.modules ?? [],
    variableInputMetadata,
    _hint: templateYaml && Object.keys(variableInputMetadata).length > 0
      ? `${executeHint} ${activityHint}`
      : executeHint,
  };
};

/**
 * Extracts resolved pipeline YAML (templates expanded) for activity input mapping.
 * Mirrors genai-service GET /pipeline/api/pipelines/{id}?getTemplatesResolvedPipeline=true.
 */
export const pipelineResolvedYamlExtract = (raw: unknown): unknown => {
  const r = raw as { data?: { resolvedTemplatesPipelineYaml?: string } };
  const resolvedTemplatesPipelineYaml = r.data?.resolvedTemplatesPipelineYaml ?? null;
  const stageMetadataMap = buildStageMetadataMap(resolvedTemplatesPipelineYaml);

  return {
    resolvedTemplatesPipelineYaml,
    stageMetadataMap,
    _hint: resolvedTemplatesPipelineYaml
      ? "Use stageMetadataMap to patch deploymentType and environmentRef on entity-type activity inputs during release-activity authoring."
      : "No resolved pipeline YAML returned. Entity input metadata may be incomplete.",
  };
};

/**
 * Extracts the declared inputs returned by the Harness pipeline v1 inputs-schema API.
 * The API may return its public shape directly or inside the standard `data` envelope.
 */
export const runtimeInputV1Extract = (raw: unknown): unknown => {
  const outer = asRecord(raw);
  const r = asRecord(outer?.data) ?? outer;
  const hasInputsField = !!r && Object.prototype.hasOwnProperty.call(r, "inputs");
  const inputs = hasInputsField && Array.isArray(r?.inputs) ? r.inputs : null;

  let hint: string;
  if (!hasInputsField) {
    hint = "The v1 inputs-schema response omitted inputs metadata. Do not assume the pipeline has no runtime inputs.";
  } else if (!inputs) {
    hint = "The v1 inputs-schema response contained an invalid inputs field. Expected an array; do not execute until the schema is confirmed.";
  } else if (inputs.length === 0) {
    hint = "This v1 pipeline declares no runtime inputs. Execute it without the inputs argument.";
  } else {
    hint = "Use each inputs[].details.name as a top-level harness_execute inputs key for pipeline_v1. The server sends those values as one inputs: YAML document.";
  }

  return {
    inputs,
    metadata_available: inputs !== null,
    _hint: hint,
  };
};

/**
 * Extracts the dynamic-execution response for
 * POST /v1/orgs/{org}/projects/{project}/pipelines/{pipeline}/execute/dynamic.
 *
 * The upstream returns `{ execution_details: { execution_id, status } }`.
 * Project to a flat, stable public shape — `{ execution_id, status }` — and
 * preserve any other top-level fields the API may add (without leaking the
 * original `execution_details` envelope). Returning a flat shape mirrors
 * how `pipeline.run` surfaces the planExecutionId so chained tools
 * (`harness_get(resource_type='execution', ...)`) work without re-mapping.
 */
export const dynamicExecutionExtract = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return raw;
  const r = raw as { execution_details?: { execution_id?: string; status?: string } };
  const details = r.execution_details ?? {};
  return {
    execution_id: details.execution_id ?? null,
    status: details.status ?? null,
  };
};

/**
 * Extracts merged input set data for a pipeline execution from
 * GET /pipeline/api/pipelines/execution/{planExecutionId}/inputsetV2.
 *
 * Projects to a stable shape: { inputSetYaml, inputSetTemplateYaml, resolvedYaml,
 * inputSetDetails, inputSetBranchName, executionId } so the public tool boundary
 * never leaks the NG response envelope or unrelated debug fields. `inputSetDetails`
 * is normalized to `[{identifier, name}]` even when the upstream returns a richer
 * object — agents only need those two fields per the spec.
 */
export const executionInputsExtract = (raw: unknown, input?: Record<string, unknown>): unknown => {
  const r = raw as {
    data?: {
      inputSetYaml?: string;
      inputSetTemplateYaml?: string;
      resolvedYaml?: string;
      inputSetDetails?: Array<{ identifier?: string; name?: string }>;
      inputSetBranchName?: string;
    };
  };
  const data = r?.data ?? {};
  const details = Array.isArray(data.inputSetDetails)
    ? data.inputSetDetails.map((d) => ({
      identifier: d?.identifier ?? null,
      name: d?.name ?? null,
    }))
    : [];
  const executionId = (input?.execution_id as string | undefined) ?? null;
  return {
    executionId,
    inputSetYaml: data.inputSetYaml ?? null,
    inputSetTemplateYaml: data.inputSetTemplateYaml ?? null,
    resolvedYaml: data.resolvedYaml ?? null,
    inputSetDetails: details,
    inputSetBranchName: data.inputSetBranchName ?? null,
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
 * CCM budget list (POST /ccm/api/budgets/v2/list) — keep the essential budget
 * health fields and drop noise. Strips alertThresholds (contains emails),
 * budgetMonthlyBreakdown (mostly zeros), and internal UUIDs.
 *
 * Response shape: `{ status, data: { summaries: [...], totalCount: N } }`.
 * Falls back to the standard paged shape if `summaries` is absent.
 */
export const ccmBudgetListCompactExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { summaries?: unknown[]; totalCount?: number } };
  let items: unknown[] = r.data?.summaries ?? [];
  let total = typeof r.data?.totalCount === "number" ? r.data.totalCount : items.length;

  if (items.length === 0) {
    const paged = pageExtract(raw);
    items = paged.items;
    total = paged.total;
  }

  const compact = items.map((item) => {
    if (!isRecord(item)) return item;
    return {
      id: item.uuid ?? item.id,
      name: item.name,
      perspectiveId: item.perspectiveId,
      perspectiveName: item.perspectiveName,
      budgetAmount: item.budgetAmount,
      actualCost: item.actualCost,
      forecastCost: item.forecastCost,
      timeLeft: item.timeLeft,
      timeUnit: item.timeUnit,
      period: item.period,
      type: item.type,
      growthRate: item.growthRate,
      actualCostAlerts: item.actualCostAlerts,
      forecastCostAlerts: item.forecastCostAlerts,
      budgetGroup: item.budgetGroup,
      folderId: item.folderId,
    };
  });

  return { items: compact, total };
};

/**
 * CCM budget variance detail — per-period actual-vs-budgeted time-series.
 *
 * Sourced from the REST budget detail (`GET /ccm/api/budgets/{id}`), which
 * returns a populated `budgetHistory` map keyed by period-start epoch-ms. The
 * GraphQL `FetchBudgetsGridData` grid resolver returns empty `costData` even
 * for budgets with history, so we derive the series from budgetHistory instead.
 *
 * Each history entry: `{ time, endTime, actualCost, forecastCost, budgeted,
 * budgetVariance, budgetVariancePercentage }`. We sort ascending by `time` so
 * the last row is the current (partial) period. Also handles budget GROUPS,
 * whose detail carries the same shape under `budgetGroupHistory`.
 *
 * Response shape: `{ data: { budgetHistory: {ts: {...}}, forecastCost, period,
 * name, budgetAmount, ... } }` (NG-wrapped).
 */
export const ccmBudgetDetailExtract = (raw: unknown): unknown => {
  const r = raw as {
    data?: Record<string, unknown>;
    // GraphQL fallback shape (kept for safety if the resolver ever returns data)
    errors?: unknown;
  };
  const d = isRecord(r?.data) ? r.data : isRecord(raw) ? (raw as Record<string, unknown>) : undefined;
  if (!d) return raw;

  const history = (d.budgetHistory ?? d.budgetGroupHistory) as
    | Record<string, unknown>
    | undefined;

  let costData: unknown[] = [];
  if (isRecord(history)) {
    costData = Object.values(history)
      .filter(isRecord)
      .map((e) => ({
        time: e.time,
        endTime: e.endTime,
        actualCost: e.actualCost,
        forecastCost: e.forecastCost,
        budgeted: e.budgeted,
        budgetVariance: e.budgetVariance,
        budgetVariancePercentage: e.budgetVariancePercentage,
      }))
      .sort((a, b) => Number(a.time ?? 0) - Number(b.time ?? 0));
  }

  return {
    budgetId: d.uuid ?? d.id,
    name: d.name,
    period: d.period,
    budgetAmount: d.budgetAmount ?? d.budgetGroupAmount,
    forecastCost: d.forecastCost,
    actualCost: d.actualCost,
    costData,
  };
};

/** Extract anomaly list: returns { items, total } so skipCompact marker survives normalization. */
export const anomalyListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[] };
  const items = Array.isArray(r?.data) ? r.data : [];
  return { items, total: items.length };
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
 * Extract chaos risk-scan heatmap response:
 * { summary, riskRules, rows, pagination: { totalItems } }
 *
 * Unlike most chaos list endpoints (which use `data`), heatmap returns
 * service rows under `rows` plus column metadata in `riskRules`. Preserve
 * the full matrix shape so callers can render the heatmap.
 */
export const chaosHeatmapExtract = (
  raw: unknown,
): {
  summary?: unknown;
  riskRules?: unknown[];
  items: unknown[];
  total: number;
} => {
  const r = raw as {
    summary?: unknown;
    riskRules?: unknown[];
    rows?: unknown[];
    pagination?: { totalItems?: number };
  };
  const items = Array.isArray(r.rows) ? r.rows : [];
  return {
    summary: r.summary,
    riskRules: Array.isArray(r.riskRules) ? r.riskRules : [],
    items,
    total: r.pagination?.totalItems ?? items.length,
  };
};

/**
 * Extract chaos scanned-risk get response: { scannedRisk: ScannedRisk }.
 *
 * Unlike sibling chaos_risk_rule.get and chaos_risk_scan.get (which return the
 * entity at the root), the v3 scanned-risks get handler wraps the entity in a
 * `scannedRisk` envelope. Unwrap so the tool contract matches every other
 * *.get op in the registry and identifier-field resolution / deep links work.
 */
export const chaosScannedRiskGetExtract = (raw: unknown): unknown => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as { scannedRisk?: unknown };
    if (r.scannedRisk && typeof r.scannedRisk === "object") {
      return r.scannedRisk;
    }
  }
  return raw;
};

/**
 * Chaos v2 experiment list items expose their id as `experimentID` (capital ID),
 * but the deep-link resolver and the get-op path param use `experimentId`. Mirror
 * the value so per-item `openInHarness` links use the UUID instead of falling back
 * to the experiment name. Wraps chaosPageExtract; all other fields are preserved.
 */
export const chaosExperimentListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const page = chaosPageExtract(raw);
  const items = page.items.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.experimentID === "string" && rec.experimentId === undefined) {
        return { ...rec, experimentId: rec.experimentID };
      }
    }
    return item;
  });
  return { items, total: page.total };
};

/**
 * The create-action handler echoes back the request `actions.Action` (clean,
 * no backend envelope). Project a stable, documented shape so no raw
 * passthrough crosses the tool boundary and future server-added fields stay
 * out of the public contract.
 */
export const chaosActionExtract = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const a = raw as Record<string, unknown>;
  return {
    identity: a.identity,
    name: a.name,
    description: a.description,
    tags: a.tags,
    type: a.type,
    infrastructureType: a.infrastructureType,
    hubRef: a.hubRef,
    actionsTemplateRef: a.actionsTemplateRef,
    actionProperties: a.actionProperties,
    runProperties: a.runProperties,
    variables: a.variables,
    inputs: a.inputs,
  };
};

/**
 * Input-set list items belong to a single parent experiment (the required
 * experiment_id filter), but don't carry it in the row. Inject experimentId from
 * the request input so each item's deep link resolves to the parent experiment's
 * inputsets page instead of the per-item resolver clobbering it with the row's name.
 */
export const chaosInputSetListExtract = (
  raw: unknown,
  input?: Record<string, unknown>,
): { items: unknown[]; total: number } => {
  const page = chaosPageExtract(raw);
  const experimentId = input?.experiment_id;
  if (typeof experimentId !== "string" || experimentId === "") return page;
  const items = page.items.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (rec.experimentId === undefined) return { ...rec, experimentId };
    }
    return item;
  });
  return { items, total: page.total };
};

/**
 * Trigger list items do not carry the parent pipeline id in the row, but deep links
 * need {pipeline_id}. Inject from item.pipelineIdentifier or the required list filter
 * so the shared resolver does not fall back to item.identifier (the trigger id).
 */
export const triggerListExtract = (
  raw: unknown,
  input?: Record<string, unknown>,
): { items: unknown[]; total: number } => {
  const page = pageExtract(raw);
  const fromInput = input?.pipeline_id;
  const inputPipelineId = typeof fromInput === "string" && fromInput !== "" ? fromInput : undefined;
  const items = page.items.map((item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (rec.pipeline_id !== undefined && typeof rec.pipeline_id !== "object") {
        return item;
      }
      const fromItem =
        typeof rec.pipelineIdentifier === "string" && rec.pipelineIdentifier !== ""
          ? rec.pipelineIdentifier
          : inputPipelineId;
      if (fromItem !== undefined) {
        return { ...rec, pipeline_id: fromItem };
      }
    }
    return item;
  });
  return { items, total: page.total };
};

/**
 * Normalize chaos experiment variables response (RunTimeInputs shape):
 * { experiment: [...] | null, tasks: { taskName: [...] } | null }
 * → { items: [{ task, variables }], total }
 * Groups variables by task name. Handles null/undefined gracefully.
 */
export const chaosRunTimeInputsExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { experiment?: unknown[] | null; tasks?: Record<string, unknown[]> | null } | null | undefined;
  if (!r) return { items: [], total: 0 };
  const items: unknown[] = [];
  const expVars = r.experiment;
  if (Array.isArray(expVars) && expVars.length > 0) {
    items.push({ task: "experiment", variables: expVars });
  }
  const tasks = r.tasks;
  if (tasks && typeof tasks === "object") {
    for (const [taskName, vars] of Object.entries(tasks)) {
      if (Array.isArray(vars) && vars.length > 0) {
        items.push({ task: taskName, variables: vars });
      }
    }
  }
  return { items, total: items.length };
};

/**
 * Extract chaos application-map (a.k.a. network map) list response:
 * { data: [...], page: { index, limit, totalPages, totalItems } }
 *
 * Note: the JSON key is "page" (not "pagination" like other chaos
 * resources), per ListTargetNetworkMapResponse in hce-saas
 * pkg/networkmap/types.go. We don't widen chaosPageExtract because
 * "page" also means a query param, and silently accepting both shapes
 * could mask bugs in unrelated endpoints.
 */
export const chaosAppMapPageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; page?: { totalItems?: number } };
  return {
    items: r.data ?? [],
    total: r.page?.totalItems ?? (Array.isArray(r.data) ? r.data.length : 0),
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

// Pick the tool-specific sub-object out of toolConfig; loadTestManager also
// accepts flat toolConfig at the root for forward-compat, so fall back to that.
const pickToolBlock = (
  toolType: unknown,
  toolConfig: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined => {
  if (!toolConfig) return undefined;
  const key = typeof toolType === "string" ? toolType.toLowerCase() : "";
  const nested = key
    ? (toolConfig[key] as Record<string, unknown> | undefined)
    : undefined;
  return nested ?? toolConfig;
};

const readTunable = (
  tc: Record<string, unknown> | undefined,
  name: string,
): unknown => {
  if (!tc) return undefined;
  const tunables = tc.tunables as Record<string, unknown> | undefined;
  return tunables?.[name];
};

const readScriptField = (
  tc: Record<string, unknown> | undefined,
  name: string,
): unknown => {
  if (!tc) return undefined;
  const script = tc.script as Record<string, unknown> | undefined;
  return script?.[name];
};

// K6 rpsLimit has two historical storage locations: tunables.rpsLimit (current
// authoring surface) and options.rpsLimit (legacy/UI-authored path — see
// loadTestManager k6.go LoadOptions.RPSLimit). Mirror the backend's own
// dispatch-time fallback precedence (loadtest_handlers.go) so read-side scalars
// stay truthful regardless of which shape a given record was persisted with.
const readK6RpsLimit = (tc: Record<string, unknown> | undefined): unknown => {
  const fromTunables = readTunable(tc, "rpsLimit");
  if (fromTunables != null && fromTunables !== 0) return fromTunables;
  const options = tc?.options as Record<string, unknown> | undefined;
  const fromOptions = options?.rpsLimit;
  if (fromOptions != null && fromOptions !== 0) return fromOptions;
  return undefined;
};

/**
 * Project a single load test (LoadTestResponse) to a stable shape.
 *
 * Since the variables migration, all tunables and custom env vars live under
 * toolConfig.<tool>.tunables / toolConfig.<tool>.variables (see LocustSpec /
 * K6Spec / JMeterSpec in loadTestManager/internal/domain). We pass toolConfig
 * through as-is for fidelity AND surface derived convenience scalars mirroring
 * the create-side LLM surface so round-trips are intuitive.
 *
 * Mirrors `identity` into `loadtestId` so the deep-link resolver fills
 * {loadtestId} instead of falling back to the name.
 */
export const chaosLoadTestExtract = (raw: unknown): unknown => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const t = raw as Record<string, unknown>;
  const toolConfig = t.toolConfig as Record<string, unknown> | undefined;
  const toolBlock = pickToolBlock(t.toolType, toolConfig);
  const variables = toolBlock?.variables as unknown[] | undefined;
  const envVars = toolBlock?.envVars as unknown[] | undefined;
  return {
    loadtestId: t.identity,
    uniqueId: t.uniqueId,
    parentUniqueId: t.parentUniqueId,
    identity: t.identity,
    name: t.name,
    description: t.description,
    tags: t.tags,
    serviceReferences: t.serviceReferences,
    environmentIdentifier: t.environmentIdentifier,
    infraIdentifier: t.infraIdentifier,
    infraType: t.infraType,
    targetType: t.targetType,
    toolType: t.toolType,
    scriptSource: t.scriptSource,
    importType: t.importType,
    templateReference: t.templateReference,
    templateUpdateAvailable: t.templateUpdateAvailable,
    latestRevisionIdentifier: t.latestRevisionIdentifier,
    maxDurationSec: t.maxDurationSec,
    cleanupPolicy: t.cleanupPolicy,
    resources: t.resources,
    // Canonical tool config — passed through as-is for fidelity.
    toolConfig,
    variables,
    envVars,
    // Denormalised display strings the backend emits for table renders.
    targetUsersDisplay: t.targetUsers,
    durationSecondsDisplay: t.durationSeconds,
    // Derived convenience scalars (typed tunables under toolConfig.<tool>.tunables).
    target_url: readTunable(toolBlock, "targetUrl"),
    users: readTunable(toolBlock, "targetUsers"),
    duration_sec: readTunable(toolBlock, "durationSeconds"),
    ramp_up_sec: readTunable(toolBlock, "rampUpTimeSec"),
    worker_count: readTunable(toolBlock, "workerCount"),
    spawn_rate: readTunable(toolBlock, "spawnRate"),
    host_url: readTunable(toolBlock, "hostUrl"),
    iterations: readTunable(toolBlock, "iterations"),
    rps_limit: readK6RpsLimit(toolBlock),
    // Derived convenience scalars from toolConfig.<tool>.script (image mode).
    script_image: readScriptField(toolBlock, "image"),
    script_entrypoint: readScriptField(toolBlock, "entrypoint"),
    load_args: readScriptField(toolBlock, "loadArgs"),
    image_pull_secret: readScriptField(toolBlock, "imagePullSecret"),
    recentRuns: t.recentRuns,
    isSampleTest: t.isSampleTest,
    isApiGenerated: t.isApiGenerated,
    isAIUsed: t.isAIUsed,
    lastExecuted: t.lastExecuted,
    createdAt: t.createdAt,
    createdBy: t.createdBy,
    updatedAt: t.updatedAt,
    updatedBy: t.updatedBy,
    yaml: t.yaml,
  };
};

/**
 * Load test list response: { items, pagination: { totalItems } }.
 * Projects each item via chaosLoadTestExtract → { items, total }.
 */
export const chaosLoadTestListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { items?: unknown[]; pagination?: { totalItems?: number } };
  const items = (r.items ?? []).map(chaosLoadTestExtract);
  return { items, total: r.pagination?.totalItems ?? items.length };
};

/**
 * Chaos Service (v3) list response: { data: [...], correlationID, pagination: { index, limit, totalPages, totalItems } }.
 * Distinct from chaos_loadtest's { items, pagination } envelope — the v3 chaos-services API
 * wraps the array under `data` per shared PaginationResponse contract.
 */
export const chaosServiceListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: unknown[]; pagination?: { totalItems?: number } };
  const items = r.data ?? [];
  return { items, total: r.pagination?.totalItems ?? items.length };
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

/** Extract chaos DR test list response: { items: [...], pagination: { totalItems } } */
export const chaosDRTestListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { items?: unknown[]; pagination?: { totalItems?: number } };
  const items = r.items ?? [];
  return { items, total: r.pagination?.totalItems ?? items.length };
};

// ---------------------------------------------------------------------------
// Service Discovery extractors
// ---------------------------------------------------------------------------

/**
 * Extract Service Discovery paginated list response — common envelope shape:
 *   { correlationID, page: { totalItems, ... }, items: [...] }
 * Used by namespaces, discoveredservices, workloads, connections, agents.
 *
 * Two server-side quirks are smoothed over here:
 *   1. When the request uses `all=true` or `limit=0`, the SD server returns
 *      `page: { all: true }` with no `totalItems` field — Go zero-values it
 *      to 0. We compensate with `Math.max(reportedTotal, items.length)` so
 *      `total` always reflects what was actually returned.
 *   2. When `items` is empty, we attach a `_hint` covering the four most
 *      common failure modes (wrong agent_identity, no sync yet, case-
 *      sensitive exact `name` match, K8s-only `namespace` filter) so the
 *      LLM can guide the user without an extra round trip.
 */
export const sdPageExtract = (raw: unknown): { items: unknown[]; total: number; _hint?: string } => {
  const r = raw as { items?: unknown[]; page?: { totalItems?: number } };
  const items = r.items ?? [];
  const reported = r.page?.totalItems ?? 0;
  const total = Math.max(reported, items.length);
  if (items.length === 0) {
    return {
      items,
      total,
      _hint:
        "Empty result. Common causes: " +
        "(1) agent_identity is not a Service Discovery agent — a chaos infrastructure ID (chaos_k8s_infrastructure) is NOT an SD agent ID, they are separate; verify against the SD UI URL. " +
        "(2) The agent has not completed a discovery sync yet (new agents take a few minutes to populate). " +
        "(3) For discovered_namespace, the `name` filter is EXACT case-sensitive equality — for partial/case-insensitive matches, list with `all: true` and filter client-side. " +
        "(4) For discovered_service, the `namespace` filter only matches Kubernetes-typed records (Lambda/EC2/VM/process records won't match).",
    };
  }
  return { items, total };
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

/**
 * Public v4 paginated lists (`EnvironmentListResponse`, `TrafficTypeListResponse` / `RolloutStatusListResponse`):
 * `{ data, limit, offset, totalCount }`. Promote `data`→`items` and `totalCount`→`total`
 * so harness_list compact/output schema see a full total, not the current page length.
 */
export const fmeV4PaginatedListExtract = (raw: unknown): unknown => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.data)) return raw;
  const total = typeof r.totalCount === "number" ? r.totalCount : r.data.length;
  return { ...r, items: r.data, total };
};

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

// ── Release Management (RMG) ──────────────────────────────────────────────

const RMG_API_PREFIX = "/api";
export const RMG_DEFAULT_DAYS_BACK = 30;
export const RMG_MAX_DAYS_BACK = 365;
/** Days of look-ahead included in the window so scheduled releases stay visible. */
export const RMG_DAYS_FORWARD = 7;
const RMG_DAY_MS = 86_400_000;
export const RMG_DEFAULT_TASK_LIMIT = 50;
export const RMG_MAX_TASK_LIMIT = 100;

function rmgClampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function rmgAsRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** First key holding an array — RMG list payloads vary by gateway version. */
function rmgFirstArrayAt(
  source: Record<string, unknown>,
  keys: readonly string[],
): Array<Record<string, unknown>> | undefined {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  }
  return undefined;
}

/**
 * Copy HARNESS_ORG / HARNESS_PROJECT into input when scopeOptional resources
 * omit explicit org_id/project_id (same pattern as release list preflight).
 */
export async function releaseFillScopeFromConfig({ input, registry }: PreflightContext): Promise<void> {
  if (!input.org_id && registry.orgId) input.org_id = registry.orgId;
  if (!input.project_id && registry.projectId) input.project_id = registry.projectId;
}

/**
 * Resolve the effective scope and time window before the body/query are built.
 * The registry only merges HARNESS_ORG/HARNESS_PROJECT into `input` when the
 * caller passes `resource_scope`, but the body always needs them.
 */
export async function releaseListPreflight(ctx: PreflightContext): Promise<void> {
  await releaseFillScopeFromConfig(ctx);
  const { input } = ctx;
  const now = Date.now();
  const daysBack = rmgClampInt(input.days_back, 1, RMG_MAX_DAYS_BACK, RMG_DEFAULT_DAYS_BACK);
  if (input.start_ts === undefined || input.start_ts === "") {
    input.start_ts = now - daysBack * RMG_DAY_MS;
  }
  if (input.end_ts === undefined || input.end_ts === "") {
    input.end_ts = now + RMG_DAYS_FORWARD * RMG_DAY_MS;
  }
}

/** POST /api/release/list — scope travels in the body as `scopes`, not as query params. */
export function releaseListBody(input: Record<string, unknown>): Record<string, unknown> {
  const scope: Record<string, string> = {};
  if (typeof input.org_id === "string" && input.org_id) scope.orgIdentifier = input.org_id;
  if (typeof input.project_id === "string" && input.project_id) {
    scope.projectIdentifier = input.project_id;
  }
  return { scopes: Object.keys(scope).length > 0 ? [scope] : [] };
}

/**
 * Normalize the list payload and apply the optional status filter client-side
 * (the endpoint takes no status param). Status matching is case-insensitive
 * because RMG returns both `Running` and `RUNNING` depending on the field.
 */
export function releaseListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const root = rmgAsRecord(raw);
  const payload = Array.isArray(raw)
    ? { content: raw }
    : rmgFirstArrayAt(root, ["content", "releases", "items"])
      ? root
      : rmgAsRecord(root.data);

  let items = rmgFirstArrayAt(payload, ["content", "releases", "items"]) ?? [];
  const pageItemCount = items.length;

  const requestedStatus = typeof input?.status === "string" ? input.status.trim() : "";
  if (requestedStatus) {
    const wanted = requestedStatus.toLowerCase();
    items = items.filter((rel) => {
      const status = rel.status ?? rel.releaseStatus;
      return typeof status === "string" && status.toLowerCase() === wanted;
    });
  }

  const total = ["totalElements", "totalItems", "totalCount", "total"]
    .map((key) => payload[key])
    .find((value): value is number => typeof value === "number");

  return {
    items,
    total: requestedStatus ? items.length : (total ?? items.length),
    ...(requestedStatus
      ? {
          status_filter: requestedStatus,
          _hint:
            "status is filtered client-side on this page only; total is the filtered count for this page, " +
            `not the account (${pageItemCount} unfiltered items on this page). ` +
            "Increment page (keep size and other filters) if matches may exist on later pages.",
        }
      : {}),
  };
}

/** Flatten GET /api/release/{id} → { release: releaseInfo, ... }. */
export function releaseGetExtract(raw: unknown): unknown {
  const r = raw as { releaseInfo?: Record<string, unknown> };
  if (r.releaseInfo && typeof r.releaseInfo === "object") {
    return { release: r.releaseInfo };
  }
  return raw;
}

function rmgSplitCsvFilter(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parts = value.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/** Normalize sort/status/type filters before query param mapping (GET list). */
export function normalizeReleaseActivityExecutionInput(input: Record<string, unknown>): void {
  const sortField =
    typeof input.sort_field === "string" && input.sort_field.length > 0
      ? input.sort_field
      : "start_ts";
  const sortDirection = input.sort_direction === "asc" ? "asc" : "desc";
  input.sort = [sortField, sortDirection];

  const statusParts = rmgSplitCsvFilter(input.status);
  if (statusParts) input.status = statusParts;

  const typeParts = rmgSplitCsvFilter(input.activity_type);
  if (typeParts) input.activity_type = typeParts;
}

export function normalizeReleaseTaskLimit(input: Record<string, unknown>): void {
  if (input.limit === undefined && input.size !== undefined) {
    input.limit = input.size;
  }
  input.limit = rmgClampInt(input.limit, 1, RMG_MAX_TASK_LIMIT, RMG_DEFAULT_TASK_LIMIT);
}

/** GET /api/release/{id}/tasks → standard list envelope with cursor pagination. */
export function releaseTaskListExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  const r = raw as {
    tasks?: unknown[];
    nextRequest?: { cursor?: string };
    last?: boolean;
  };
  const items = Array.isArray(r.tasks) ? r.tasks : [];
  const limit = rmgClampInt(input?.limit ?? input?.size, 1, RMG_MAX_TASK_LIMIT, RMG_DEFAULT_TASK_LIMIT);
  return {
    items,
    total: items.length,
    limit_applied: limit,
    status_filter: typeof input?.status === "string" && input.status ? input.status : "all",
    pagination: {
      cursor: typeof input?.cursor === "string" ? input.cursor : undefined,
      next_cursor: r.nextRequest?.cursor,
      last: r.last,
    },
  };
}

/** GET /api/release/{id}/execution/activities — Spring page at root. */
export function releaseActivityExecutionListExtract(raw: unknown): unknown {
  const r = raw as {
    content?: unknown[];
    totalElements?: number;
    totalPages?: number;
    size?: number;
    number?: number;
    numberOfElements?: number;
    first?: boolean;
    last?: boolean;
  };
  const items = Array.isArray(r.content) ? r.content : [];
  return {
    items,
    total: typeof r.totalElements === "number" ? r.totalElements : items.length,
    pagination: {
      page: r.number,
      size: r.size,
      total_pages: r.totalPages,
      total_elements: r.totalElements,
      number_of_elements: r.numberOfElements,
      first: r.first,
      last: r.last,
    },
  };
}

function requireReleaseAndPhase(input: Record<string, unknown>): { releaseId: string; phaseId: string } {
  const releaseId = input.release_id;
  const phaseId = input.phase_identifier;
  if (typeof releaseId !== "string" || !releaseId) {
    throw new Error("release_id is required");
  }
  if (typeof phaseId !== "string" || !phaseId) {
    throw new Error(
      "phase_identifier is required — pass via params on harness_get (from harness_list release_execution_phase)",
    );
  }
  return { releaseId, phaseId };
}

export function releaseExecutionPhaseOutputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const enc = encodeURIComponent;
  return `${RMG_API_PREFIX}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/output`;
}

export function releaseExecutionPhaseInputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const enc = encodeURIComponent;
  return `${RMG_API_PREFIX}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/input`;
}

export function releaseExecutionActivityOutputPath(input: Record<string, unknown>): string {
  const { releaseId, phaseId } = requireReleaseAndPhase(input);
  const activityId = input.activity_identifier;
  if (typeof activityId !== "string" || !activityId) {
    throw new Error(
      "activity_identifier is required — pass via params on harness_get (from harness_list release_execution_activity)",
    );
  }
  const enc = encodeURIComponent;
  return `${RMG_API_PREFIX}/orchestration/execution/release/${enc(releaseId)}/phase/${enc(phaseId)}/activity/${enc(activityId)}/output`;
}

function releasePhaseIoGetExtract(
  raw: unknown,
  input: Record<string, unknown> | undefined,
  field: "inputs" | "outputs",
): unknown {
  const r = raw as { inputs?: unknown[]; outputs?: unknown[] };
  const items = Array.isArray(r[field]) ? r[field] : [];
  return {
    [field]: items,
    phase_identifier: input?.phase_identifier,
    [`total_${field}`]: items.length,
  };
}

export function releasePhaseOutputGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  return releasePhaseIoGetExtract(raw, input, "outputs");
}

export function releasePhaseInputGetExtract(raw: unknown, input?: Record<string, unknown>): unknown {
  return releasePhaseIoGetExtract(raw, input, "inputs");
}

export function releaseActivityOutputGetExtract(
  raw: unknown,
  input: Record<string, unknown> | undefined,
): unknown {
  const r = raw as { outputs?: unknown[] };
  const items = Array.isArray(r.outputs) ? r.outputs : [];
  return {
    outputs: items,
    phase_identifier: input?.phase_identifier,
    activity_identifier: input?.activity_identifier,
    total_outputs: items.length,
  };
}

export function releaseActivityInputGetExtract(raw: unknown): unknown {
  const r = raw as { inputs?: unknown[] };
  const items = Array.isArray(r.inputs) ? r.inputs : [];
  return {
    inputs: items,
    total_inputs: items.length,
  };
}

export function releaseInputGetExtract(raw: unknown): unknown {
  const r = raw as { release_id?: string; process_execution_id?: string; yaml?: string };
  return {
    release_id: r.release_id,
    process_execution_id: r.process_execution_id,
    yaml: r.yaml,
  };
}

/** GET /api/orchestration/execution/{id}/phases → standard list envelope. */
export function releasePhaseListExtract(raw: unknown): {
  items: unknown[];
  total: number;
  release_id?: string;
  total_running_phases?: number;
} {
  const r = raw as {
    phases?: unknown[];
    release_id?: string;
    total_running_phases?: number;
  };
  const items = Array.isArray(r.phases) ? r.phases : [];
  return {
    items,
    total: items.length,
    ...(r.release_id ? { release_id: r.release_id } : {}),
    ...(typeof r.total_running_phases === "number" ? { total_running_phases: r.total_running_phases } : {}),
  };
}

/** Project RMG process/activity YAML entity responses to a stable agent shape. */
export function rmgYamlEntityExtract(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const gitDetails = raw.git_details ?? raw.gitDetails;
  const out: Record<string, unknown> = {};
  if (typeof raw.identifier === "string") out.identifier = raw.identifier;
  if (typeof raw.name === "string") out.name = raw.name;
  if (typeof raw.yaml === "string") out.yaml = raw.yaml;
  if (typeof raw.orgIdentifier === "string") out.orgIdentifier = raw.orgIdentifier;
  if (typeof raw.projectIdentifier === "string") out.projectIdentifier = raw.projectIdentifier;
  if (gitDetails !== undefined) out.git_details = gitDetails;
  if (Object.keys(out).length > 0) return out;
  return raw;
}

/** Normalize RMG delete responses to a stable confirmation shape. */
export function rmgYamlEntityDeleteExtract(raw: unknown): unknown {
  if (raw === null || raw === undefined) return { deleted: true };
  if (!isRecord(raw)) return { deleted: true };
  const out: Record<string, unknown> = { deleted: true };
  if (typeof raw.identifier === "string") out.identifier = raw.identifier;
  if (raw.status !== undefined) out.status = raw.status;
  return out;
}

export function yamlWriteBody(input: Record<string, unknown>): Record<string, unknown> {
  const b = input.body as Record<string, unknown> | undefined;
  if (!b || typeof b !== "object") {
    throw new Error("body is required and must be an object with yaml (and optional git_details)");
  }
  if (typeof b.yaml !== "string" || b.yaml.length === 0) {
    throw new Error("body.yaml is required (non-empty YAML string)");
  }
  const out: Record<string, unknown> = { yaml: b.yaml };
  if (b.git_details !== undefined) out.git_details = b.git_details;
  return out;
}
