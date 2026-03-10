import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

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
      identifierFields: ["entity_id"],
      listFilterFields: [
        { name: "kind", description: "Catalog entity kind filter", enum: ["api", "component", "environment", "environmentblueprint", "group", "resource", "user", "workflow"] },
        { name: "search", description: "Search catalog entities by name or keyword" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/idp/catalog",
      operations: {
        list: {
          method: "GET",
          path: "/idp/api/catalog/entities",
          queryParams: {
            kind: "kind",
            search: "search",
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List IDP catalog entities",
        },
        get: {
          method: "GET",
          path: "/idp/api/catalog/entities/{entityId}",
          pathParams: { entity_id: "entityId" },
          responseExtractor: ngExtract,
          description: "Get IDP catalog entity details",
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
          path: "/idp/api/scorecards",
          queryParams: {
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List IDP scorecards",
        },
        get: {
          method: "GET",
          path: "/idp/api/scorecards/{scorecardIdentifier}",
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
          path: "/idp/api/scorecards/checks",
          queryParams: {
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List scorecard checks",
        },
        get: {
          method: "GET",
          path: "/idp/api/scorecards/checks/{checkIdentifier}",
          pathParams: { check_id: "checkIdentifier" },
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
          path: "/idp/api/scorecards/{scorecardIdentifier}/stats",
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
          path: "/idp/api/scorecards/checks/{checkIdentifier}/stats",
          pathParams: { check_id: "checkIdentifier" },
          responseExtractor: ngExtract,
          description: "Get statistics for a specific scorecard check",
        },
      },
    },
    {
      resourceType: "idp_score",
      displayName: "IDP Score",
      description: "Entity score summary from IDP scorecards. Supports list and get.",
      toolset: "idp",
      scope: "account",
      identifierFields: ["entity_id"],
      operations: {
        list: {
          method: "GET",
          path: "/idp/api/scorecards/scores",
          queryParams: {
            page: "page",
            size: "size",
          },
          responseExtractor: pageExtract,
          description: "List entity scores",
        },
        get: {
          method: "GET",
          path: "/idp/api/scorecards/scores/{entityId}",
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
      operations: {
        list: {
          method: "GET",
          path: "/idp/api/workflows",
          responseExtractor: pageExtract,
          description: "List IDP workflows",
        },
      },
      executeActions: {
        execute: {
          method: "POST",
          path: "/idp/api/workflows/{workflowId}/execute",
          pathParams: { workflow_id: "workflowId" },
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
      description: "Search IDP TechDocs documentation. Supports list (search).",
      toolset: "idp",
      scope: "account",
      identifierFields: [],
      listFilterFields: [
        { name: "query", description: "Search query for scorecards" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/idp/api/techdocs/search",
          queryParams: {
            query: "term",
          },
          responseExtractor: ngExtract,
          description: "Search IDP TechDocs",
        },
      },
    },
  ],
};
