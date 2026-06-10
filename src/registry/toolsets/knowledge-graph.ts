import type { ToolsetDefinition, FilterFieldSpec } from "../types.js";

const QUERY_SVC =
  "/query-service/grpc/io.harness.platform.query.service.api.v1.QueryServiceGrpc";

// ─── Response extractors ─────────────────────────────────────────────────────

const MAX_DESC_LEN = 80;

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function unwrapQueryServiceEnvelope(raw: unknown): unknown {
  const top = asRecord(raw);
  if (!top) return raw;
  return asRecord(top.data) ?? asRecord(top.result) ?? top;
}

/**
 * Summary-only extractor for queryable types.
 *
 * Returns id, name, description (truncated), object_kind, connectorId, annotations.
 * No field metadata.
 */
const queryableTypeSummaryExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = unwrapQueryServiceEnvelope(raw) as { queryable_types?: Record<string, unknown>[] };
  const items: unknown[] = [];

  for (const qt of r.queryable_types ?? []) {
    const typeInfo = qt.type as Record<string, unknown> | undefined;
    const typeRef = qt.type_reference as Record<string, unknown> | undefined;
    const connectorMapping = qt.connector_mapping_config as Record<string, unknown> | undefined;

    const objectKind = (typeRef?.object_kind as string) ?? "";

    const connectorRef = connectorMapping?.connector_reference as Record<string, unknown> | undefined;
    // Prefer a stable connector identifier for the join/discovery hint; the
    // display name is only a last-resort fallback. Two connectors can share a
    // name, so the name alone is not a reliable JOIN key.
    const connectorId =
      (connectorRef?.connector_identifier as string) ??
      (connectorRef?.identifier as string) ??
      (connectorRef?.connector_name as string) ??
      "";

    const oneofKeys: Record<string, string> = {
      entity_type: "OBJECT_KIND_ENTITY",
      event_type: "OBJECT_KIND_EVENT",
      metric_type: "OBJECT_KIND_METRIC",
      relationship_type: "OBJECT_KIND_RELATIONSHIP",
      view_type: "OBJECT_KIND_VIEW",
    };

    let actualType: Record<string, unknown> | undefined;
    for (const [key] of Object.entries(oneofKeys)) {
      if (typeInfo?.[key]) {
        actualType = typeInfo[key] as Record<string, unknown>;
        break;
      }
    }
    if (!actualType) continue;

    const id = actualType.id as string | undefined;
    if (!id) continue;

    const annotations = actualType.annotations as Record<string, unknown>[] | undefined;
    const annotationKeys = (annotations ?? [])
      .map((a) => (a.key as string) ?? "")
      .filter(Boolean);

    const rawDesc = (actualType.description as string) ?? "";
    const desc =
      rawDesc.length > MAX_DESC_LEN
        ? rawDesc.slice(0, MAX_DESC_LEN) + "..."
        : rawDesc;

    const item: Record<string, unknown> = {
      identifier: id,
      name: actualType.name ?? "Unknown",
      kind: objectKind,
      connectorId,
    };
    if (desc) item.description = desc;
    if (annotationKeys.length > 0) item.tags = annotationKeys;

    items.push(item);
  }

  return { items, total: items.length };
};

const grammarExtract = (raw: unknown): unknown => {
  const inner = unwrapQueryServiceEnvelope(raw);
  const r = inner as { grammar?: string };
  return r.grammar ?? inner;
};

/**
 * Map an HQL executeQuery response to a stable {columns, rows, stats} contract.
 * The query-service may wrap the payload in `data`/`result`; we unwrap it and
 * project only the actionable fields so backend envelope/debug/meta fields do
 * not leak across the public tool boundary.
 */
const hqlRunExtract = (raw: unknown): unknown => {
  const inner = (asRecord(unwrapQueryServiceEnvelope(raw)) ?? {}) as Record<string, unknown>;

  const out: Record<string, unknown> = {
    columns: inner.columns ?? [],
    rows: inner.rows ?? [],
  };
  if (inner.stats != null) out.stats = inner.stats;
  return out;
};

