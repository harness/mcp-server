import type { PathBuilderConfig, ToolsetDefinition } from "../types.js";
import { ngExtract, passthrough, v1ListExtract } from "../extractors.js";

/** Stashed on `input` by pathBuilder for bodyBuilder to consume. Underscore prefix marks private. */
const AUTH_HEADER_KEY = "__auth_header";

const scorecardStatsExtract = (raw: unknown): unknown => {
  const r = raw as { name?: string; stats?: unknown[]; timestamp?: number | null };
  return {
    name: r.name,
    stats: r.stats ?? [],
    time: r.timestamp != null ? new Date(r.timestamp).toISOString() : "",
  };
};

export const idpToolset: ToolsetDefinition = {
  name: "idp",
  displayName: "Internal Developer Portal",
  description: "Harness IDP — service catalog entities, scorecards, checks, and workflows",
  resources: [
    {
      resourceType: "idp_entity",
      displayName: "IDP Entity",
      description: "Internal Developer Portal catalog entity. Supports list and get. Lists Harness IDP catalog metadata (services, APIs, user groups, resources, etc.) including identifier, scope, kind, ref type (INLINE/GIT), YAML, Git details, ownership, tags, lifecycle, scorecards, status, and group.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["kind", "entity_id"],
      listFilterFields: [
        { name: "kind", description: "Comma-separated list of entity kinds to fetch. Defaults to 'component,api,resource'.", enum: ["api", "component", "environment", "environmentblueprint", "group", "resource", "user", "workflow"] },
        { name: "search_term", description: "Filter entities by name or keyword" },
        { name: "scope_level", description: "Scope level for the entities query. 'default' uses the configured org/project; 'account', 'org', and 'project' force that scope explicitly.", enum: ["default", "account", "org", "project"] },
        { name: "sort", description: "Sort entities (e.g. 'name,ASC')" },
        { name: "owned_by_me", description: "Only return entities owned by the current user", type: "boolean" },
        { name: "favorites", description: "Only return entities the current user has favorited", type: "boolean" },
        { name: "type", description: "Comma-separated list of entity types to filter on" },
        { name: "owner", description: "Comma-separated list of owner references to filter on" },
        { name: "lifecycle", description: "Comma-separated list of lifecycles to filter on (e.g. 'experimental,production')" },
        { name: "tags", description: "Comma-separated list of tags to filter on" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/idp/catalog",
      operations: {
        list: {
          method: "GET",
          path: "/v1/entities",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input, config) => {
            const scopeLevel = String(input.scope_level ?? "default").toLowerCase();
            const orgId = (input.org_id as string) || config.HARNESS_ORG || "";
            const projectId = (input.project_id as string) || config.HARNESS_PROJECT || "";

            let scopes: string;
            switch (scopeLevel) {
              case "account":
                scopes = "account";
                break;
              case "org":
                scopes = orgId ? `account.${orgId}` : "account.org";
                break;
              case "project":
                if (orgId && projectId) scopes = `account.${orgId}.${projectId}`;
                else if (orgId) scopes = `account.${orgId}.project`;
                else scopes = "account.org.project";
                break;
              default:
                if (orgId && projectId) scopes = `account.${orgId}.${projectId}`;
                else if (orgId) scopes = `account.${orgId}.*`;
                else scopes = "account.*";
            }
            input.scopes = scopes;

            if (orgId) input.org_id = orgId;
            if (projectId) input.project_id = projectId;

            return "/v1/entities";
          },
          queryParams: {
            page: "page",
            size: "limit",
            search_term: "search_term",
            sort: "sort",
            owned_by_me: "owned_by_me",
            favorites: "favorites",
            kind: "kind",
            type: "type",
            owner: "owner",
            lifecycle: "lifecycle",
            tags: "tags",
            scopes: "scopes",
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
          },
          defaultQueryParams: {
            page: "0",
            limit: "20",
            kind: "component,api,resource",
            owned_by_me: "false",
            favorites: "false",
          },
          responseExtractor: v1ListExtract(),
          description: "List IDP catalog entities. Defaults: page=0, limit=20 (max 100). If 'limit' is not supplied, paginate by calling repeatedly. Note: workflow entities may include a 'token' field — IGNORE it.",
        },
        get: {
          method: "GET",
          path: "/v1/entities/{scope}/{kind}/{entityId}",
          pathBuilder: (input) => {
            let scope = "account";
            const orgId = input.org_id as string | undefined;
            const projectId = input.project_id as string | undefined;
            if (orgId) {
              scope += `.${orgId}`;
              if (projectId) {
                scope += `.${projectId}`;
              }
            }

            const kind = input.kind as string | undefined;
            const entityId = input.entity_id as string | undefined;
            if (!kind) {
              throw new Error(`Missing required field "kind" for idp_entity. Pass it via params: { kind: "component" }.`);
            }
            if (!entityId) {
              throw new Error(`Missing required field "entity_id" for idp_entity. Pass it via params or as resource_id.`);
            }

            if (orgId) input.org_id = orgId;
            if (projectId) input.project_id = projectId;

            return `/v1/entities/${encodeURIComponent(scope)}/${encodeURIComponent(kind)}/${encodeURIComponent(entityId)}`;
          },
          queryParams: {
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          description: "Get details of a specific IDP catalog entity by kind + entity_id. Returns the entity's identifier, scope, kind, ref type (INLINE/GIT), YAML, Git details, ownership, tags, lifecycle, scorecards, status, and group. Use list_entities first to discover the entity_id. Note: workflow entities may include a 'token' field — IGNORE it.",
        },
      },
    },
    {
      resourceType: "scorecard",
      displayName: "Scorecard",
      description: "IDP scorecard for tracking developer standards. Supports list and get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["scorecard_id"],
      deepLinkTemplate: "/ng/account/{accountId}/idp/scorecards/{scorecardIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/v1/scorecards",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: v1ListExtract("scorecard"),
          description: "List scorecards in the Harness IDP Catalog. Returns all scorecards (no pagination).",
        },
        get: {
          method: "GET",
          path: "/v1/scorecards/{scorecardIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { scorecard_id: "scorecardIdentifier" },
          description: "Get details of a specific scorecard in the Harness IDP Catalog. Use this only when the scorecard_id is known (use list_scorecards first to discover it).",
        },
      },
    },
    {
      resourceType: "scorecard_check",
      displayName: "Scorecard Check",
      description: "Individual check within an IDP scorecard. A check is a query performed against a data point for a software component which results in either Pass or Fail. Supports list and get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["check_id"],
      listFilterFields: [
        { name: "search_term", description: "Filter checks by name or keyword" },
        { name: "sort_type", description: "Field to sort checks by", enum: ["name", "description", "data_source"] },
        { name: "sort_order", description: "Sort direction", enum: ["ASC", "DESC"] },
        { name: "is_custom", description: "(get only) Whether the check is a custom check. Set to true for custom checks; defaults to false.", type: "boolean" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/v1/checks",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => {
            // Mirror the Go tool's behavior: combine sort_type + sort_order into a
            // single `sort` query value (e.g. "name,ASC"). Only set when not
            // already provided by the caller.
            if (!input.sort && input.sort_type) {
              const order = input.sort_order ? `,${String(input.sort_order)}` : "";
              input.sort = `${String(input.sort_type)}${order}`;
            }
            return "/v1/checks";
          },
          queryParams: {
            page: "page",
            size: "limit",
            search_term: "search_term",
            sort: "sort",
          },
          responseExtractor: v1ListExtract("check"),
          description: "List scorecard checks in the Harness IDP Catalog.",
        },
        get: {
          method: "GET",
          path: "/v1/checks/{checkIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { check_id: "checkIdentifier" },
          queryParams: { is_custom: "custom" },
          defaultQueryParams: { custom: "false" },
          description: "Get details of a specific scorecard check. Pass is_custom=true for custom checks (the scorecard details indicate this).",
        },
      },
    },
    {
      resourceType: "scorecard_stats",
      displayName: "Scorecard Stats",
      description: "Aggregate statistics for an IDP scorecard — the scores of every entity that has this scorecard configured. Supports get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["scorecard_id"],
      deepLinkTemplate: "/ng/account/{accountId}/idp/scorecards/{scorecardIdentifier}",
      operations: {
        get: {
          method: "GET",
          path: "/v1/scorecards/{scorecardIdentifier}/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { scorecard_id: "scorecardIdentifier" },
          responseExtractor: scorecardStatsExtract,
          description: "Get aggregate stats for a scorecard — the scores of every entity that has this scorecard configured. The raw 'timestamp' field is converted to RFC3339 'time'.",
        },
      },
    },
    {
      resourceType: "scorecard_check_stats",
      displayName: "Scorecard Check Stats",
      description: "Statistics for a specific scorecard check — the PASS/FAIL status for every entity whose scorecard contains this check. Supports get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["check_id"],
      deepLinkTemplate: "/ng/account/{accountId}/idp/scorecards",
      operations: {
        get: {
          method: "GET",
          path: "/v1/checks/{checkIdentifier}/stats",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { check_id: "checkIdentifier" },
          queryParams: { is_custom: "custom" },
          defaultQueryParams: { custom: "false" },
          responseExtractor: scorecardStatsExtract,
          description: "Get stats for a scorecard check — the PASS/FAIL status for every entity whose scorecard contains this check. Pass is_custom=true for custom checks. The raw 'timestamp' field is converted to RFC3339 'time'.",
        },
      },
    },
    {
      resourceType: "idp_score",
      displayName: "IDP Score",
      description: "Per-scorecard scores for an entity in the Harness IDP Catalog. Supports list (returns all scorecard scores for the given entity).",
      toolset: "idp",
      scope: "account",
      identifierFields: ["entity_identifier"],
      listFilterFields: [
        { name: "entity_identifier", description: "Entity identifier in 'namespace/Kind/name' format (e.g. 'default/Component/my-service'). Required.", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/v1/scores",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            entity_identifier: "entity_identifier",
          },
          responseExtractor: (raw: unknown) => {
            const r = raw as { overall_score?: number; scorecard_scores?: unknown[] };
            const items = r.scorecard_scores ?? [];
            return { overall_score: r.overall_score, items, total: items.length };
          },
          description: "Get scores for every scorecard configured against an entity. Required filter: entity_identifier (format 'namespace/Kind/name', e.g. 'default/Component/my-service').",
        },
      },
    },
    {
      resourceType: "idp_score_summary",
      displayName: "IDP Score Summary",
      description: "Aggregate score summary across all scorecards for an entity. Supports get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["entity_identifier"],
      operations: {
        get: {
          method: "GET",
          path: "/v1/scores/summary",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathBuilder: (input) => {
            if (!input.entity_identifier) {
              throw new Error(
                "Missing required field 'entity_identifier' for idp_score_summary. " +
                "Pass it via params or as resource_id (format: 'namespace/Kind/name', e.g. 'default/Component/my-service').",
              );
            }
            return "/v1/scores/summary";
          },
          queryParams: {
            entity_identifier: "entity_identifier",
          },
          description: "Get aggregate score summary across all scorecards for an entity. Required: entity_identifier (format 'namespace/Kind/name', e.g. 'default/Component/my-service').",
        },
      },
    },
    {
      resourceType: "idp_workflow",
      displayName: "IDP Workflow",
      description: "IDP self-service workflow. Supports list and execute action.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["workflow_id"],
      listFilterFields: [
        { name: "scope_level", description: "Scope level filter (ACCOUNT, ORG, PROJECT, ALL)", enum: ["ACCOUNT", "ORG", "PROJECT", "ALL"] },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/v1/entities",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            scope_level: "scope_level",
          },
          defaultQueryParams: { kind: "workflow", scope_level: "ACCOUNT" },
          responseExtractor: v1ListExtract(),
          description: "List IDP workflows",
        },
      },
      executeActions: {
        execute: {
          method: "POST",
          path: "/v2/workflows/execute",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathBuilder: (input, config) => {
            // Mirror addScope() — propagate org/project to query params so the
            // request includes orgIdentifier/projectIdentifier when supplied.
            const orgId = (input.org_id as string) || config.HARNESS_ORG || "";
            const projectId = (input.project_id as string) || config.HARNESS_PROJECT || "";
            if (orgId) input.org_id = orgId;
            if (projectId) input.project_id = projectId;
            // Stash auth header value for bodyBuilder to inject into values.token
            // (mirrors Go's `inputSet["token"] = authHeaderVal`). bodyBuilder
            // has no config access, so we route the value through input.
            // For external (PAT) mode this is the raw API key — no `Bearer`
            // prefix — matching APIKeyProvider.GetHeader().
            const cfg = config as PathBuilderConfig & { HARNESS_API_KEY?: string };
            input[AUTH_HEADER_KEY] = cfg.HARNESS_API_KEY ?? "";
            return "/v2/workflows/execute";
          },
          queryParams: {
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
          },
          bodyBuilder: (input) => {
            const identifier = input.identifier as string | undefined;
            if (!identifier) {
              throw new Error("missing required parameter: identifier");
            }
            const values = { ...((input.values as Record<string, unknown> | undefined) ?? {}) };
            // Auto-inject auth token so workflow inputs of type HarnessAuthToken
            // resolve without prompting the user (matches Go's NgManagerAuthProvider).
            const authHeader = input[AUTH_HEADER_KEY] as string | undefined;
            if (authHeader) values.token = authHeader;
            return { identifier, values };
          },
          responseExtractor: ngExtract,
          actionDescription:
            "Execute a workflow in the Harness Internal Developer Portal Catalog. This tool takes in the entity metadata of the workflow and a set of values to be used for the execution.\n" +
            "Usage Guidance:\n" +
            "- Use the get_entity tool to fetch the workflow details\n" +
            "- The set of values provided has to be validated against the input set required by the workflow.\n" +
            "- Provide only non-authentication parameters in the values object\n" +
            "- All HarnessAuthToken fields should be OMITTED regardless of workflow requirements\n" +
            "- Validate other required parameters against the workflow's input set\n" +
            "⚠️ IMPORTANT:\n" +
            "- NEVER request or include token values when executing workflows. The system handles authentication automatically - DO NOT prompt users for tokens, even if they appear as required parameters in the workflow definition.\n" +
            "- DO NOT execute the workflow if the valueset is not sufficient.",
          bodySchema: {
            description: "Workflow execution inputs.",
            fields: [
              {
                name: "workflow_details",
                type: "object",
                required: false,
                description:
                  "A json representation of the workflow entity. This json contains the metadata of the workflow(like owner, name, description, ref etc) and a yaml field which should contain the spec.parameters against which the values should be validated. Only the parameters marked required are mandatory.",
              },
              {
                name: "identifier",
                type: "string",
                required: true,
                description: "The identifier of the workflow to be executed. This can be extracted from the field identifier of the workflow_details.",
              },
              {
                name: "values",
                type: "object",
                required: false,
                description:
                  "The values to be used for the workflow execution. The values should be in the format of a json object. These values are to be validated against the parameters of the workflow. Do NOT validate the field of type HarnessAuthToken, it is not to be provided in the prompt.",
              },
            ],
          },
        },
      },
    },
    {
      resourceType: "idp_tech_doc",
      displayName: "IDP Tech Doc",
      description: "Semantic search across documentation for entities in the Harness IDP — services, APIs, workflows, user groups, environments. Returns ranked documents with content and the corresponding entity_id. Use this for any general 'how do I…' question that internal documentation may answer (debug a failing workflow, install steps, configuration details, monitoring an entity, etc.).",
      toolset: "idp",
      scope: "account",
      identifierFields: [],
      searchAliases: ["techdocs", "tech docs", "documentation", "docs", "knowledge"],
      listFilterFields: [
        { name: "query", description: "The semantic search query (e.g. 'how to troubleshoot a failing workflow?'). Falls back to the standard search_term when omitted." },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/v1/tech-docs/semantic-search",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const query = (input.query as string | undefined) || (input.search_term as string | undefined);
            if (!query) {
              throw new Error(
                "Missing required field 'query' for idp_tech_doc search. " +
                "Pass it via filters: { query: '...' } or use the standard search_term.",
              );
            }
            return { query };
          },
          responseExtractor: passthrough,
          description: "Semantically search IDP TechDocs. Returns documents ranked by relevance, each with content + entity_id. Use to answer any generic question about Harness entities — the documentation may match relevant docs even when the query wording differs.",
        },
      },
    },
  ],
};
