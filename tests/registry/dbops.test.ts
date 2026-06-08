/**
 * Unit tests for DBOPS toolset database_schema and database_instance CRUD operations.
 * Verifies path construction, body handling, bodySchema fields, and operation policies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { dbopsToolset } from "../../src/registry/toolsets/dbops.js";
import type { ResourceDefinition, EndpointSpec } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "+dbops",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

/** Helper: find a resource definition by resourceType */
function findResource(type: string): ResourceDefinition {
  const res = dbopsToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in dbopsToolset`);
  return res;
}

/** Helper: get an operation's EndpointSpec */
function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

describe("database_schema CRUD operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: builds correct path and returns array", async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { identifier: "schema1", name: "My Schema", migrationType: "Liquibase" },
    ]);
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "database_schema", "list", {
      project_id: "test-project",
      org_id: "default",
      search_term: "test",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema");
    expect(result).toHaveLength(1);
  });

  it("get: builds correct path with dbschema_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "my_schema" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_schema", "get", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema");
  });

  it("create: uses POST and passes flat body through without scope injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "new_schema" });
    const client = makeClient(mockRequest);

    const body = {
      identifier: "new_schema",
      name: "New Schema",
      migrationType: "Liquibase",
      type: "Repository",
      changelog: { connector: "git_connector", location: "db/changelog.xml" },
    };

    await registry.dispatch(client, "database_schema", "create", {
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema");
    // Use immutable literal to catch mutation bugs — body must stay flat without scope injection
    expect(call.body).toEqual({
      identifier: "new_schema",
      name: "New Schema",
      migrationType: "Liquibase",
      type: "Repository",
      changelog: { connector: "git_connector", location: "db/changelog.xml" },
    });
    // Explicitly verify no scope fields were injected
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("update: uses PUT with dbschema_id in path without scope injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "my_schema" });
    const client = makeClient(mockRequest);

    const body = { name: "Updated Schema", tags: { env: "production" } };

    await registry.dispatch(client, "database_schema", "update", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema");
    // Use immutable literal to catch mutation bugs — body must stay flat without scope injection
    expect(call.body).toEqual({ name: "Updated Schema", tags: { env: "production" } });
    // Explicitly verify no scope fields were injected
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("delete: uses DELETE with dbschema_id in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_schema", "delete", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema");
  });
});

describe("database_schema create bodySchema", () => {
  it("has correct required and optional fields", () => {
    const spec = getOp("database_schema", "create");
    expect(spec.bodySchema).toBeDefined();

    const fields = spec.bodySchema!.fields;
    const fieldMap = Object.fromEntries(fields.map((f) => [f.name, f]));

    // Required fields
    expect(fieldMap.identifier.required).toBe(true);
    expect(fieldMap.name.required).toBe(true);
    expect(fieldMap.migrationType.required).toBe(true);
    expect(fieldMap.type.required).toBe(true);

    // Optional fields
    expect(fieldMap.tags.required).toBe(false);
    expect(fieldMap.changelog.required).toBe(false);
    expect(fieldMap.changeLogScript.required).toBe(false);

    // Identifier pattern from OpenAPI
    expect(fieldMap.identifier.description).toContain("^[a-zA-Z_][0-9a-zA-Z_$]{0,127}$");
  });

  it("changelog has nested fields with required connector and location", () => {
    const spec = getOp("database_schema", "create");
    const changelogField = spec.bodySchema!.fields.find((f) => f.name === "changelog");

    expect(changelogField!.fields).toBeDefined();
    const nestedFields = changelogField!.fields!;
    const fieldMap = Object.fromEntries(nestedFields.map((f) => [f.name, f]));

    expect(fieldMap.connector.required).toBe(true);
    expect(fieldMap.location.required).toBe(true);
    expect(fieldMap.repo.required).toBe(false);
  });

  it("changeLogScript has nested fields with required location, image, shell, command", () => {
    const spec = getOp("database_schema", "create");
    const scriptField = spec.bodySchema!.fields.find((f) => f.name === "changeLogScript");

    expect(scriptField!.fields).toBeDefined();
    const nestedFields = scriptField!.fields!;
    const fieldMap = Object.fromEntries(nestedFields.map((f) => [f.name, f]));

    expect(fieldMap.location.required).toBe(true);
    expect(fieldMap.image.required).toBe(true);
    expect(fieldMap.shell.required).toBe(true);
    expect(fieldMap.command.required).toBe(true);
  });
});

describe("database_schema update bodySchema", () => {
  it("has all fields optional (no identifier, no migrationType)", () => {
    const spec = getOp("database_schema", "update");
    expect(spec.bodySchema).toBeDefined();

    const fields = spec.bodySchema!.fields;
    const fieldNames = fields.map((f) => f.name);

    // identifier and migrationType should NOT be in update schema
    expect(fieldNames).not.toContain("identifier");
    expect(fieldNames).not.toContain("migrationType");

    // All fields should be optional
    for (const field of fields) {
      expect(field.required, `${field.name} should be optional`).toBe(false);
    }

    // primaryDbInstanceId should be present
    expect(fieldNames).toContain("primaryDbInstanceId");
  });

  it("nested changelog/changeLogScript fields are all optional for partial update", () => {
    const spec = getOp("database_schema", "update");
    const changelogField = spec.bodySchema!.fields.find((f) => f.name === "changelog");
    const scriptField = spec.bodySchema!.fields.find((f) => f.name === "changeLogScript");

    for (const field of changelogField!.fields!) {
      expect(field.required, `changelog.${field.name} should be optional`).toBe(false);
    }
    for (const field of scriptField!.fields!) {
      expect(field.required, `changeLogScript.${field.name} should be optional`).toBe(false);
    }
  });
});

describe("database_schema operationPolicy", () => {
  it("create: low_write risk, do_not_retry", () => {
    const spec = getOp("database_schema", "create");
    expect(spec.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "do_not_retry",
    });
  });

  it("update: low_write risk, safe retryPolicy (idempotent PUT)", () => {
    const spec = getOp("database_schema", "update");
    expect(spec.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "safe",
    });
  });

  it("delete: destructive risk, do_not_retry", () => {
    const spec = getOp("database_schema", "delete");
    expect(spec.operationPolicy).toEqual({
      risk: "destructive",
      retryPolicy: "do_not_retry",
    });
  });
});

describe("database_schema resource metadata", () => {
  it("is project-scoped with correct identifierField", () => {
    const res = findResource("database_schema");
    expect(res.scope).toBe("project");
    expect(res.identifierFields).toContain("dbschema_id");
  });

  it("description mentions CRUD operations", () => {
    const res = findResource("database_schema");
    expect(res.description).toContain("CRUD");
  });

  it("delete description warns about cascading deletion", () => {
    const spec = getOp("database_schema", "delete");
    expect(spec.description).toContain("linked instances");
    expect(spec.description).toContain("cannot be undone");
  });
});

describe("database_schema create validation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("rejects Repository type without changelog object", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "database_schema", "create", {
        project_id: "test-project",
        org_id: "default",
        body: {
          identifier: "test_schema",
          name: "Test Schema",
          migrationType: "Liquibase",
          type: "Repository",
          // missing changelog
        },
      })
    ).rejects.toThrow("changelog object is required when type='Repository'");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects Repository type without changelog.connector", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "database_schema", "create", {
        project_id: "test-project",
        org_id: "default",
        body: {
          identifier: "test_schema",
          name: "Test Schema",
          migrationType: "Liquibase",
          type: "Repository",
          changelog: { location: "db/changelog.xml" }, // missing connector
        },
      })
    ).rejects.toThrow("changelog.connector is required when type='Repository'");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects Repository type without changelog.location", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "database_schema", "create", {
        project_id: "test-project",
        org_id: "default",
        body: {
          identifier: "test_schema",
          name: "Test Schema",
          migrationType: "Liquibase",
          type: "Repository",
          changelog: { connector: "git_connector" }, // missing location
        },
      })
    ).rejects.toThrow("changelog.location is required when type='Repository'");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects Script type without changeLogScript object", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "database_schema", "create", {
        project_id: "test-project",
        org_id: "default",
        body: {
          identifier: "test_schema",
          name: "Test Schema",
          migrationType: "Liquibase",
          type: "Script",
          // missing changeLogScript
        },
      })
    ).rejects.toThrow("changeLogScript object is required when type='Script'");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects Script type with missing required changeLogScript fields", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "database_schema", "create", {
        project_id: "test-project",
        org_id: "default",
        body: {
          identifier: "test_schema",
          name: "Test Schema",
          migrationType: "Liquibase",
          type: "Script",
          changeLogScript: { location: "/scripts" }, // missing image, shell, command
        },
      })
    ).rejects.toThrow("changeLogScript.{image, shell, command} required when type='Script'");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("accepts valid Script type with all required fields", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "test_schema" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_schema", "create", {
      project_id: "test-project",
      org_id: "default",
      body: {
        identifier: "test_schema",
        name: "Test Schema",
        migrationType: "Liquibase",
        type: "Script",
        changeLogScript: {
          location: "/scripts",
          image: "liquibase/liquibase:latest",
          shell: "sh",
          command: "liquibase update",
        },
      },
    });

    expect(mockRequest).toHaveBeenCalled();
  });
});

// ─── Database Instance Tests ─────────────────────────────────────────────────

describe("database_instance CRUD operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: uses POST with dbschema_id in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue([
      { identifier: "instance1", name: "Dev Instance" },
    ]);
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "database_instance", "list", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/instancelist");
    expect(call.body).toEqual({});
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
    expect(result).toHaveLength(1);
  });

  it("get: builds path with dbschema_id and dbinstance_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "my_instance" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_instance", "get", {
      dbschema_id: "my_schema",
      dbinstance_id: "my_instance",
      project_id: "test-project",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/instance/my_instance");
  });

  it("create: uses POST and passes flat body through without scope injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "new_instance" });
    const client = makeClient(mockRequest);

    const body = {
      identifier: "new_instance",
      name: "New Instance",
      connector: "jdbc_connector",
      branch: "main",
    };

    await registry.dispatch(client, "database_instance", "create", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/instance");
    // Use immutable literal to catch mutation bugs — body must stay flat without scope injection
    expect(call.body).toEqual({
      identifier: "new_instance",
      name: "New Instance",
      connector: "jdbc_connector",
      branch: "main",
    });
    // Explicitly verify no scope fields were injected
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("update: uses PUT with dbinstance_id in path without scope injection", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "my_instance" });
    const client = makeClient(mockRequest);

    const body = { name: "Updated Instance", tags: { env: "staging" } };

    await registry.dispatch(client, "database_instance", "update", {
      dbschema_id: "my_schema",
      dbinstance_id: "my_instance",
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/instance/my_instance");
    // Use immutable literal to catch mutation bugs
    expect(call.body).toEqual({ name: "Updated Instance", tags: { env: "staging" } });
    // Explicitly verify no scope fields were injected
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("delete: uses DELETE with dbinstance_id in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_instance", "delete", {
      dbschema_id: "my_schema",
      dbinstance_id: "my_instance",
      project_id: "test-project",
      org_id: "default",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/instance/my_instance");
  });
});

describe("database_instance create bodySchema", () => {
  it("has correct required and optional fields per OpenAPI DBInstanceIn", () => {
    const spec = getOp("database_instance", "create");
    expect(spec.bodySchema).toBeDefined();

    const fields = spec.bodySchema!.fields;
    const fieldMap = Object.fromEntries(fields.map((f) => [f.name, f]));

    // Required fields: identifier, name, connector
    expect(fieldMap.identifier.required).toBe(true);
    expect(fieldMap.name.required).toBe(true);
    expect(fieldMap.connector.required).toBe(true);

    // Optional fields
    expect(fieldMap.branch.required).toBe(false);
    expect(fieldMap.context.required).toBe(false);
    expect(fieldMap.tags.required).toBe(false);
    expect(fieldMap.substituteProperties.required).toBe(false);
  });

  it("identifier has pattern description from OpenAPI", () => {
    const spec = getOp("database_instance", "create");
    const idField = spec.bodySchema!.fields.find((f) => f.name === "identifier");

    expect(idField!.description).toContain("^[a-zA-Z_][0-9a-zA-Z_$]{0,127}$");
  });

  it("branch description mentions it is required for GIT/Harness Code schemas", () => {
    const spec = getOp("database_instance", "create");
    const branchField = spec.bodySchema!.fields.find((f) => f.name === "branch");

    expect(branchField!.description).toContain("REQUIRED");
    expect(branchField!.description).toContain("GIT");
    expect(branchField!.description).toContain("Harness Code");
  });
});

describe("database_instance update bodySchema", () => {
  it("has all fields optional (no identifier)", () => {
    const spec = getOp("database_instance", "update");
    expect(spec.bodySchema).toBeDefined();

    const fields = spec.bodySchema!.fields;
    const fieldNames = fields.map((f) => f.name);

    // identifier should NOT be in update schema
    expect(fieldNames).not.toContain("identifier");

    // All fields should be optional
    for (const field of fields) {
      expect(field.required, `${field.name} should be optional`).toBe(false);
    }
  });

  it("contains all expected update fields", () => {
    const spec = getOp("database_instance", "update");
    const fieldNames = spec.bodySchema!.fields.map((f) => f.name);

    expect(fieldNames).toContain("name");
    expect(fieldNames).toContain("connector");
    expect(fieldNames).toContain("branch");
    expect(fieldNames).toContain("context");
    expect(fieldNames).toContain("tags");
    expect(fieldNames).toContain("substituteProperties");
    // NOTE: OpenAPI has 'version' but it's a no-op in the backend — not exposed to agents
  });
});

describe("database_instance operationPolicy", () => {
  it("create: low_write risk, do_not_retry", () => {
    const spec = getOp("database_instance", "create");
    expect(spec.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "do_not_retry",
    });
  });

  it("update: low_write risk, safe retryPolicy (idempotent PUT)", () => {
    const spec = getOp("database_instance", "update");
    expect(spec.operationPolicy).toEqual({
      risk: "low_write",
      retryPolicy: "safe",
    });
  });

  it("delete: destructive risk, do_not_retry", () => {
    const spec = getOp("database_instance", "delete");
    expect(spec.operationPolicy).toEqual({
      risk: "destructive",
      retryPolicy: "do_not_retry",
    });
  });
});

describe("database_instance resource metadata", () => {
  it("is project-scoped with correct identifierFields", () => {
    const res = findResource("database_instance");
    expect(res.scope).toBe("project");
    expect(res.identifierFields).toContain("dbinstance_id");
  });

  it("description mentions CRUD operations", () => {
    const res = findResource("database_instance");
    expect(res.description).toContain("CRUD");
  });

  it("delete description warns about migration history deletion", () => {
    const spec = getOp("database_instance", "delete");
    expect(spec.description).toContain("migration");
    expect(spec.description).toContain("cannot be undone");
  });

  it("has dbschema_id as required listFilterField", () => {
    const res = findResource("database_instance");
    const schemaFilter = res.listFilterFields?.find((f) => f.name === "dbschema_id");
    expect(schemaFilter).toBeDefined();
    expect(schemaFilter!.required).toBe(true);
  });
});

describe("database_instance skipScopeBodyInjection", () => {
  it("create has skipScopeBodyInjection enabled", () => {
    const spec = getOp("database_instance", "create");
    expect(spec.skipScopeBodyInjection).toBe(true);
  });

  it("update has skipScopeBodyInjection enabled", () => {
    const spec = getOp("database_instance", "update");
    expect(spec.skipScopeBodyInjection).toBe(true);
  });
});

describe("database_execute_llm_authoring_pipeline create", () => {
  it("maps body aliases to the new /v1/llm-authoring/execute-pipeline payload (default-pipeline branch)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      executionId: "exec-1",
      pipelineIdentifier: "dbops_default_pipeline",
      openInHarness: "https://app.harness.io/...",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_execute_llm_authoring_pipeline", "create", {
      org_id: "default",
      project_id: "test-project",
      body: {
        schema_id: "schema_1",
        instance_id: "instance_1",
        conversation_id: "conversation-1",
        changeset: "databaseChangeLog: []",
        k8s_connector_ref: "account.k8s_connector",
        use_default_pipeline: true,
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(
      "/v1/orgs/default/projects/test-project/llm-authoring/execute-pipeline",
    );
    expect(call.body).toEqual({
      conversationId: "conversation-1",
      schemaId: "schema_1",
      instanceId: "instance_1",
      changeset: "databaseChangeLog: []",
      k8sConnectorRef: "account.k8s_connector",
      useDefaultPipeline: true,
    });
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
    expect(call.body).not.toHaveProperty("pipelineIdentifier");
  });

  it("forwards the custom-pipeline branch with runtime_inputs", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      executionId: "exec-2",
      pipelineIdentifier: "my-pipe",
      openInHarness: "https://app.harness.io/...",
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_execute_llm_authoring_pipeline", "create", {
      org_id: "default",
      project_id: "test-project",
      body: {
        schema_id: "schema_1",
        instance_id: "instance_1",
        conversation_id: "conversation-1",
        changeset: "databaseChangeLog: []",
        k8s_connector_ref: "account.k8s_connector",
        pipeline_identifier: "my-pipe",
        runtime_inputs: { releaseCodename: "phoenix" },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(
      "/v1/orgs/default/projects/test-project/llm-authoring/execute-pipeline",
    );
    expect(call.body).toEqual({
      conversationId: "conversation-1",
      schemaId: "schema_1",
      instanceId: "instance_1",
      changeset: "databaseChangeLog: []",
      k8sConnectorRef: "account.k8s_connector",
      pipelineIdentifier: "my-pipe",
      runtimeInputs: { releaseCodename: "phoenix" },
    });
    expect(call.body).not.toHaveProperty("useDefaultPipeline");
  });
});

describe("database_snapshot_object get", () => {
  it("passes object lookup body without scope injection", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ objectName: "users", objectValue: { columns: [] } }],
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "database_snapshot_object", "get", {
      org_id: "default",
      project_id: "test-project",
      dbschema_id: "my_schema",
      dbinstance_id: "my_instance",
      object_type: "Table",
      object_names: ["users"],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(
      "/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema/dbinstance/my_instance/snapshot-object-values",
    );
    expect(call.body).toEqual({
      objectType: "Table",
      objectNames: ["users"],
    });
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });
});
