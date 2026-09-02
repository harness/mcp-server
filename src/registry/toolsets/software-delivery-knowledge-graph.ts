import type { ToolsetDefinition, FilterFieldSpec, ParamsSchema } from "../types.js";
import { stripInternalMeta } from "../../utils/strip-meta.js";

const QUERY_SVC =
  "/query-service/grpc/io.harness.platform.query.service.api.v1.QueryServiceGrpc";

const SCHEMA_SVC =
  "/schema-service/grpc/io.harness.platform.schema.service.api.v1.SchemaServiceGrpc";

// ─── Response extractors ─────────────────────────────────────────────────────

const MAX_DESC_LEN = 80;

/**
 * Summary-only extractor for queryable types.
 *
 * Returns id, name, description (truncated), object_kind, connectorId, annotations.
 * No field metadata.
 */
const queryableTypeSummaryExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { queryable_types?: Record<string, unknown>[] };
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
  const r = raw as { grammar?: string };
  const grammar = r.grammar;
  return grammar !== undefined ? { grammar } : raw;
};

/**
 * Map an HQL executeQuery response to a stable {columns, rows, stats} contract.
 * The query-service may wrap the payload in `data`/`result`; we unwrap it and
 * project only the actionable fields so backend envelope/debug/meta fields do
 * not leak across the public tool boundary.
 */
const hqlRunExtract = (raw: unknown): unknown => {
  const top = (raw ?? {}) as Record<string, unknown>;
  const inner =
    (top.data as Record<string, unknown> | undefined) ??
    (top.result as Record<string, unknown> | undefined) ??
    top;

  const out: Record<string, unknown> = {
    columns: inner.columns ?? [],
    rows: inner.rows ?? [],
  };
  if (inner.stats != null) out.stats = inner.stats;
  return out;
};

/**
 * List extractor — compact-safe projection for type selection.
 * Returns only fields that survive harness_list compaction:
 * identifier, name, description, kind (TYPE_FIELDS), category (TYPE_FIELDS).
 * Full field metadata (fields, join_predicates, enrichment_fields) is only
 * returned by the get operation.
 */
const schemaTypesExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as Record<string, unknown>;
  const items: unknown[] = [];
  const categoryMap: Record<string, string> = {
    entity_types: "entity",
    relationship_types: "relationship",
    event_types: "event",
    metric_types: "metric",
    view_types: "view",
    config_types: "config",
    data_model_types: "data_model",
  };

  const MAX_DESC = 120;

  for (const [key, category] of Object.entries(categoryMap)) {
    const arr = r[key];
    if (Array.isArray(arr)) {
      for (const type of arr) {
        const typeObj = type as Record<string, unknown>;
        const id = (typeObj.id ?? typeObj.identifier) as string | undefined;
        if (!id) continue;

        const rawDesc = (typeObj.description as string) ?? "";
        const description = rawDesc.length > MAX_DESC ? rawDesc.slice(0, MAX_DESC) + "..." : rawDesc;

        const item: Record<string, unknown> = {
          identifier: id,
          name: typeObj.name ?? id,
          category,           // "entity" | "relationship" | "event" | "metric" | "view" | "config" | "data_model"
          kind: typeObj.kind, // OBJECT_KIND_* when present
        };
        if (description) item.description = description;

        items.push(item);
      }
    }
  }
  return { items, total: items.length };
};

