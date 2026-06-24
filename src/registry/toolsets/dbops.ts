import type { ToolsetDefinition, BodyFieldSpec, ParamsSchema } from "../types.js";
import { passthrough } from "../extractors.js";

// ── Validation helpers for conditional nested fields ──────────────────────

/**
 * Validates database_schema create body for conditionally required nested fields.
 * - type='Repository' requires changelog with connector and location
 * - type='Script' requires changeLogScript with location, image, shell, and command
 */
function validateDatabaseSchemaCreate(body: Record<string, unknown>): void {
  const schemaType = body.type as string | undefined;

  if (schemaType === "Repository") {
    const changelog = body.changelog as Record<string, unknown> | undefined;
    if (!changelog) {
      throw new Error("changelog object is required when type='Repository'");
    }
    if (!changelog.connector) {
      throw new Error("changelog.connector is required when type='Repository'");
    }
    if (!changelog.location) {
      throw new Error("changelog.location is required when type='Repository'");
    }
  } else if (schemaType === "Script") {
    const script = body.changeLogScript as Record<string, unknown> | undefined;
    if (!script) {
      throw new Error("changeLogScript object is required when type='Script'");
    }
    const missing: string[] = [];
    if (!script.location) missing.push("location");
    if (!script.image) missing.push("image");
    if (!script.shell) missing.push("shell");
    if (!script.command) missing.push("command");
    if (missing.length > 0) {
      throw new Error(`changeLogScript.{${missing.join(", ")}} required when type='Script'`);
    }
  }
}

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

// ── Body Schema Fields for Database Instance ────────────────────────────────
// Note: OpenAPI DBInstanceIn marks only identifier and connector in `required`, but server-side
// validation enforces name as well. We mark all three as required here for safer agent behavior.
// Update has all fields optional.

const databaseInstanceCreateSchema = {
  description:
    "Database instance definition. Links a schema's migration scripts to a specific database via a JDBC connector. " +
    "The connector determines the database engine type and connection details.",
  fields: [
    {
      name: "identifier",
      type: "string",
      required: true,
      description:
        "Unique instance identifier. Must start with letter/underscore, " +
        "may contain letters, numbers, underscores, and $. Max 128 chars. " +
        "Pattern: ^[a-zA-Z_][0-9a-zA-Z_$]{0,127}$",
    },
    {
      name: "name",
      type: "string",
      required: true,
      description: "Instance display name (max 128 chars).",
    },
    {
      name: "connector",
      type: "string",
      required: true,
      description:
        "JDBC connector identifier (required). The connector defines the database engine type (MySQL, PostgreSQL, etc.) " +
        "and connection details including the target database. " +
        "Use harness_list(resource_type='connector', filters={type: 'Jdbc'}) to find available JDBC connectors.",
    },
    {
      name: "branch",
      type: "string",
      required: false,
      description:
        "Git branch for this instance. **REQUIRED when parent schema uses GIT or Harness Code source**. " +
        "Specifies which branch to pull migration scripts from. Not needed for Script-based schemas. " +
        "Check the parent schema's source type via harness_get before creating the instance.",
    },
    {
      name: "context",
      type: "string",
      required: false,
      description:
        "Liquibase/Flyway context filter. Allows you to filter which changesets run for this instance. " +
        "For example, 'dev', 'staging', 'release' — only changesets tagged with matching contexts will execute. " +
        "Leave empty to run all changesets.",
    },
    {
      name: "tags",
      type: "object",
      required: false,
      description:
        "Optional key-value pairs for tagging/labeling the instance. Format: { \"key1\": \"value1\", \"key2\": \"value2\" }",
    },
    {
      name: "substituteProperties",
      type: "object",
      required: false,
      description:
        "Optional key-value pairs for Liquibase property substitution. These values replace ${property} placeholders in changesets. " +
        "Format: { \"schemaName\": \"myschema\", \"tablespace\": \"users_ts\" }",
    },
  ] as BodyFieldSpec[],
};

