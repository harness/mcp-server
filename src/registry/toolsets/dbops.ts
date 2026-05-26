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
        "The DB engine type (MySQL, PostgreSQL, etc.) is NOT stored on the schema — it is on the JDBC " +
        "connector referenced by each instance. Use the 'connector' field from database_instance with the " +
        "connectors toolset to look it up when you need the engine type.",
      toolset: "dbops",
      scope: "project",
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
        "/ng/account/{accountId}/module/dbops/orgs/{orgIdentifier}/projects/{projectIdentifier}/dbops/db-schemas/{dbschema}",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
        "(MySQL, PostgreSQL, etc.) is determined by that connector. " +
        "Use the connectors toolset to look up the connector when you need the exact engine type or JDBC details.",
      toolset: "dbops",
      scope: "project",
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
        "/ng/account/{accountId}/module/dbops/orgs/{orgIdentifier}/projects/{projectIdentifier}/dbops/db-schemas/{dbschema}/instances/{dbinstance}/migrationstate",
      relatedResources: [
        {
          resourceType: "database_schema",
          relationship: "child",
          description: "Instance belongs to exactly one schema",
        },
        {
          resourceType: "database_snapshot_object",
          relationship: "child",
          description: "Snapshot objects (Table, etc.) captured for this instance",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search_term: "search_term",
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description: "Get a single database instance by identifier",
        },
      },
    },

    // ── Database Snapshot Object ───────────────────────────────────────────
    {
      resourceType: "database_snapshot_object",
      displayName: "Database Snapshot Object",
      description:
        "A database object (e.g. Table) captured in the latest snapshot for a schema instance. " +
        "Use harness_list to discover all object names for a given type, then harness_get to retrieve " +
        "the complete JSON metadata (columns, constraints, indexes) for specific named objects. " +
        "Both dbschema_id and dbinstance_id are required.",
      toolset: "dbops",
      scope: "project",
      identifierFields: ["dbschema_id", "dbinstance_id"],
      listFilterFields: [
        {
          name: "dbschema_id",
          description: "Schema identifier — required",
          required: true,
        },
        {
          name: "dbinstance_id",
          description: "Instance identifier — required",
          required: true,
        },
        {
          name: "object_type",
          description: "Type of object to list (e.g. Table) — required for list",
          required: true,
        },
      ],
      diagnosticHint:
        "Both dbschema_id and dbinstance_id are required for all operations. " +
        "For harness_get, pass object_names (array of names from harness_list) in params.",
      relatedResources: [
        {
          resourceType: "database_instance",
          relationship: "parent",
          description: "Instance whose snapshot is being queried",
        },
        {
          resourceType: "database_schema",
          relationship: "parent",
          description: "Schema the instance belongs to",
        },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/dbinstance/{dbinstance}/snapshot-object-names",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
            dbinstance_id: "dbinstance",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            object_type: "objectType",
            page: "page",
            size: "limit",
          },
          responseExtractor: passthrough,
          description:
            "Discover what objects exist in the latest database snapshot for a given instance. " +
            "Returns { data: string[] } — a list of object names of the specified type " +
            "(e.g. table names when object_type='Table'). " +
            "Use this to explore the database structure before fetching full object definitions.",
        },
        get: {
          method: "POST",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/dbinstance/{dbinstance}/snapshot-object-values",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
            dbinstance_id: "dbinstance",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          bodyBuilder: (input) => {
            const names = input.object_names;
            if (!Array.isArray(names) || names.length === 0) {
              throw new Error(
                "object_names is required (non-empty string array) for database_snapshot_object. " +
                  "Pass via params, e.g. params: { dbschema_id: '...', object_names: ['users'], object_type: 'Table' }. " +
                  "Use harness_list(resource_type='database_snapshot_object', filters=...) to discover names first.",
              );
            }
            return {
              objectType: (input.object_type as string) ?? "Table",
              objectNames: names as string[],
            };
          },
          responseExtractor: passthrough,
          description:
            "Retrieves the complete JSON metadata of specified objects from the latest database snapshot. " +
            "For a table, returns full metadata including columns, constraints, indexes, etc. " +
            "Use harness_list(resource_type='database_snapshot_object') first to discover available object names, " +
            "then call this to fetch their definitions. " +
            "Requires object_names (non-empty array) and object_type in params. " +
            "Returns { data: [{ objectName, objectValue }] } where objectValue is the complete JSON definition.",
          bodySchema: {
            description: "Object type and list of names to retrieve full metadata for",
            fields: [
              {
                name: "objectType",
                type: "string",
                required: true,
                description: "Type of object — e.g. 'Table'",
              },
              {
                name: "objectNames",
                type: "array",
                required: true,
                description: "Array of object names to fetch",
                itemType: "string",
              },
            ],
          },
        },
      },
    },

    // ── Default Authoring Instance ──────────────────────────────────────
    {
      resourceType: "database_default_authoring_instance",
      displayName: "Default Authoring Instance",
      description:
        "Returns the best database instance for LLM change authoring given a schema. " +
        "Selection priority: (1) oldest instance with a metadata snapshot, " +
        "(2) oldest instance overall. Returns a minimal response with the instance " +
        "identifier, name, connector (JDBC connector identifier), and whether it has a snapshot. " +
        "The connector field can be used directly with the connectors toolset to resolve the " +
        "DB engine type — no separate instance fetch is needed. " +
        "Use this when a schema has no primaryDbInstanceId configured and you need " +
        "to auto-select an instance for changeset generation.",
      toolset: "dbops",
      scope: "project",
      identifierFields: ["dbschema_id"],
      operations: {
        get: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/default-authoring-instance",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          responseExtractor: passthrough,
          description:
            "Get the best instance for LLM change authoring for a schema. " +
            "Returns { identifier: string, name: string, hasSnapshot: boolean, connector: string }. " +
            "The connector field is the JDBC connector identifier linked to this instance — " +
            "use it directly with harness_get(resource_type='connector') to resolve the DB engine type. " +
            "Prefers the oldest instance that has a metadata snapshot; falls back to " +
            "the oldest instance overall if none have snapshots. " +
            "Returns 404 if no instances exist for the schema.",
        },
      },
    },

    // ── LLM Authoring Pipeline ───────────────────────────────────────────
    // NOTE: This endpoint is marked x-internal in the DBOPS OpenAPI spec.
    // The response 'metadata' map is expected to contain the pipeline identifier
    // needed for Accept & Commit — verify what key it uses (e.g. 'pipelineIdentifier').
    {
      resourceType: "database_llm_authoring_pipeline",
      displayName: "Database LLM Authoring Pipeline",
      description:
        "Returns the resolved pipeline used for LLM changeset authoring for a specific schema + instance. " +
        "Harness resolves this as the product default unless a project-level override is configured in " +
        "project Database DevOps settings — in which case the override is returned instead. " +
        "Used by the changeset skill during Accept & Commit to find which pipeline to execute. " +
        "IMPORTANT: This is an x-internal endpoint.",
      toolset: "dbops",
      scope: "project",
      identifierFields: ["dbschema_id"],
      listFilterFields: [
        {
          name: "dbinstance_id",
          description: "Instance identifier",
          required: true,
        },
      ],
      operations: {
        get: {
          method: "GET",
          path: "/dbops/v1/orgs/{org}/projects/{project}/default-llm-pipeline",
          pathParams: { org_id: "org", project_id: "project" },
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            dbschema_id: "dbSchema",
            dbinstance_id: "dbInstance",
          },
          responseExtractor: passthrough,
          description:
            "Get the resolved LLM authoring pipeline for a schema+instance pair. " +
            "Returns the product default unless overridden in project Database DevOps settings. " +
            "Returns PipelineStatusOutput: {status, response, metadata}. " +
            "The metadata map may contain 'pipelineIdentifier' or similar — inspect the response.",
        },
      },
    },
  ],
};
