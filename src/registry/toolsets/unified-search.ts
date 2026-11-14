import type { ToolsetDefinition } from "../types.js";
import {
  unifiedSearchExecuteExtract,
  unifiedSearchListExtract,
  unifiedSearchSourcesExtract,
} from "../extractors.js";

export { unifiedSearchExecuteExtract, unifiedSearchListExtract, unifiedSearchSourcesExtract };

/**
 * Unified search: semantic (meaning-based) search via search-service across
 * whatever sources it serves (the sources endpoint lists them). Results are
 * scoped to the caller's account and RBAC-filtered server-side. The backend is
 * feature-flagged per account and is not deployed on every cluster, so the
 * toolset is opt-in (HARNESS_TOOLSETS=+unified-search).
 *
 * Nothing here names a source, a metadata key or an entity type: requests pass
 * filters through keyed by source name, and hits come back as the service
 * returns them.
 */

export const UNIFIED_SEARCH_PATH = "/search-service/api/v1/unified-search";
export const UNIFIED_SEARCH_SOURCES_PATH = `${UNIFIED_SEARCH_PATH}/sources`;

/** Server-side bound on `limit` (per source). */
const MAX_LIMIT = 50;

/** Compact mode shortens metadata strings past this length. */
const COMPACT_MAX_STRING = 120;

// ─── Input helpers ───────────────────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Accepts an array or a comma-separated string (harness_list filters are flat strings). */
function asList(value: unknown): string[] | undefined {
  const parts = Array.isArray(value)
    ? value.map((v) => String(v).trim())
    : typeof value === "string"
      ? value.split(",").map((s) => s.trim())
      : [];
  const list = parts.filter((s) => s !== "");
  return list.length > 0 ? list : undefined;
}

function asLimit(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** The server rejects limits outside 1..MAX_LIMIT with a 400; clamp so every entry point behaves the same. */
function clampLimit(value: unknown): number | undefined {
  const n = asLimit(value);
  return n === undefined ? undefined : Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ─── Request building ────────────────────────────────────────────────────────

interface UnifiedSearchInput {
  query: string;
  limit?: number;
  sources?: string[];
  source_filters?: Record<string, unknown>;
}

/**
 * Build the search-service request body.
 *
 * Any source that has a filter is added to `sources` even when the caller did
 * not list it: the server searches every source unfiltered when `sources` is
 * empty, so leaving it out would silently drop the filter.
 */
export function buildUnifiedSearchBody(input: UnifiedSearchInput): Record<string, unknown> {
  if (!input.query) {
    throw new Error(
      "unified_search needs a query: pass search_term (harness_list), query (harness_search) or body.query (harness_execute).",
    );
  }
  const filters = input.source_filters ?? {};
  const names = new Set<string>(input.sources ?? []);
  for (const name of Object.keys(filters)) names.add(name);

  const body: Record<string, unknown> = { query: input.query };
  if (input.limit !== undefined) body.limit = input.limit;
  if (names.size > 0) {
    body.sources = Object.fromEntries(
      [...names].map((name) => [name, filters[name] === undefined ? {} : { filter: filters[name] }]),
    );
  }
  return body;
}

/**
 * harness_list / harness_search input. harness_search sends the query as
 * search_term/query/name/search and max_per_type as size/limit.
 */
export function unifiedSearchListBody(input: Record<string, unknown>): Record<string, unknown> {
  const query =
    asString(input.search_term) ?? asString(input.query) ?? asString(input.search) ?? asString(input.name) ?? "";
  // harness_list defaults size to 20 and allows up to 100; the server caps at 50.
  const limit = clampLimit(input.limit ?? input.size);
  return buildUnifiedSearchBody({
    query,
    ...(limit !== undefined && { limit }),
    sources: asList(input.sources),
  });
}

/** harness_execute(action='search') input: everything comes from `body`. */
export function unifiedSearchExecuteBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const sourceFilters = body.source_filters;
  if (sourceFilters !== undefined && !isObject(sourceFilters)) {
    throw new Error("body.source_filters must be an object keyed by source name, e.g. {'<source>': {predicate: {...}}}.");
  }
  const limit = clampLimit(body.limit);
  return buildUnifiedSearchBody({
    query: asString(body.query) ?? "",
    ...(limit !== undefined && { limit }),
    sources: asList(body.sources),
    source_filters: sourceFilters,
  });
}

/**
 * Compact mode (harness_search default): keep every scalar metadata value, whatever
 * the source, but shorten long strings and drop nested values, so a hit stays small
 * without this code knowing any source's keys.
 */
function compactHit(item: Record<string, unknown>): Record<string, unknown> {
  const { metadata, ...rest } = item;
  if (!isObject(metadata)) return rest;
  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      compact[key] = value.length > COMPACT_MAX_STRING ? `${value.slice(0, COMPACT_MAX_STRING)}…` : value;
    } else if (typeof value === "number" || typeof value === "boolean") {
      compact[key] = value;
    }
  }
  return { ...rest, metadata: compact };
}