const schemaTypeExtract = (raw: unknown): unknown => {
  const r = raw as { type?: Record<string, unknown> };
  if (!r.type) return raw;
  const typeObj = r.type;
  const oneofKeys = [
    "entity_type", "relationship_type", "event_type",
    "metric_type", "config_type", "view_type", "data_model_type",
  ];
  for (const key of oneofKeys) {
    if (typeObj[key]) {
      const cleaned = stripInternalMeta(typeObj[key]) as Record<string, unknown>;

      if (key === "relationship_type") {
        const relObj = typeObj[key] as Record<string, unknown>;
        const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
        const hasDcsEnrichment = (annotations ?? []).some(
          (a) => (a.key as string) === "dcs_enrichment",
        );
        if (hasDcsEnrichment) {
          // Re-strip each reattached field — the raw relObj values may carry
          // nested columnMappingMeta that the earlier strip would otherwise miss.
          cleaned.dcs_enrichment = true;
          cleaned.join_predicates = stripInternalMeta(relObj.join_predicates);
          cleaned.left_reference = stripInternalMeta(relObj.left_reference);
          cleaned.right_reference = stripInternalMeta(relObj.right_reference);
          if (relObj.fields) cleaned.enrichment_fields = stripInternalMeta(relObj.fields);
        }
      }

      return cleaned;
    }
  }
  return stripInternalMeta(typeObj);
};

/**
 * Extract related types, preserving dcs_enrichment relationship data.
 */
