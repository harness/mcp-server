import type { ToolsetDefinition, BodyFieldSpec } from "../types.js";
import { passthrough } from "../extractors.js";

// ── Body Schema Fields for Database Schema ────────────────────────────────
// Note: Create and Update have different required fields per OpenAPI spec.
// - Create requires: identifier, name, migrationType, type
// - Update: all fields optional (partial update), migrationType not supported

const databaseSchemaCreateSchema = {
  description:
    "Database schema definition. Use type='Repository' for git-based changelogs (requires changelog object), " +
    "type='Script' for custom script-based migrations (requires changeLogScript object). " +
    "Only include changelog OR changeLogScript based on type — not both.",
  fields: [
    {
      name: "identifier",
      type: "string",
      required: true,
      description:
        "Unique schema identifier (required on create). Must start with letter/underscore, " +
        "may contain letters, numbers, underscores, and $. Max 128 chars. " +
        "Pattern: ^[a-zA-Z_][0-9a-zA-Z_$]{0,127}$",
    },
    {
      name: "name",
      type: "string",
      required: true,
      description: "Schema display name (max 128 chars)",
    },
    {
      name: "migrationType",
      type: "string",
      required: true,
      description: "Migration tool: 'Liquibase' or 'Flyway'",
    },
    {
      name: "type",
      type: "string",
      required: true,
      description:
        "Source type: 'Repository' (git-based changelog) or 'Script' (custom script)",
    },
    {
      name: "tags",
      type: "object",
      required: false,
      description: "Key-value tag map (max 128 keys, each value max 128 chars)",
    },
    {
      name: "changelog",
      type: "object",
      required: false,
      description:
        "Required when type='Repository': git repository details. OMIT this field entirely if type='Script'.",
      fields: [
        { name: "connector", type: "string", required: true, description: "Git connector identifier" },
        { name: "location", type: "string", required: true, description: "Path to changelog file (e.g. 'db/changelog.xml')" },
        { name: "repo", type: "string", required: false, description: "Repository name (if connector doesn't specify)" },
        { name: "archivePath", type: "string", required: false, description: "Archive path for migration files" },
        { name: "toml", type: "string", required: false, description: "Flyway TOML configuration path" },
      ],
    },
    {
      name: "changeLogScript",
      type: "object",
      required: false,
      description:
        "Required when type='Script': custom script configuration. OMIT this field entirely if type='Repository'.",
      fields: [
        { name: "location", type: "string", required: true, description: "Script path" },
        { name: "image", type: "string", required: true, description: "Docker image (e.g. 'liquibase/liquibase:4.25')" },
        { name: "shell", type: "string", required: true, description: "Shell type: 'Bash' or 'Sh'" },
        { name: "command", type: "string", required: true, description: "Shell command to run" },
        { name: "toml", type: "string", required: false, description: "Flyway TOML configuration path" },
      ],
    },
    {
      name: "usePercona",
      type: "boolean",
      required: false,
      description: "Liquibase only: enable Percona toolkit for online schema changes",
    },
    {
      name: "service",
      type: "string",
      required: false,
      description: "Optional Harness service reference",
    },
  ] as BodyFieldSpec[],
};

// Update schema: all fields optional, migrationType not supported per OpenAPI DBSchemaUpdateRequest
const databaseSchemaUpdateSchema = {
  description:
    "Database schema update. Identifier cannot be changed (comes from path). " +
    "All fields are optional — only include fields you want to update. " +
    "Note: migrationType cannot be changed after creation.",
  fields: [
    {
      name: "name",
      type: "string",
      required: false,
      description: "Schema display name (max 128 chars)",
    },
    {
      name: "tags",
      type: "object",
      required: false,
      description: "Key-value tag map (max 128 keys, each value max 128 chars)",
    },
    {
      name: "type",
      type: "string",
      required: false,
      description:
        "Source type: 'Repository' (git-based changelog) or 'Script' (custom script)",
    },
    {
      name: "changelog",
      type: "object",
      required: false,
      description: "For type='Repository': git repository details.",
      fields: [
        { name: "connector", type: "string", required: false, description: "Git connector identifier" },
        { name: "location", type: "string", required: false, description: "Path to changelog file" },
        { name: "repo", type: "string", required: false, description: "Repository name" },
        { name: "archivePath", type: "string", required: false, description: "Archive path for migration files" },
        { name: "toml", type: "string", required: false, description: "Flyway TOML configuration path" },
      ],
    },
    {
      name: "changeLogScript",
      type: "object",
      required: false,
      description: "For type='Script': custom script configuration.",
      fields: [
        { name: "location", type: "string", required: false, description: "Script path" },
        { name: "image", type: "string", required: false, description: "Docker image" },
        { name: "shell", type: "string", required: false, description: "Shell type: 'Bash' or 'Sh'" },
        { name: "command", type: "string", required: false, description: "Shell command to run" },
        { name: "toml", type: "string", required: false, description: "Flyway TOML configuration path" },
      ],
    },
    {
      name: "usePercona",
      type: "boolean",
      required: false,
      description: "Liquibase only: enable Percona toolkit for online schema changes",
    },
    {
      name: "service",
      type: "string",
      required: false,
      description: "Optional Harness service reference",
    },
    {
      name: "primaryDbInstanceId",
      type: "string",
      required: false,
      description:
        "Primary DB instance identifier for LLM authoring and related features",
    },
  ] as BodyFieldSpec[],
};

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
        "Harness DBOPS schema entity — supports full CRUD (list, get, create, update, delete). " +
        "Defines how database migrations are managed (Liquibase or Flyway), " +
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
        create: {
          method: "POST",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema",
          pathParams: { org_id: "org", project_id: "project" },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          // DBOPS API expects flat DBSchemaIn shape at root (no wrapper object)
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new database schema. Requires name, identifier, migrationType (Liquibase/Flyway), " +
            "and type (Repository for git-based or Script for custom). " +
            "For Repository type, provide changelog object with connector and location (OMIT changeLogScript). " +
            "For Script type, provide changeLogScript object with location, image, shell, and command (OMIT changelog).",
          bodySchema: databaseSchemaCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          // DBOPS API expects flat DBSchemaUpdateRequest shape at root (no wrapper object)
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update an existing database schema. All fields are optional — only include what you want to change. " +
            "Identifier cannot be changed (comes from path). Note: migrationType cannot be changed after creation.",
          bodySchema: databaseSchemaUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description:
            "Delete a database schema. WARNING: This will also delete all linked instances and migration history. " +
            "This action cannot be undone.",
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