// Update schema: all fields optional for partial updates
const databaseInstanceUpdateSchema = {
  description:
    "Database instance update. Identifier cannot be changed (comes from path). " +
    "All fields are optional — only include fields you want to update.",
  fields: [
    {
      name: "name",
      type: "string",
      required: false,
      description: "Instance display name",
    },
    {
      name: "connector",
      type: "string",
      required: false,
      description: "JDBC connector identifier",
    },
    {
      name: "branch",
      type: "string",
      required: false,
      description: "Git branch for Repository-type schemas",
    },
    {
      name: "context",
      type: "string",
      required: false,
      description: "Liquibase/Flyway context filter",
    },
    {
      name: "tags",
      type: "object",
      required: false,
      description: "Key-value pairs for tagging/labeling",
    },
    {
      name: "substituteProperties",
      type: "object",
      required: false,
      description: "Liquibase property substitution values",
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
          // Validates conditionally required nested fields based on type
          bodyBuilder: (input) => {
            const body = input.body as Record<string, unknown>;
            validateDatabaseSchemaCreate(body);
            return body;
          },
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
        "A database instance linked to a schema — supports full CRUD (list, get, create, update, delete). " +
        "Connects the schema's migration scripts to a specific database via a Harness JDBC connector. " +
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
        "by first calling harness_list(resource_type='database_schema'). " +
        "All instance operations require dbschema_id to identify the parent schema. " +
        "For create: if the API returns 400 about 'branch', the parent schema uses GIT/Harness Code source — " +
        "call harness_get on the schema to check its source type, then retry with branch specified.",
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
          skipScopeBodyInjection: true,
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
        create: {
          method: "POST",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/instance",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
          },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          // DBOPS API expects flat DBInstanceIn shape at root (no wrapper object)
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new database instance under a schema. Links the schema's migration scripts to a specific database. " +
            "Required: identifier, name, connector (JDBC connector ID). " +
            "For Git-based schemas (GIT or Harness Code source), branch is REQUIRED. " +
            "Optional: context (Liquibase context filter), tags, substituteProperties. " +
            "TIP: Call harness_get on the parent schema first to check its source type and determine if branch is needed. " +
            "The dbschema_id must be provided in params to specify the parent schema.",
          bodySchema: databaseInstanceCreateSchema,
        },
        update: {
          method: "PUT",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/instance/{dbinstance}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
            dbinstance_id: "dbinstance",
          },
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          // DBOPS API expects flat DBInstanceUpdateRequest shape at root (no wrapper object)
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update an existing database instance. All fields are optional — only include what you want to change. " +
            "Identifier cannot be changed (comes from dbinstance_id in path).",
          bodySchema: databaseInstanceUpdateSchema,
        },
        delete: {
          method: "DELETE",
          path: "/dbops/v1/orgs/{org}/projects/{project}/dbschema/{dbschema}/instance/{dbinstance}",
          pathParams: {
            org_id: "org",
            project_id: "project",
            dbschema_id: "dbschema",
            dbinstance_id: "dbinstance",
          },
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          responseExtractor: passthrough,
          description:
            "Delete a database instance. WARNING: This removes the instance and its migration execution history. " +
            "The underlying database is NOT affected — only Harness's record of applied migrations. " +
            "This action cannot be undone.",
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
          skipScopeBodyInjection: true,
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
          paramsSchema: {
            fields: [
              { name: "dbinstance_id", required: true, description: "Instance identifier" },
            ],
          } satisfies ParamsSchema,
        },
      },
    },

    // ── Execute LLM Authoring Pipeline (consolidated endpoint) ────────────
    {
      resourceType: "database_execute_llm_authoring_pipeline",
      displayName: "Execute LLM Authoring Pipeline",
      description:
        "Consolidated endpoint for the LLM change authoring Accept & Commit flow. " +
        "Executes the validate-and-preview pipeline and records a billable " +
        "ChangeAuthoringExecutionEvent atomically. Use harness_execute with action=run. " +
        "Requires project scope: org_id and project_id must be supplied (or defaulted via " +
        "HARNESS_ORG / HARNESS_PROJECT env vars). " +
        "Both branches require the same common inputs: conversation_id, schema_id, instance_id, changeset. " +
        "Two branches (exactly one must be set): " +
        "(a) custom-pipeline — pass pipeline_identifier (resolved by the skill from the " +
        "project-level NG setting `dbops_llm_authoring_pipeline_id`) plus optional runtime_inputs; " +
        "(b) default-pipeline — pass use_default_pipeline=true and the server performs " +
        "get-or-create of the canonical default pipeline. " +
        "Reserved runtime-input keys (schemaId, instanceId, changeset) are rejected by the server. " +
        "Returns { executionId, pipelineIdentifier, openInHarness }. " +
        "Show the user the openInHarness link; the changeauthoring billing job reconciles " +
        "execution status server-side.",
      toolset: "dbops",
      scope: "project",
      identifierFields: [],
      operations: {},
      executeActions: {
        run: {
          method: "POST",
          // /v1/ prefix is intentional — this endpoint is on the new db-devops-service
          // routing, not the legacy /dbops/v1/ prefix used by older resources in this toolset.
          path: "/v1/orgs/{org}/projects/{project}/llm-authoring/execute-pipeline",
          pathParams: { org_id: "org", project_id: "project" },
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          skipScopeBodyInjection: true,
          bodyBuilder: (input: Record<string, unknown>) => {
            const src = ((input.body ?? input) as Record<string, unknown>) ?? {};
            // Required fields: accept either snake_case or camelCase from the caller.
            const body: Record<string, unknown> = {
              conversationId: src.conversationId ?? src.conversation_id,
              schemaId: src.schemaId ?? src.schema_id,
              instanceId: src.instanceId ?? src.instance_id,
              changeset: src.changeset,
            };
            // Branch fields: exactly one of useDefaultPipeline or pipelineIdentifier must be set.
            const useDefault = (src.useDefaultPipeline ?? src.use_default_pipeline) as
              | boolean
              | undefined;
            const pipelineId = (src.pipelineIdentifier ?? src.pipeline_identifier) as
              | string
              | undefined;
            const runtimeInputs = (src.runtimeInputs ?? src.runtime_inputs) as
              | Record<string, unknown>
              | undefined;
            if (useDefault === true && pipelineId) {
              throw new Error(
                "Exactly one of use_default_pipeline or pipeline_identifier must be set, not both.",
              );
            }
            if (useDefault === true) {
              body.useDefaultPipeline = true;
            } else if (pipelineId) {
              body.pipelineIdentifier = pipelineId;
              if (runtimeInputs && Object.keys(runtimeInputs).length > 0) {
                body.runtimeInputs = runtimeInputs;
              }
            }
            return body;
          },
          responseExtractor: passthrough,
          actionDescription:
            "Trigger the consolidated LLM-authoring validate-and-preview pipeline. " +
            "The user has already consented via the changeset review card (Accept & Commit) " +
            "before the skill calls this — no second approval is needed. " +
            "Server triggers execution and records the billable event atomically.",
          bodySchema: {
            description:
              "ExecuteLlmAuthoringPipelineRequestBody. Caller may pass any field as " +
              "snake_case (conversation_id, schema_id, instance_id, " +
              "pipeline_identifier, runtime_inputs, use_default_pipeline) or camelCase — " +
              "the bodyBuilder normalizes both to the camelCase keys expected by the API.",
            fields: [
              {
                name: "conversationId",
                type: "string",
                required: true,
                description:
                  "Idempotency key — chat conversation id (alias: conversation_id).",
              },
              {
                name: "schemaId",
                type: "string",
                required: true,
                description: "DBOps schema identifier (alias: schema_id).",
              },
              {
                name: "instanceId",
                type: "string",
                required: true,
                description: "DBOps instance identifier (alias: instance_id).",
              },
              {
                name: "changeset",
                type: "string",
                required: true,
                description:
                  "Liquibase YAML changeset body as PLAIN TEXT. Do NOT base64-encode — " +
                  "the dbservice encodes it server-side before injecting into the pipeline YAML " +
                  "(the DBTestAndPreview step expects base64). Sending base64 here would double-encode.",
              },
              {
                name: "pipelineIdentifier",
                type: "string",
                required: false,
                description:
                  "Custom-pipeline branch — value of NG setting `dbops_llm_authoring_pipeline_id` " +
                  "(alias: pipeline_identifier). Mutually exclusive with useDefaultPipeline.",
              },
              {
                name: "runtimeInputs",
                type: "object",
                required: false,
                description:
                  "Custom runtime inputs collected via AskUserQuestion (alias: runtime_inputs). " +
                  "Reserved keys (schemaId, instanceId, changeset) are rejected by the server.",
              },
              {
                name: "useDefaultPipeline",
                type: "boolean",
                required: false,
                description:
                  "Default-pipeline branch — server performs get-or-create of dbops_default_pipeline " +
                  "(alias: use_default_pipeline). Mutually exclusive with pipelineIdentifier.",
              },
            ],
          },
        },
      },
    },
  ],
};
