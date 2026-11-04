import type { ToolsetDefinition } from "../types.js";

/**
 * Unified search: semantic (meaning-based) search over Harness entities via
 * search-service. Results are scoped to the caller's account and RBAC-filtered
 * server-side. The backend is feature-flagged per account and is not deployed on
 * every cluster, so the toolset is opt-in (HARNESS_TOOLSETS=+unified-search).
 */

export const UNIFIED_SEARCH_PATH = "/search-service/api/v1/unified-search";
export const UNIFIED_SEARCH_SOURCES_PATH = `${UNIFIED_SEARCH_PATH}/sources`;

/** The source the entity shortcuts (entity_types, org_id, project_id) apply to. */
const ENTITIES_SOURCE = "entities";

/** Server-side bound on `limit` (per source). */
const MAX_LIMIT = 50;

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

// ─── Request building ────────────────────────────────────────────────────────

interface UnifiedSearchInput {
  query: string;
  limit?: number;
  sources?: string[];
  source_filters?: Record<string, unknown>;
  entity_types?: string[];
  org_id?: string;
  project_id?: string;
}

function eq(field: string, value: string): Record<string, unknown> {
  return { predicate: { field, op: "EQ", values: [{ string_value: value }] } };
}

/** Filter clauses the entity shortcuts expand to, ANDed on the `entities` source. */
function entityShortcutClauses(input: UnifiedSearchInput): unknown[] {
  const clauses: unknown[] = [];
  if (input.entity_types && input.entity_types.length > 0) {
    clauses.push({
      predicate: {
        field: "entity_type",
        op: "ANY",
        values: input.entity_types.map((t) => ({ string_value: t })),
      },
    });
  }
  if (input.org_id) {
    // Project-scoped entity types store org_identifier; platform:project stores orgIdentifier.
    clauses.push({
      group: { should: [eq("org_identifier", input.org_id), eq("orgIdentifier", input.org_id)] },
    });
  }
  if (input.project_id) {
    clauses.push(eq("project_identifier", input.project_id));
  }
  return clauses;
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
  const filters: Record<string, unknown> = { ...(input.source_filters ?? {}) };
  const shortcuts = entityShortcutClauses(input);
  if (shortcuts.length > 0) {
    const existing = filters[ENTITIES_SOURCE];
    const all = existing === undefined ? shortcuts : [existing, ...shortcuts];
    filters[ENTITIES_SOURCE] = all.length === 1 ? all[0] : { group: { must: all } };
  }

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
 * search_term/query/name/search and max_per_type as size/limit; org_id and
 * project_id are only present when the caller passed them (or a Harness URL),
 * never from configured defaults.
 */
export function unifiedSearchListBody(input: Record<string, unknown>): Record<string, unknown> {
  const query =
    asString(input.search_term) ?? asString(input.query) ?? asString(input.search) ?? asString(input.name) ?? "";
  const limit = asLimit(input.limit ?? input.size);
  return buildUnifiedSearchBody({
    query,
    // harness_list defaults size to 20 and allows up to 100; the server caps at 50.
    ...(limit !== undefined && { limit: Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT) }),
    sources: asList(input.sources),
    entity_types: asList(input.entity_types),
    org_id: asString(input.org_id),
    project_id: asString(input.project_id),
  });
}

/** harness_execute(action='search') input: everything comes from `body`. */
export function unifiedSearchExecuteBody(input: Record<string, unknown>): Record<string, unknown> {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const sourceFilters = body.source_filters;
  if (sourceFilters !== undefined && (typeof sourceFilters !== "object" || sourceFilters === null || Array.isArray(sourceFilters))) {
    throw new Error("body.source_filters must be an object keyed by source name, e.g. {entities: {predicate: {...}}}.");
  }
  const limit = asLimit(body.limit);
  return buildUnifiedSearchBody({
    query: asString(body.query) ?? "",
    ...(limit !== undefined && { limit }),
    sources: asList(body.sources),
    source_filters: sourceFilters as Record<string, unknown> | undefined,
    entity_types: asList(body.entity_types),
    org_id: asString(body.org_id),
    project_id: asString(body.project_id),
  });
}

// ─── Response shaping ────────────────────────────────────────────────────────