const relatedTypesExtract = (raw: unknown): unknown => {
  const r = raw as Record<string, unknown>;
  const cleaned = stripInternalMeta(r) as Record<string, unknown>;

  const relationships = r.relationship_types ?? r.relationships;
  if (Array.isArray(relationships)) {
    const enrichments: unknown[] = [];
    for (const rel of relationships) {
      const relObj = rel as Record<string, unknown>;
      const annotations = relObj.annotations as Record<string, unknown>[] | undefined;
      const hasDcsEnrichment = (annotations ?? []).some(
        (a) => (a.key as string) === "dcs_enrichment",
      );
      if (hasDcsEnrichment) {
        // Strip each reattached field — raw relObj values may carry nested
        // columnMappingMeta that must not leak back into the cleaned response.
        enrichments.push({
          id: relObj.id,
          description: relObj.description,
          annotations: annotations?.map((a) => a.key),
          left_reference: stripInternalMeta(relObj.left_reference),
          right_reference: stripInternalMeta(relObj.right_reference),
          join_predicates: stripInternalMeta(relObj.join_predicates),
          fields: stripInternalMeta(relObj.fields),
        });
      }
    }
    if (enrichments.length > 0) {
      cleaned.dcs_enrichments = enrichments;
    }
  }

  return cleaned;
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

function schemaTypesBody(input: Record<string, unknown>) {
  const objectKind = input.object_kind as string | string[] | undefined;
  if (!objectKind) return {};
  const kinds = Array.isArray(objectKind) ? objectKind : [objectKind];
  return { filter: { objectKind: kinds } };
}

function requireTypeId(input: Record<string, unknown>): string {
  const id = input.type_id;
  if (id === undefined || id === "") {
    throw new Error(
      "Missing required identifier for software_delivery_knowledge_graph_type/software_delivery_knowledge_graph_related_type. " +
        "Pass the type id as resource_id " +
        "(e.g. harness_get(resource_type='software_delivery_knowledge_graph_type', resource_id='<id>', params={kind: '<kind>'})).",
    );
  }
  return String(id);
}

function schemaTypeGetBody(input: Record<string, unknown>) {
  return {
    kind: input.kind as string,
    id: requireTypeId(input),
  };
}

function relatedTypesBody(input: Record<string, unknown>) {
  return {
    type_reference: {
      object_kind: input.kind as string,
      id: requireTypeId(input),
    },
    include_transitive: input.include_transitive === true,
  };
}

// ─── Object kinds ─────────────────────────────────────────────────────────────

// Kinds that are queryable via HQL (subset backing kg_queryable_type_summary).
const QUERYABLE_OBJECT_KINDS = [
  "OBJECT_KIND_ENTITY",
  "OBJECT_KIND_EVENT",
  "OBJECT_KIND_METRIC",
  "OBJECT_KIND_VIEW",
  "OBJECT_KIND_RELATIONSHIP",
];

// Full set of schema kinds (includes non-queryable config/data-model types).
const SCHEMA_OBJECT_KINDS = [
  "OBJECT_KIND_ENTITY",
  "OBJECT_KIND_RELATIONSHIP",
  "OBJECT_KIND_EVENT",
  "OBJECT_KIND_METRIC",
  "OBJECT_KIND_CONFIG",
  "OBJECT_KIND_VIEW",
  "OBJECT_KIND_DATA_MODEL",
];

// ─── Filter fields ───────────────────────────────────────────────────────────

const KG_QUERYABLE_TYPE_FILTERS: FilterFieldSpec[] = [
  {
    name: "kinds",
    description:
      "Filter by object kind(s). Pass one or more OBJECT_KIND_* values. " +
      "Use OBJECT_KIND_VIEW for dashboard-style types, OBJECT_KIND_ENTITY for base entities.",
    enum: QUERYABLE_OBJECT_KINDS,
  },
  {
    name: "annotations",
    description:
      "Filter by annotation key(s). Only types with at least one matching annotation are returned.",
  },
];

const KG_TYPE_FILTERS: FilterFieldSpec[] = [
  {
    name: "object_kind",
    description: "Filter by type kind",
    enum: SCHEMA_OBJECT_KINDS,
  },
];

// ─── Params schemas (surfaced via harness_describe) ──────────────────────────

const KG_TYPE_GET_PARAMS: ParamsSchema = {
  fields: [
    {
      name: "kind",
      required: true,
      description:
        "Object kind of the type. One of OBJECT_KIND_*. The same identifier can exist under multiple " +
        "kinds with different fields — use the exact kind returned by software_delivery_knowledge_graph_queryable_type_summary (for " +
        "queryable types) or software_delivery_knowledge_graph_type list, not a guess.",
    },
  ],
};

const KG_RELATED_GET_PARAMS: ParamsSchema = {
  fields: [
    {
      name: "kind",
      required: true,
      description:
        "Object kind of the source type. One of OBJECT_KIND_*. The same identifier can exist under " +
        "multiple kinds with different fields — use the exact kind returned by software_delivery_knowledge_graph_queryable_type_summary " +
        "(for queryable types) or software_delivery_knowledge_graph_type list, not a guess.",
    },
    {
      name: "include_transitive",
      required: false,
      description: "Include transitive relationships (default: false).",
    },
  ],
};

// ─── Toolset definition ─────────────────────────────────────────────────────

export const softwareDeliveryKnowledgeGraphToolset: ToolsetDefinition = {
  name: "software_delivery_knowledge_graph",
  aliases: ["knowledge-graph", "semantic-layer"],
  displayName: "Software Delivery Knowledge Graph",
  description:
    "Harness Software Delivery Knowledge Graph — explore the semantic data model and build and " +
    "execute HQL (Harness Query Language) queries. Discover queryable types, inspect full schema " +
    "types (including non-queryable ones), their field metadata, and relationships, then validate " +
    "and run queries. Start with software_delivery_knowledge_graph_queryable_type_summary to pick " +
    "relevant types, get field details per type via software_delivery_knowledge_graph_type, explore " +
    "connections via software_delivery_knowledge_graph_related_type, and use hql_query to validate " +
    "and run queries.",
  resources: [
    {
      resourceType: "software_delivery_knowledge_graph_queryable_type_summary",
      aliases: ["kg_queryable_type_summary"],
      searchAliases: ["kg"],
      displayName: "Queryable Type Summary",
      description:
        "Lightweight summaries of types queryable via HQL. Returns identifier (type_id for " +
        "HQL queries), name, description, kind (OBJECT_KIND_*), connectorId, tags. No field " +
        "metadata. Use this FIRST to select types, then fetch field details per type via " +
        "harness_get(resource_type='software_delivery_knowledge_graph_type', resource_id='<identifier>', params={kind: '<kind>'}). " +
        "Types sharing the same non-empty connectorId can be JOINed. Empty connectorId means " +
        "no shared backing connector—do not infer JOIN eligibility from connector alone. " +
        "Pass 'kinds' to filter.",
      toolset: "software_delivery_knowledge_graph",
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
            "Pass kinds=[...] to filter. Use identifier + kind to fetch field details via software_delivery_knowledge_graph_type get.",
        },
      },
    },

    {
      resourceType: "software_delivery_knowledge_graph_grammar",
      aliases: ["kg_grammar"],
      searchAliases: ["kg"],
      displayName: "HQL Grammar",
      description:
        "The formal ANTLR4 grammar (.g4) for HQL (Harness Query Language). " +
        "Fetch this ONCE when you need to write HQL queries to learn the full " +
        "syntax: find/filter/select/group_by/order_by/join/having/with (CTEs), " +
        "window functions, array functions, case/when, cast, interval, unnest, etc. " +
        "Returns { grammar: \"<ANTLR4 .g4 text>\" }.",
      toolset: "software_delivery_knowledge_graph",
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
      resourceType: "software_delivery_knowledge_graph_type",
      aliases: ["kg_type"],
      searchAliases: ["kg"],
      displayName: "Schema Type",
      description:
        "A type in the Harness Knowledge Graph schema (entity, event, metric, view, relationship, " +
        "config, or data model). List returns a compact summary (identifier, name, category, kind, description) " +
        "for all types including non-queryable ones. Use get for full field metadata. " +
        "For HQL query building, use software_delivery_knowledge_graph_queryable_type_summary instead.",
      toolset: "software_delivery_knowledge_graph",
      scope: "account",
      identifierFields: ["type_id"],
      listFilterFields: KG_TYPE_FILTERS,
      operations: {
        list: {
          method: "POST",
          path: `${SCHEMA_SVC}/getTypes`,
          headers: {},
          bodyBuilder: schemaTypesBody,
          responseExtractor: schemaTypesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List all schema types, optionally filtered by kind. Returns id, name, category, kind, description. Use get for full field metadata.",
        },
        get: {
          method: "POST",
          path: `${SCHEMA_SVC}/getType`,
          headers: {},
          bodyBuilder: schemaTypeGetBody,
          responseExtractor: schemaTypeExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Get a single schema type by kind and ID. Pass the type id as resource_id and the required kind via params.",
          paramsSchema: KG_TYPE_GET_PARAMS,
        },
      },
    },

    {
      resourceType: "software_delivery_knowledge_graph_related_type",
      aliases: ["kg_related_type"],
      searchAliases: ["kg"],
      displayName: "Related Types",
      description:
        "Related types for a given source type in the Knowledge Graph. Shows which types are " +
        "connected via relationships. Use for understanding the data model structure. " +
        "Pass the type ID as resource_id and kind via params.",
      toolset: "software_delivery_knowledge_graph",
      scope: "account",
      identifierFields: ["type_id"],
      // No listFilterFields: software_delivery_knowledge_graph_related_type only supports `get`.
      // `kind` and `include_transitive` are documented via the get operation's paramsSchema,
      // not as list filters (which harness_list would otherwise advertise globally).
      operations: {
        get: {
          method: "POST",
          path: `${SCHEMA_SVC}/getRelatedTypes`,
          headers: {},
          bodyBuilder: relatedTypesBody,
          responseExtractor: relatedTypesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Get types related to a source type. Pass the type id as resource_id, the required kind, " +
            "and optionally include_transitive (default: false) via params.",
          paramsSchema: KG_RELATED_GET_PARAMS,
        },
      },
    },

    {
      resourceType: "hql_query",
      searchAliases: ["kg"],
      displayName: "HQL Query",
      description:
        "Harness Query Language (HQL) query operations. Use validate to check syntax, " +
        "then run to execute and get results. Pass the HQL query string in body.query_string.",
      toolset: "software_delivery_knowledge_graph",
      scope: "account",
      identifierFields: [],
      executeHint:
        "1. Learn grammar: harness_get(resource_type='software_delivery_knowledge_graph_grammar'). " +
        "2. Discover types: harness_list(resource_type='software_delivery_knowledge_graph_queryable_type_summary') — note the 'identifier' and 'kind' fields. " +
        "3. Get fields per type: harness_get(resource_type='software_delivery_knowledge_graph_type', resource_id='<identifier>', params={kind: '<kind>'}). " +
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
            const r = raw as { is_valid?: boolean; errors?: unknown[] };
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
