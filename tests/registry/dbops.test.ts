/**
 * Unit tests for DBOPS toolset database_schema CRUD operations.
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
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "+dbops",
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

  it("create: uses POST and sends only the flat DBOPS body without mutating input", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "new_schema" });
    const client = makeClient(mockRequest);

    const body = {
      identifier: "new_schema",
      name: "New Schema",
      migrationType: "Liquibase",
      type: "Repository",
      changelog: { connector: "git_connector", location: "db/changelog.xml" },
    };
    const expectedBody = structuredClone(body);

    await registry.dispatch(client, "database_schema", "create", {
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema");
    expect(call.body).toEqual(expectedBody);
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
    expect(body).toEqual(expectedBody);
  });

  it("update: uses PUT with dbschema_id and sends only the flat DBOPS body without mutating input", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "my_schema" });
    const client = makeClient(mockRequest);

    const body = { name: "Updated Schema", tags: { env: "production" } };
    const expectedBody = structuredClone(body);

    await registry.dispatch(client, "database_schema", "update", {
      dbschema_id: "my_schema",
      project_id: "test-project",
      org_id: "default",
      body,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/dbops/v1/orgs/default/projects/test-project/dbschema/my_schema");
    expect(call.body).toEqual(expectedBody);
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
    expect(body).toEqual(expectedBody);
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
