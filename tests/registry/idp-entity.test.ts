/**
 * Unit tests for idp_entity create/update operations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

const SAMPLE_YAML = `apiVersion: harness.io/v1
kind: component
type: service
metadata:
  name: boutique-service
  namespace: default
spec:
  owner: group:default/platform-team`;

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

function findResource(type: string): ResourceDefinition {
  const res = idpToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in idpToolset`);
  return res;
}

function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

describe("idp_entity mutate operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("exposes create and update but not delete", () => {
    const def = findResource("idp_entity");
    expect(def.operations.create).toBeDefined();
    expect(def.operations.update).toBeDefined();
    expect(def.operations.delete).toBeUndefined();
    expect(def.supportedScopes).toEqual(["account", "org", "project"]);
  });

  it("create: POST /v1/entities with yaml body and scope query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "boutique-service", kind: "component" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "create", {
      org_id: "my_org",
      project_id: "my_project",
      body: { yaml: SAMPLE_YAML },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v1/entities");
    expect(call.params.orgIdentifier).toBe("my_org");
    expect(call.params.projectIdentifier).toBe("my_project");
    expect(call.body).toEqual({ yaml: SAMPLE_YAML });
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });

  it("create: accepts raw YAML string body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "create", {
      body: SAMPLE_YAML,
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ yaml: SAMPLE_YAML });
  });

  it("create: forwards optional query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "create", {
      body: { yaml: SAMPLE_YAML },
      convert: true,
      dry_run: true,
      operation_mode: "UPSERT",
    });

    const call = mockRequest.mock.calls[0][0] as { params: Record<string, unknown> };
    expect(call.params.convert).toBe(true);
    expect(call.params.dry_run).toBe(true);
    expect(call.params.operationMode).toBe("UPSERT");
  });

  it("create: includes git_details when provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const gitDetails = {
      branch_name: "main",
      file_path: ".harness/idp.yaml",
      connector_ref: "github_conn",
      repo_name: "catalog-repo",
      store_type: "REMOTE",
    };

    await registry.dispatch(client, "idp_entity", "create", {
      body: { yaml: SAMPLE_YAML, git_details: gitDetails },
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body.git_details).toEqual(gitDetails);
  });

  it("create: fails when yaml is missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "idp_entity", "create", { body: {} }),
    ).rejects.toThrow(/yaml is required/);
  });

  it("update: PUT scoped path with kind and entity_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "boutique-service" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "idp_entity", "update", {
      org_id: "my_org",
      project_id: "my_project",
      kind: "component",
      entity_id: "boutique-service",
      body: { yaml: SAMPLE_YAML },
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/v1/entities/account.my_org.my_project/component/boutique-service");
    expect(call.params.orgIdentifier).toBe("my_org");
    expect(call.params.projectIdentifier).toBe("my_project");
    expect(call.body).toEqual({ yaml: SAMPLE_YAML });
  });

  it("update: rejects entity kind conflicts between path and YAML", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "idp_entity", "update", {
        kind: "api",
        entity_id: "boutique-service",
        body: { yaml: SAMPLE_YAML },
      }),
    ).rejects.toThrow(/Conflicting kind/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("update: rejects entity identifier conflicts between path and YAML", async () => {
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);
    const mismatchedYaml = SAMPLE_YAML.replace("name: boutique-service", "name: checkout-service");

    await expect(
      registry.dispatch(client, "idp_entity", "update", {
        kind: "component",
        entity_id: "boutique-service",
        body: { yaml: mismatchedYaml },
      }),
    ).rejects.toThrow(/Conflicting metadata\.name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("update: requires kind and entity_id", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "idp_entity", "update", {
        entity_id: "boutique-service",
        body: { yaml: SAMPLE_YAML },
      }),
    ).rejects.toThrow(/Missing required field "kind"/);

    await expect(
      registry.dispatch(client, "idp_entity", "update", {
        kind: "component",
        body: { yaml: SAMPLE_YAML },
      }),
    ).rejects.toThrow(/Missing required field "entity_id"/);
  });

  it("bodyBuilder helpers match registry specs", () => {
    const createSpec = getOp("idp_entity", "create");
    const updateSpec = getOp("idp_entity", "update");

    expect(createSpec.skipScopeBodyInjection).toBe(true);
    expect(updateSpec.skipScopeBodyInjection).toBe(true);
    expect(createSpec.bodySchema?.fields.map((f) => f.name)).toEqual(["yaml", "git_details"]);
    expect(createSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "do_not_retry" });
    expect(updateSpec.operationPolicy).toEqual({ risk: "low_write", retryPolicy: "safe" });
  });
});
