import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const dbopsToolset: ToolsetDefinition = {
  name: "dbops",
  displayName: "Database DevOps",
  description:
    "Harness Database DevOps — database schema management, Liquibase/Flyway migrations, and instance lifecycle",
  resources: [
    // ── Database Schema ──────────────────────────────────────────────────
    {
      resourceType: "database_schema",
      displayName: "Database Schema",
      description:
        "Harness DBOPS schema entity. Defines how database migrations are managed (Liquibase or Flyway), " +
        "the source of migration scripts, and the set of linked instances. " +
        "NOTE: 'type' field is the schema source type (Repository/Script), NOT the database engine. " +
        "The DB engine (MySQL, PostgreSQL, etc.) is stored in the connector linked to each instance.",
      toolset: "dbops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["dbschema_id"],
      listFilterFields: [
        { name: "search_term", description: "Search schemas by name" },
        {
          name: "migration_type",
          description: "Filter by migration type",
          enum: ["Liquibase", "Flyway"],
        },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/all/orgs/{org}/projects/{project}/dbdevops/schema/{dbschema}",
      relatedResources: [
        {
          resourceType: "database_instance",
          relationship: "parent",
          description:
            "Each schema has one or more instances linked to DB connectors",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            search_term: "searchTerm",
            migration_type: "migrationType",
            page: "page",
            size: "limit",
          },
          responseExtractor: passthrough,
          description:
            "List all database schemas in the project. Returns a plain array of DBSchemaOut objects.",
        },
        get: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          responseExtractor: passthrough,
          description: "Get a single database schema by identifier",
        },
      },
    },

    // ── Database Instance ────────────────────────────────────────────────
    {
      resourceType: "database_instance",
      displayName: "Database Instance",
      description:
        "A database instance linked to a schema. Connects the schema's migration scripts " +
        "to a specific database via a Harness connector. " +
        "The 'connector' field holds the connector identifier — the DB engine type " +
        "(MySQL, PostgreSQL, etc.) is determined by that connector.",
      toolset: "dbops",
      scope: "project",
      scopeOptional: true,
      identifierFields: ["dbinstance_id"],
      listFilterFields: [
        {
          name: "dbschema_id",
          description: "Schema identifier — required to list instances",
          required: true,
        },
        { name: "search_term", description: "Search instances by name" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/all/orgs/{org}/projects/{project}/dbdevops/schema/{dbschema}/instance/{dbinstance}",
      relatedResources: [
        {
          resourceType: "database_schema",
          relationship: "child",
          description: "Instance belongs to exactly one schema",
        },
      ],
      diagnosticHint:
        "If listing fails with 400 or 404, verify the schema identifier (dbschema_id) is correct " +
        "by first calling harness_list(resource_type='database_schema').",
      operations: {
        list: {
          method: "POST",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/instancelist",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          queryParams: {
            search_term: "searchTerm",
            page: "page",
            size: "limit",
          },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          description:
            "List instances for a schema (POST with empty body). Requires dbschema_id in filters. " +
            "Returns a plain array of DBInstanceOut objects.",
        },
        get: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/instance/{dbinstance}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
            dbinstance_id: "dbinstance",
          },
          responseExtractor: passthrough,
          description: "Get a single database instance by identifier",
        },
      },
    },

    // ── Default LLM Pipeline ─────────────────────────────────────────────
    // NOTE: This endpoint is marked x-internal in the DBOPS OpenAPI spec.
    // Confirm with the DBOPS team that it is safe to call via the agent.
    // The response 'metadata' map is expected to contain the pipeline identifier
    // needed for Accept & Commit — verify what key it uses (e.g. 'pipelineIdentifier').
    {
      resourceType: "database_llm_pipeline",
      displayName: "Database LLM Pipeline",
      description:
        "Get the default Harness pipeline configured for LLM changeset authoring " +
        "for a specific schema + instance combination. Used by the changeset skill " +
        "during Accept & Commit to find which pipeline to execute. " +
        "IMPORTANT: This is an x-internal endpoint — confirm with the DBOPS team " +
        "that it is accessible via the agent.",
      toolset: "dbops",
      scope: "project",
      scopeOptional: true,
      identifierFields: [],
      listFilterFields: [
        {
          name: "dbschema_id",
          description: "Schema identifier",
          required: true,
        },
        {
          name: "dbinstance_id",
          description: "Instance identifier",
          required: true,
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/default-llm-pipeline",
          pathParams: { org_id: "org", project_id: "project" },
          queryParams: {
            dbschema_id: "dbSchema",
            dbinstance_id: "dbInstance",
          },
          responseExtractor: passthrough,
          description:
            "Get default LLM pipeline for a schema+instance pair. " +
            "Returns PipelineStatusOutput: {status, response, metadata}. " +
            "The metadata map may contain 'pipelineIdentifier' or similar — inspect the response.",
        },
      },
    },
  ],
};