// ─── Body builders ───────────────────────────────────────────────────────────

function extractQueryString(input: Record<string, unknown>): string {
  const body = input.body as Record<string, unknown> | undefined;
  return (body?.query_string ?? body?.queryString ?? body?.query) as string;
}

function queryableTypesBody(input: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const kinds = input.kinds ?? input.object_kind;
  if (kinds) {
    filter.kinds = Array.isArray(kinds) ? kinds : [kinds];
  }

  const annotations = input.annotations;
  if (annotations) {
    filter.annotations = Array.isArray(annotations) ? annotations : [annotations];
  }

  return Object.keys(filter).length > 0 ? { filter } : {};
}

const OBJECT_KINDS = [
  "OBJECT_KIND_ENTITY",
  "OBJECT_KIND_EVENT",
  "OBJECT_KIND_METRIC",
  "OBJECT_KIND_VIEW",
  "OBJECT_KIND_RELATIONSHIP",
];

const KG_QUERYABLE_TYPE_FILTERS: FilterFieldSpec[] = [
  {
    name: "kinds",
    description:
      "Filter by object kind(s). Pass one or more OBJECT_KIND_* values. " +
      "Use OBJECT_KIND_VIEW for dashboard-style types, OBJECT_KIND_ENTITY for base entities.",
    enum: OBJECT_KINDS,
  },
  {
    name: "annotations",
    description:
      "Filter by annotation key(s). Only types with at least one matching annotation are returned.",
  },
];

function hqlValidateBody(input: Record<string, unknown>) {
  return { query_string: extractQueryString(input) };
}

function hqlRunBody(input: Record<string, unknown>) {
  const body = input.body as Record<string, unknown> | undefined;
  const timeoutMs = body?.timeout_ms ?? body?.timeoutMs;
  const maxResults = body?.max_results ?? body?.maxResults;
  const result: Record<string, unknown> = { query_string: extractQueryString(input) };
  if (timeoutMs != null || maxResults != null) {
    result.options = {
      ...(timeoutMs != null ? { timeout_ms: Number(timeoutMs) } : {}),
      ...(maxResults != null ? { max_results: Number(maxResults) } : {}),
      include_stats: true,
    };
  }
  return result;
}

// ─── Toolset definition ─────────────────────────────────────────────────────