// ─── Toolset definition ─────────────────────────────────────────────────────

const SOURCES_CALL = "harness_get(resource_type='unified_search_source')";
const KG_TYPES_CALL = "harness_list(resource_type='kg_queryable_type_summary')";
const KG_FIELDS_CALL = "harness_get(resource_type='kg_type', resource_id='<type id>', params={kind: '<kind>'})";

export const unifiedSearchToolset: ToolsetDefinition = {
  name: "unified-search",
  displayName: "Unified Search",
  description:
    "Semantic (meaning-based) search across every source search-service serves, in the caller's account, " +
    `RBAC-filtered; ${SOURCES_CALL} lists the sources. Start from the user's own words as the query. ` +
    "Use for fuzzy or descriptive requests; use harness_list/harness_get when you know the identifier. " +
    "Requires the account's semantic search feature flag.",
  optIn: true,
  resources: [
    {
      resourceType: "unified_search",
      displayName: "Unified Search",
      description:
        `Semantic search across all sources (list them with ${SOURCES_CALL}). Start with the query text: ` +
        "harness_search(query='...') or harness_list(resource_type='unified_search', filters={search_term: '...'}). " +
        "Each hit is {source, id, score, metadata}, as the source returns it. To narrow, filter on the metadata " +
        "keys a source's hits carry via harness_execute(resource_type='unified_search', action='search', " +
        "body={query, source_filters: {'<source>': <filter>}}). Not paginated; limit is per source (max 50).",
      toolset: "unified-search",
      // Account-scoped: org/project (configured or passed) are never sent; filtering is by hit metadata.
      scope: "account",
      identifierFields: [],
      compactItem: compactHit,
      searchAliases: ["semantic search", "unified search", "hybrid search", "search everything"],
      listFilterFields: [
        // Not `required`: harness_search skips required-filter types when resource_types is omitted.
        { name: "search_term", description: "Natural-language search text, normally the user's own words (required)." },
        { name: "sources", description: `Comma-separated source names (see ${SOURCES_CALL}); omit to search all` },
      ],
      executeHint:
        "1. Search with the user's query text first, unfiltered: harness_search(query='...') or " +
        "harness_list(resource_type='unified_search', filters={search_term: '...'}). This searches every source; " +
        `${SOURCES_CALL} lists them and what they hold, and sources=[...] restricts the search. ` +
        "2. To narrow, look at the hits from the source you care about: their metadata keys are the fields that " +
        "source indexes. Filter on those keys, keyed by that source's name, and use the value type the hit shows " +
        "(a value shown as a string, e.g. '4', needs string_value). If a metadata value names a Harness Knowledge " +
        `Graph type, ${KG_FIELDS_CALL} explains that type's fields and allowed values (${KG_TYPES_CALL} lists ` +
        "types and kinds); still filter only on keys the hits carry. For fields the hits do not carry, related " +
        "types, or exact counts (search returns only top matches), query that type with hql_query using the " +
        "hit's id value (harness_describe(resource_type='hql_query')). " +
        "3. Re-run with filters: harness_execute(resource_type='unified_search', action='search', body={query: '...', " +
        "source_filters: {'<source>': {predicate: {field: '<metadata key>', op: 'EQ', values: [{string_value: '...'}]}}}}). " +
        "Filter grammar: {predicate: {field, op, values: [{string_value|int_value|double_value|bool_value|datetime_value}]}} " +
        "or {group: {must: [...], should: [...], must_not: [...]}}. Ops: EQ, NE, CONTAINS, GT, GTE, LT, LTE (1 value), " +
        "ANY, NOT_ANY (1-100 values), IS_NULL, IS_EMPTY (no values). Max depth 5, 20 predicates. " +
        "GT/GTE/LT/LTE only match fields stored as numbers or RFC 3339 datetimes in hit metadata. " +
        "IS_EMPTY also matches a missing field; IS_NULL only an explicit null. " +
        "A field the documents do not carry, or a wrong value type, matches nothing rather than erroring. " +
        "4. For full details, use the hit's metadata (type and identifier keys) to find the matching Harness resource " +
        "(harness_describe(search_term='...')) and call harness_get.",
      relatedResources: [
        { resourceType: "unified_search_source", relationship: "sources", description: "Sources unified search can address" },
        {
          resourceType: "kg_queryable_type_summary",
          relationship: "types",
          description: "Knowledge Graph types, for hits whose metadata names one",
        },
        { resourceType: "kg_type", relationship: "type fields", description: "Field meanings and allowed values of a KG type" },
        {
          resourceType: "hql_query",
          relationship: "query",
          description: "More fields, related data or exact counts for hits whose metadata names a KG type",
        },
      ],
      operations: {
        list: {
          method: "POST",
          path: UNIFIED_SEARCH_PATH,
          bodyBuilder: unifiedSearchListBody,
          responseExtractor: unifiedSearchListExtract,
          skipScopeBodyInjection: true,
          skipCompact: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description:
            "Semantic search. Pass search_term; optional sources. size/limit is per source (max 50). " +
            "Returns a flat list of {source, id, score, metadata}.",
        },
      },
      executeActions: {
        search: {
          method: "POST",
          path: UNIFIED_SEARCH_PATH,
          bodyBuilder: unifiedSearchExecuteBody,
          responseExtractor: unifiedSearchExecuteExtract,
          skipScopeBodyInjection: true,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          actionDescription:
            "Semantic search with filters. source_filters takes one filter per source, keyed by source name, on " +
            "the metadata keys that source's hits carry. Returns hits grouped per source.",
          description: "Semantic search across sources with filters",
          bodySchema: {
            description: "Unified search request",
            fields: [
              { name: "query", type: "string", required: true, description: "Natural-language search text" },
              { name: "limit", type: "number", required: false, description: "Max hits per source (1-50, default 10; out-of-range values are clamped)" },
              {
                name: "sources",
                type: "array",
                itemType: "string",
                required: false,
                description: "Sources to search; omit for all. Sources in source_filters are added automatically.",
              },
              {
                name: "source_filters",
                type: "object",
                required: false,
                description:
                  "Filter per source, keyed by source name, e.g. {'<source>': {group: {must: [...]}}}. " +
                  "Fields are the metadata keys that source's hits carry. See executeHint for the grammar.",
              },
            ],
          },
        },
      },
    },
    {
      resourceType: "unified_search_source",
      displayName: "Unified Search Source",
      description:
        "Every source unified search can address, as the service describes them; configured per cluster. " +
        `${SOURCES_CALL} returns them all.`,
      toolset: "unified-search",
      scope: "account",
      identifierFields: [],
      searchAliases: ["unified search sources", "semantic search sources"],
      // A get, not a list: harness_search scatters over every listable type, and a
      // static source list would match every query.
      operations: {
        get: {
          method: "GET",
          path: UNIFIED_SEARCH_SOURCES_PATH,
          responseExtractor: unifiedSearchSourcesExtract,
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "List unified search sources as the service describes them.",
        },
      },
    },
  ],
};
