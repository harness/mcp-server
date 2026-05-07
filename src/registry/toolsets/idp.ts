import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract, v1ListExtract } from "../extractors.js";

function getString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value !== "" ? value : undefined;
}

function requireString(input: Record<string, unknown>, key: string, resourceType: string): string {
  const value = getString(input, key);
  if (!value) {
    throw new Error(`Missing required field "${key}" for ${resourceType}.`);
  }
  return value;
}

function buildIdpEntityScope(input: Record<string, unknown>): string {
  const orgId = getString(input, "org_id");
  const projectId = getString(input, "project_id");
  if (!orgId) return "account";
  return projectId ? `account.${orgId}.${projectId}` : `account.${orgId}`;
}

function buildIdpEntityPath(input: Record<string, unknown>): string {
  const scope = buildIdpEntityScope(input);
  const kind = getString(input, "kind") ?? "component";
  const entityId = requireString(input, "entity_id", "idp_entity");
  return `/v1/entities/${encodeURIComponent(scope)}/${encodeURIComponent(kind)}/${encodeURIComponent(entityId)}`;
}

function buildIdpEntityBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (typeof body === "string") {
    return { yaml: body };
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body;
  }
  throw new Error("IDP entity body must be a YAML string or a JSON object with a yaml field.");
}

const idpEntityBodySchema = {
  description: "IDP entity definition. Pass a YAML string directly, or a JSON object with yaml and optional git_details.",
  fields: [
    { name: "yaml", type: "yaml" as const, required: true, description: "Entity YAML definition as a string" },
    {
      name: "git_details",
      type: "object" as const,
      required: false,
      description: "Optional Git Experience storage parameters for REMOTE entities",
      fields: [
        { name: "store_type", type: "string" as const, required: false, description: "Entity storage type: INLINE or REMOTE" },
        { name: "connector_ref", type: "string" as const, required: false, description: "Harness connector identifier for Git CRUD operations" },
        { name: "repo_name", type: "string" as const, required: false, description: "Repository name for REMOTE entities" },
        { name: "branch_name", type: "string" as const, required: false, description: "Branch name for REMOTE entities" },
        { name: "file_path", type: "string" as const, required: false, description: "Entity file path in the repository" },
        { name: "commit_message", type: "string" as const, required: false, description: "Commit message for the entity change" },
        { name: "base_branch", type: "string" as const, required: false, description: "Base branch for Git-backed entity changes" },
        { name: "is_harness_code_repo", type: "boolean" as const, required: false, description: "Whether the REMOTE repository is Harness Code" },
      ],
    },
  ],
};