export const knowledgeGraphToolset: ToolsetDefinition = {
  name: "knowledge-graph",
  displayName: "Knowledge Graph",
  description:
    "Harness Knowledge Graph query engine — discover queryable types, build and execute HQL " +
    "(Harness Query Language) queries, and explore data models and connections. " +
    "Start with kg_queryable_type_summary to pick relevant types, then get field details " +
    "for each selected type via kg_type (semantic-layer toolset), and use hql_query to validate and run queries.",
  resources: [
    {
      resourceType: "kg_queryable_type_summary",
      displayName: "Queryable Type Summary",
      description:
        "Lightweight summaries of types queryable via HQL. Returns identifier (type_id for " +
        "HQL queries), name, description, kind (OBJECT_KIND_*), connectorId, tags. No field " +
        "metadata. Use this FIRST to select types, then fetch field details per type via " +
        "harness_get(resource_type='kg_type', resource_id='<identifier>', params={kind: '<kind>'}). " +
        "Types sharing the same non-empty connectorId can be JOINed. Empty connectorId means " +
        "no shared backing connector—do not infer JOIN eligibility from connector alone. " +
        "Pass 'kinds' to filter.",
      toolset: "knowledge-graph",
      scope: "account",
      identifierFields: [],
      listFilterFields: KG_QUERYABLE_TYPE_FILTERS,
      operations: {
        list: {
          method: "POST",
          path: `${QUERY_SVC}/getQueryableTypes`,
          headers: {},
          bodyBuilder: queryableTypesBody,
          responseExtractor: queryableTypeSummaryExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "List queryable type summaries (identifier, name, description, kind, connectorId, tags). " +
            "Pass kinds=[...] to filter. Use identifier + kind to fetch field details via kg_type get.",
        },
      },
    },

    {
      resourceType: "kg_grammar",
      displayName: "HQL Grammar",
      description:
        "The formal ANTLR4 grammar (.g4) for HQL (Harness Query Language). " +
        "Fetch this ONCE when you need to write HQL queries to learn the full " +
        "syntax: find/filter/select/group_by/order_by/join/having/with (CTEs), " +
        "window functions, array functions, case/when, cast, interval, unnest, etc. " +
        "Returns the grammar as a plain text string.",
      toolset: "knowledge-graph",
      scope: "account",
      identifierFields: [],
      operations: {
        get: {
          method: "POST",
          path: `${QUERY_SVC}/getGrammar`,
          headers: {},
          bodyBuilder: () => ({}),
          responseExtractor: grammarExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Fetch the HQL grammar definition. Returns the full ANTLR4 .g4 grammar as text.",
        },
      },
    },

    {
      resourceType: "hql_query",
      displayName: "HQL Query",
      description:
        "Harness Query Language (HQL) query operations. Use validate to check syntax, " +
        "then run to execute and get results. Pass the HQL query string in body.query_string.",
      toolset: "knowledge-graph",
      scope: "account",
      identifierFields: [],
      executeHint:
        "1. Learn grammar: harness_get(resource_type='kg_grammar'). " +
        "2. Discover types: harness_list(resource_type='kg_queryable_type_summary') — note the 'identifier' and 'kind' fields. " +
        "3. Get fields per type: harness_get(resource_type='kg_type', resource_id='<identifier>', params={kind: '<kind>'}). " +
        "4. Validate: harness_execute(resource_type='hql_query', action='validate', " +
        "body={query_string: 'find view \"ci:pipeline_execution_summary_ci\" | select {count()}'}). " +
        "5. Run: harness_execute(resource_type='hql_query', action='run', body={query_string: '...'}). ",
      operations: {},
      executeActions: {
        validate: {
          method: "POST",
          path: `${QUERY_SVC}/validateQuery`,
          headers: {},
          bodyBuilder: hqlValidateBody,
          responseExtractor: (raw: unknown) => {
            const r = unwrapQueryServiceEnvelope(raw) as { is_valid?: boolean; errors?: unknown[] };
            return { is_valid: r.is_valid, errors: r.errors ?? [] };
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          actionDescription:
            "Validate an HQL query without executing it. Returns is_valid and errors only. " +
            "Always validate before running a query.",
          description: "Validate HQL query syntax and semantics",
          bodySchema: {
            description: "HQL query to validate",
            fields: [
              {
                name: "query_string",
                type: "string",
                required: true,
                description: "The HQL query string to validate",
              },
            ],
          },
        },
        run: {
          method: "POST",
          path: `${QUERY_SVC}/executeQuery`,
          headers: {},
          bodyBuilder: hqlRunBody,
          responseExtractor: hqlRunExtract,
          // HQL is a read-only query language (find/filter/select/join — no mutations),
          // so running a query is read-risk: allowed in read-only mode, no confirmation.
          operationPolicy: { risk: "read", retryPolicy: "do_not_retry" },
          actionDescription:
            "Execute an HQL query and return results. Returns columns, rows, stats. " +
            "Optionally pass timeout_ms and max_results in body.",
          description: "Execute HQL query and return results",
          bodySchema: {
            description: "HQL query to execute with optional execution options",
            fields: [
              {
                name: "query_string",
                type: "string",
                required: true,
                description: "The HQL query string to execute",
              },
              {
                name: "timeout_ms",
                type: "number",
                required: false,
                description: "Query timeout in milliseconds",
              },
              {
                name: "max_results",
                type: "number",
                required: false,
                description: "Maximum number of rows to return",
              },
            ],
          },
        },
      },
    },
  ],
};