interface RawResult {
  id?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

interface RawResponse {
  query?: string;
  sources?: Array<{ source?: string; results?: RawResult[] }>;
}

/** Arguments for a harness_get call that fetches the full entity. */
interface HarnessGetRef {
  resource_type: string;
  resource_id: string;
  org_id?: string;
  project_id?: string;
}

export interface UnifiedSearchHit {
  source: string;
  entity_type?: string;
  name?: string;
  identifier?: string;
  org_id?: string;
  project_id?: string;
  score: number;
  harness_get?: HarnessGetRef;
  metadata: Record<string, unknown>;
}

/** Entity types whose identifiers map onto an existing harness_get resource. */
const PROJECT_LEVEL_TYPES: Record<string, string> = {
  "pipeline:pipeline": "pipeline",
  "cd:service": "service",
  "cd:environment": "environment",
};

function harnessGetRef(
  entityType: string | undefined,
  id: string | undefined,
  org: string | undefined,
  project: string | undefined,
): HarnessGetRef | undefined {
  if (!entityType || !id) return undefined;
  const projectLevel = PROJECT_LEVEL_TYPES[entityType];
  if (projectLevel) {
    return {
      resource_type: projectLevel,
      resource_id: id,
      ...(org && { org_id: org }),
      ...(project && { project_id: project }),
    };
  }
  if (entityType === "platform:project" && org) {
    return { resource_type: "project", resource_id: id, org_id: org };
  }
  if (entityType === "platform:organization") {
    return { resource_type: "organization", resource_id: id };
  }
  return undefined;
}

function toHit(source: string, raw: RawResult): UnifiedSearchHit {
  const metadata = raw.metadata ?? {};
  const entityType = asString(metadata.entity_type);
  const identifier = asString(metadata.identifier);
  const name = asString(metadata.name) ?? asString(metadata.title);
  const org = asString(metadata.org_identifier) ?? asString(metadata.orgIdentifier);
  const project = asString(metadata.project_identifier);
  const ref = harnessGetRef(entityType, identifier, org, project);
  return {
    source,
    ...(entityType && { entity_type: entityType }),
    ...(name && { name }),
    ...(identifier && { identifier }),
    ...(org && { org_id: org }),
    ...(project && { project_id: project }),
    score: typeof raw.score === "number" && Number.isFinite(raw.score) ? Math.round(raw.score * 1e4) / 1e4 : 0,
    ...(ref && { harness_get: ref }),
    metadata,
  };
}

const EMPTY_NOTE =
  "No matches. This is a real empty result (auth and feature-flag failures return errors). " +
  "If you filtered, check field names against an unfiltered search's metadata: a field a " +
  "source's documents do not carry matches nothing instead of erroring.";
const MULTI_SOURCE_NOTE = "Scores are per source and not comparable across sources.";

/** harness_list / harness_search: one flat list, each hit tagged with its source. */
export function unifiedSearchListExtract(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as RawResponse;
  const groups = r.sources ?? [];
  const items = groups.flatMap((g) => (g.results ?? []).map((res) => toHit(g.source ?? "unknown", res)));
  return {
    items,
    total: items.length,
    ...(items.length === 0 && { note: EMPTY_NOTE }),
    ...(groups.length > 1 && items.length > 0 && { note: MULTI_SOURCE_NOTE }),
  };
}

/** harness_execute(action='search'): grouped per source, as the API returns it. */
export function unifiedSearchExecuteExtract(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as RawResponse;
  const sources = (r.sources ?? []).map((g) => {
    const source = g.source ?? "unknown";
    const results = (g.results ?? []).map((res) => {
      const { source: _source, ...hit } = toHit(source, res);
      return hit;
    });
    return { source, count: results.length, results };
  });
  const total = sources.reduce((n, g) => n + g.count, 0);
  return {
    query: r.query ?? "",
    total,
    sources,
    ...(total === 0 && { note: EMPTY_NOTE }),
    ...(sources.length > 1 && total > 0 && { note: MULTI_SOURCE_NOTE }),
  };
}

export function unifiedSearchSourcesExtract(raw: unknown): Record<string, unknown> {
  const sources = ((raw ?? {}) as { sources?: Array<{ name?: string; description?: string }> }).sources ?? [];
  return { sources: sources.map((s) => ({ name: s.name ?? "", description: s.description ?? "" })) };
}

/** Compact mode (harness_search default) drops the raw metadata bag. */
function compactHit(item: Record<string, unknown>): Record<string, unknown> {
  const { metadata: _metadata, ...rest } = item;
  return rest;
}

// ─── Toolset definition ─────────────────────────────────────────────────────

const ENTITY_TYPE_EXAMPLES =
  "'cd:service', 'pipeline:pipeline', 'cd:environment', 'platform:project', 'platform:organization', 'aisre:incident'";

export const unifiedSearchToolset: ToolsetDefinition = {
  name: "unified-search",
  displayName: "Unified Search",
  description:
    "Semantic (meaning-based) search over Harness entities — services, pipelines, environments, " +
    "projects, organizations, AI SRE incidents — in the caller's account, RBAC-filtered. " +
    "Use for fuzzy or descriptive requests; use harness_list/harness_get when you know the identifier. " +
    "Requires the account's semantic search feature flag.",
  optIn: true,
  resources: [
    {
      resourceType: "unified_search",
      displayName: "Unified Search",
      description:
        "Semantic search across Harness entities. Quick: harness_search(query='payments service that keeps crashing') " +
        "or harness_list(resource_type='unified_search', filters={search_term: '...', entity_types: 'cd:service'}). " +
        "Filtered: harness_execute(resource_type='unified_search', action='search', body={query, entity_types, " +
        "source_filters, ...}). Each hit has entity_type, name, identifier, org_id, project_id, score, metadata " +
        "and, where known, harness_get args to fetch the full entity (which includes its UI link). " +
        "Not paginated; limit is per source (max 50).",
      toolset: "unified-search",
      scope: "account",
      // org_id/project_id are search filters, not request scope; never send configured defaults.
      scopeOptional: true,
      identifierFields: [],
      compactItem: compactHit,
      searchAliases: ["semantic search", "unified search", "find entity", "search entities", "hybrid search"],
      listFilterFields: [
        // Not `required`: harness_search skips required-filter types when resource_types is omitted.
        { name: "search_term", description: "Natural-language search text (required)." },
        { name: "entity_types", description: `Comma-separated entity types, e.g. ${ENTITY_TYPE_EXAMPLES}` },
        { name: "org_id", description: "Only entities in this organization" },
        { name: "project_id", description: "Only entities inside this project (excludes the project entity itself)" },
        { name: "sources", description: "Comma-separated source names (see unified_search_source); omit to search all" },
      ],
      executeHint:
        "1. Optional: list sources with harness_get(resource_type='unified_search_source'). " +
        "2. Search unfiltered first and read the hits' metadata to learn the filterable field names " +
        "(e.g. entity_type, name, identifier, org_identifier, project_identifier, type, status, severity). " +
        "3. Narrow: harness_execute(resource_type='unified_search', action='search', body={query: 'open sev1 incidents', " +
        "entity_types: ['aisre:incident'], source_filters: {entities: {predicate: {field: 'status', op: 'NE', " +
        "values: [{string_value: 'closed'}]}}}}). " +
        "Filter grammar: {predicate: {field, op, values: [{string_value|int_value|double_value|bool_value|datetime_value}]}} " +
        "or {group: {must: [...], should: [...], must_not: [...]}}. Ops: EQ, NE, CONTAINS, GT, GTE, LT, LTE (1 value), " +
        "ANY, NOT_ANY (1-100 values), IS_NULL, IS_EMPTY (no values). Max depth 5, 20 predicates. " +
        "entity_type values are namespaced ('cd:service', not 'service'). platform:project stores its org as " +
        "orgIdentifier; other types use org_identifier (the org_id shortcut covers both). " +
        "4. Fetch a hit: harness_get with the hit's harness_get args.",
      relatedResources: [
        { resourceType: "unified_search_source", relationship: "sources", description: "Sources unified search can address" },
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
            "Semantic search. Pass search_term; optional entity_types, org_id, project_id, sources. " +
            "size/limit is per source (max 50). Returns a flat list; each hit is tagged with its source.",
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
            "Semantic search with full filters. Shortcuts entity_types/org_id/project_id apply to the 'entities' " +
            "source; source_filters takes a filter per source and is ANDed with them. Returns hits grouped per source.",
          description: "Semantic search over Harness entities with filters",
          bodySchema: {
            description: "Unified search request",
            fields: [
              { name: "query", type: "string", required: true, description: "Natural-language search text" },
              { name: "limit", type: "number", required: false, description: "Max hits per source (1-50, default 10)" },
              {
                name: "entity_types",
                type: "array",
                itemType: "string",
                required: false,
                description: `Only these entity types, e.g. [${ENTITY_TYPE_EXAMPLES}]`,
              },
              { name: "org_id", type: "string", required: false, description: "Only entities in this organization" },
              { name: "project_id", type: "string", required: false, description: "Only entities inside this project" },
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
                  "Filter per source, keyed by source name, e.g. {entities: {group: {must: [...]}}}. " +
                  "See executeHint for the grammar.",
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
        "Sources unified search can address (e.g. 'entities'), with descriptions; configured per cluster. " +
        "harness_get(resource_type='unified_search_source') returns them all.",
      toolset: "unified-search",
      scope: "account",
      scopeOptional: true,
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
          description: "List unified search sources and their descriptions.",
        },
      },
    },
  ],
};
