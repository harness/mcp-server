import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract, v1ListExtract } from "../extractors.js";

export const idpToolset: ToolsetDefinition = {
  name: "idp",
  displayName: "Internal Developer Portal",
  description: "Harness IDP — service catalog entities, scorecards, checks, and workflows",
  resources: [
    {
      resourceType: "idp_entity",
      displayName: "IDP Entity",
      description: "Internal Developer Portal catalog entity. Supports list and get.",
      toolset: "idp",
      scope: "account",
      // harness_get maps resource_id to the *last* identifierFields entry when len>1
      // (see harness-get.ts: primaryField = identFields[identFields.length - 1]). Earlier
      // entries are context (e.g. kind); entity_id must be last so resource_id is the name.
      identifierFields: ["kind", "entity_id"],
      listFilterFields: [
        { name: "kind", description: "Catalog entity kind filter", enum: ["api", "component", "environment", "environmentblueprint", "group", "resource", "user", "workflow"] },
        { name: "search", description: "Search catalog entities by name or keyword" },
        { name: "namespace", description: "Entity namespace (defaults to 'account' for account scope)" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/idp/catalog",
      operations: {
        list: {
          method: "GET",
          path: "/v1/entities",
          queryParams: {
            kind: "kind",
            search: "search_term",
            page: "page",
            size: "limit",
            scope_level: "scope_level",
          },
          defaultQueryParams: { scope_level: "ACCOUNT" },
          responseExtractor: v1ListExtract(),
          description: "List IDP catalog entities",
        },
        get: {
          method: "GET",
          path: "/v1/entities/{scope}/{kind}/{namespace}/{entityId}",
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
            const kind = (input.kind as string) || "component";
            const namespace = (input.namespace as string) || scope;
            const entityId = input.entity_id as string;
            return `/v1/entities/${encodeURIComponent(scope)}/${encodeURIComponent(kind)}/${encodeURIComponent(namespace)}/${encodeURIComponent(entityId)}`;
          },
          responseExtractor: ngExtract,
          description: "Get IDP catalog entity details by scope, kind, namespace, and name (entity_ref format: kind:namespace/name)",
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
          bodyBuilder: (input) => ({ query: input.query ?? input.search_term ?? "" }),
          responseExtractor: v1ListExtract(),
          description: "Search IDP TechDocs via semantic search",
        },
      },
    },
  ],
};
