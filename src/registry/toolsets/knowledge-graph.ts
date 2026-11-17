import type { ToolsetDefinition, FilterFieldSpec } from "../types.js";
import {
  grammarExtract,
  hqlRunExtract,
  hqlValidateExtract,
  queryableTypeSummaryExtract,
} from "../extractors.js";

const QUERY_SVC =
  "/query-service/grpc/io.harness.platform.query.service.api.v1.QueryServiceGrpc";

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
  // Always ask for stats: they carry the engine's `truncated` signal, so a
  // caller can tell a complete row set from a prefix. Requesting them only when
  // some other execution option happened to be passed made truncation invisible
  // on the common call.
  return {
    query_string: extractQueryString(input),
    options: {
      ...(timeoutMs != null ? { timeout_ms: Number(timeoutMs) } : {}),
      ...(maxResults != null ? { max_results: Number(maxResults) } : {}),
      include_stats: true,
    },
  };
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
        "Returns { grammar: \"<ANTLR4 .g4 text>\" }.",
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
            "Fetch the HQL grammar definition. Returns { grammar: \"<ANTLR4 .g4 text>\" }.",
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
          responseExtractor: hqlValidateExtract,
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
            "Optionally pass timeout_ms and max_results in body. " +
            "In hosts that render MCP Apps, results show as a chart; optionally label it with " +
            "params.view={title, chart: kpi|line|area|bar|pie|table}, or for a queries batch " +
            "params.view={title, panels: [{title, chart}, ...]} in query order. The query engine ignores params.view.",
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