export const idpToolset: ToolsetDefinition = {
  name: "idp",
  displayName: "Internal Developer Portal",
  description: "Harness IDP — service catalog entities, scorecards, checks, and workflows",
  resources: [
    {
      resourceType: "idp_entity",
      displayName: "IDP Entity",
      description: "Internal Developer Portal catalog entity. Supports list, get, create, update, and delete.",
      toolset: "idp",
      scope: "account",
      scopeOptional: true,
      headerBasedScoping: true,
      identifierFields: ["kind", "entity_id"],
      listFilterFields: [
        { name: "kind", description: "Catalog entity kind filter", enum: ["api", "component", "environment", "environmentblueprint", "group", "resource", "user", "workflow"] },
        { name: "search", description: "Search catalog entities by name or keyword" },
        { name: "scopes", description: "Filter entities by scope (e.g. account, account.orgId, account.orgId.projectId)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/idp/catalog",
      operations: {
        list: {
          method: "GET",
          path: "/v1/entities",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            kind: "kind",
            search: "search_term",
            page: "page",
            size: "limit",
            scope_level: "scope_level",
            scopes: "scopes",
            entity_refs: "entity_refs",
            owned_by_me: "owned_by_me",
            favorites: "favorites",
            type: "type",
            owner: "owner",
            lifecycle: "lifecycle",
            tags: "tags",
          },
          defaultQueryParams: { scope_level: "ACCOUNT" },
          responseExtractor: v1ListExtract(),
          description: "List IDP catalog entities",
        },
        get: {
          method: "GET",
          path: "/v1/entities/{scope}/{kind}/{identifier}",
          pathBuilder: buildIdpEntityPath,
          queryParams: {
            branch_name: "branch_name",
            connector_ref: "connector_ref",
            repo_name: "repo_name",
            load_from_fallback_branch: "load_from_fallback_branch",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: ngExtract,
          description: "Get IDP catalog entity details by scope, kind, and identifier",
        },
        create: {
          method: "POST",
          path: "/v1/entities",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          queryParams: {
            convert: "convert",
            dry_run: "dry_run",
          },
          bodyBuilder: buildIdpEntityBody,
          bodySchema: idpEntityBodySchema,
          responseExtractor: ngExtract,
          description: "Create an IDP catalog entity from entity YAML",
        },
        update: {
          method: "PUT",
          path: "/v1/entities/{scope}/{kind}/{identifier}",
          pathBuilder: buildIdpEntityPath,
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: buildIdpEntityBody,
          bodySchema: idpEntityBodySchema,
          responseExtractor: ngExtract,
          description: "Update or upsert an IDP catalog entity from entity YAML",
        },
        delete: {
          method: "DELETE",
          path: "/v1/entities/{scope}/{kind}/{identifier}",
          pathBuilder: buildIdpEntityPath,
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: ngExtract,
          description: "Delete an IDP catalog entity by scope, kind, and identifier",
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
          queryParams: {
            page: "page",
            size: "limit",
          },
          responseExtractor: v1ListExtract("scorecard"),
          description: "List IDP scorecards",
        },
        get: {
          method: "GET",
          path: "/v1/scorecards/{scorecardIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { scorecard_id: "scorecardIdentifier" },
          responseExtractor: ngExtract,
          description: "Get scorecard details",
        },
      },
    },
    {
      resourceType: "scorecard_check",
      displayName: "Scorecard Check",
      description: "Individual check within an IDP scorecard. Supports list and get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["check_id"],
      operations: {
        list: {
          method: "GET",
          path: "/v1/checks",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "limit",
          },
          responseExtractor: v1ListExtract("check"),
          description: "List scorecard checks",
        },
        get: {
          method: "GET",
          path: "/v1/checks/{checkIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { check_id: "checkIdentifier" },
          queryParams: { is_custom: "custom" },
          responseExtractor: ngExtract,
          description: "Get scorecard check details",
        },
      },
    },
    {
      resourceType: "scorecard_stats",
      displayName: "Scorecard Stats",
      description: "Aggregate statistics for an IDP scorecard. Supports get.",
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
          responseExtractor: ngExtract,
          description: "Get aggregate statistics for a scorecard",
        },
      },
    },
    {
      resourceType: "scorecard_check_stats",
      displayName: "Scorecard Check Stats",
      description: "Statistics for a specific scorecard check. Supports get.",
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
          responseExtractor: ngExtract,
          description: "Get statistics for a specific scorecard check. Pass is_custom=true for custom checks.",
        },
      },
    },
    {
      resourceType: "idp_score",
      displayName: "IDP Score",
      description: "Entity score summary from IDP scorecards. Supports list and get. List requires entity_identifier filter.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["entity_id"],
      listFilterFields: [
        { name: "entity_identifier", description: "Entity identifier (required for listing scores)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/v1/scores",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "limit",
            entity_identifier: "entity_identifier",
          },
          responseExtractor: (raw: unknown) => {
            const r = raw as { overall_score?: number; scorecard_scores?: unknown[] };
            const items = r.scorecard_scores ?? [];
            return { overall_score: r.overall_score, items, total: items.length };
          },
          description: "List entity scores. Requires entity_identifier filter (format: namespace/Kind/name, e.g. default/Component/my-service).",
        },
        get: {
          method: "GET",
          path: "/v1/scores/{entityId}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { entity_id: "entityId" },
          responseExtractor: ngExtract,
          description: "Get score summary for an entity",
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
          path: "/v1/scaffolder/tasks",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: ngExtract,
          actionDescription: "Execute an IDP self-service workflow",
          bodySchema: {
            description: "Workflow execution inputs",
            fields: [
              { name: "inputs", type: "object", required: false, description: "Key-value inputs for the workflow" },
            ],
          },
        },
      },
    },
    {
      resourceType: "idp_tech_doc",
      displayName: "IDP Tech Doc",
      description: "Search IDP TechDocs documentation via semantic search. Supports list (search).",
      toolset: "idp",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "query", description: "Search query for TechDocs" },
      ],
      operations: {
        list: {
          method: "POST",
          path: "/v1/tech-docs/semantic-search",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => ({ query: input.query ?? input.search_term ?? "" }),
          responseExtractor: v1ListExtract(),
          description: "Search IDP TechDocs via semantic search",
        },
      },
    },
  ],
};
