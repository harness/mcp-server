import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import { featureFlagsToolset } from "../../src/registry/toolsets/feature-flags.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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
    HARNESS_TOOLSETS: "feature-flags",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_API_KEY: undefined,
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

function makeClient(requestFn?: (options: RequestOptions) => Promise<unknown>): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(resourceType: string): ResourceDefinition {
  const resource = featureFlagsToolset.resources.find((r) => r.resourceType === resourceType);
  if (!resource) throw new Error(`Resource type "${resourceType}" not found`);
  return resource;
}

function getOperation(resourceType: string, operation: string): EndpointSpec {
  const resource = findResource(resourceType);
  const spec = resource.operations[operation as keyof typeof resource.operations];
  if (!spec) throw new Error(`Operation "${operation}" not found on "${resourceType}"`);
  return spec;
}

function firstRequest(mockRequest: ReturnType<typeof vi.fn>): RequestOptions {
  return mockRequest.mock.calls[0][0] as RequestOptions;
}

describe("FME registry metadata", () => {
  it("documents fme_workspace as list-only", () => {
    const resource = findResource("fme_workspace");

    expect(resource.description).toContain("Supports list with pagination");
    expect(resource.description).not.toContain("get by workspace_id");
    expect(resource.operations.list).toBeDefined();
    expect(resource.operations.get).toBeUndefined();
  });

  it("points feature flag create callers at fme_traffic_type for traffic_type_id discovery", () => {
    const createSpec = getOperation("fme_feature_flag", "create");

    expect(createSpec.description).toContain("traffic_type_id (get from fme_traffic_type)");
    expect(createSpec.description).not.toContain("traffic_type_id (get from fme_workspace)");
  });

  it("documents fme_traffic_type list workspace_id as a deprecated (non-required) filter", () => {
    const resource = findResource("fme_traffic_type");

    expect(resource.listFilterFields).toContainEqual({
      name: "workspace_id",
      description: "FME workspace ID (get from fme_workspace). Deprecated — omit and pass org_id+project_id instead for Harness-native scoping.",
    });
  });

  it("documents every required FME list path parameter as a list filter", () => {
    const missing: string[] = [];

    for (const resource of featureFlagsToolset.resources.filter((candidate) => candidate.resourceType.startsWith("fme_"))) {
      const listPathParamKeys = Object.keys(resource.operations.list?.pathParams ?? {});
      if (listPathParamKeys.length === 0) continue;

      const listFilterNames = new Set((resource.listFilterFields ?? []).map((field) => field.name));
      for (const paramKey of listPathParamKeys) {
        if (!listFilterNames.has(paramKey)) {
          missing.push(`${resource.resourceType}.${paramKey}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("documents segment key updates as add-only", () => {
    const resource = findResource("fme_segment_keys");

    expect(resource.description).toContain("update to add members");
    expect(resource.description).toContain("Removal is not supported by this endpoint");
    expect(resource.description).not.toContain("add/remove");
  });

  it("marks raw-array write canonical bodies as required in structured schema", () => {
    const identityItemsField = getOperation("fme_identity", "create").bodySchema?.fields.find((field) => field.name === "items");
    const segmentAddField = getOperation("fme_segment_keys", "update").bodySchema?.fields.find((field) => field.name === "add");

    expect(identityItemsField?.required).toBe(true);
    expect(segmentAddField?.required).toBe(true);
  });
});

describe("FME request routing", () => {
  it("marks FME requests for product-specific client auth and base URL handling", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_workspace", "list", {});

    const call = firstRequest(mockRequest);
    expect(call.product).toBe("fme");
    expect(call.baseUrl).toBe("https://api.split.io");
    expect(call.headers).toBeUndefined();
  });

  it("passes static FME headers through to the client without adding auth", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_API_KEY: "pat.internal.internal.dummy",
      HARNESS_FME_API_KEY: undefined,
    }));
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_workspace", "list", {});

    const call = firstRequest(mockRequest);
    expect(call.product).toBe("fme");
    expect(call.baseUrl).toBe("https://api.split.io");
    expect(call.headers).toBeUndefined();
  });
});

describe("FME execute action response projection", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each([
    { action: "kill", response: true },
    { action: "restore", response: false },
    { action: "archive", response: true },
  ])("wraps primitive $action API responses in { success, result }", async ({ action, response }) => {
    const mockRequest = vi.fn().mockResolvedValue(response);
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "fme_feature_flag", action, {
      workspace_id: "ws-1",
      feature_flag_name: "my-flag",
      environment_id: "env-prod",
    });

    expect(result).toMatchObject({ success: true, result: response });
  });

  it("passes through object responses unchanged", async () => {
    const apiResponse = { id: "flag-1", status: "killed" };
    const mockRequest = vi.fn().mockResolvedValue(apiResponse);
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "fme_feature_flag", "kill", {
      workspace_id: "ws-1",
      feature_flag_name: "my-flag",
      environment_id: "env-prod",
    });

    expect(result).toEqual(apiResponse);
  });
});

describe("fme_feature_flag dual-mode routing", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode: workspace_id routes to Split.io unchanged", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag", "list", { workspace_id: "ws1" });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1");
    expect(req.product).toBe("fme");
    expect(req.params?.orgIdentifier).toBeUndefined();
  });

  it("new mode: org_id+project_id routes to the Harness-native feature-flags path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag", "list", { org_id: "o1", project_id: "p1" });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/feature-flags");
    expect(req.product).toBeUndefined();
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(req.params?.orgIdentifier).toBeUndefined();
    expect(req.params?.projectIdentifier).toBeUndefined();
  });

  it("new mode: get routes to the Harness-native path with the flag name in the URL", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag", "get", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/feature-flags/my_flag");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("new mode: delete routes to the Harness-native path with the flag name in the URL", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag", "delete", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/feature-flags/my_flag");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("new mode: create routes to the Harness-native feature-flags path with the confirmed v4 body shape", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag", "create", {
      org_id: "o1",
      project_id: "p1",
      body: {
        name: "x",
        trafficType: "user",
        description: "desc",
        tags: ["a", { name: "b" }],
        owners: [{ type: "USER", id: "u1" }],
      },
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/feature-flags");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(req.body).toEqual({
      name: "x",
      trafficType: "user",
      description: "desc",
      tags: [{ name: "a" }, { name: "b" }],
      owners: [{ type: "USER", id: "u1" }],
    });
  });

  it("new mode: create requires trafficType in the body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x" },
      }),
    ).rejects.toThrow(/trafficType.*required/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("mixed params throws the shared error", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag", "list", { workspace_id: "ws1", org_id: "o1" }),
    ).rejects.toThrow("fme_feature_flag: pass either workspace_id (deprecated) OR org_id+project_id, not both.");
  });
});

describe("fme_feature_flag kill/restore/reallocate/archive/unarchive dual-mode", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode: kill uses PUT against the Split.io path and forwards comment/title", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "kill", {
      workspace_id: "ws1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body: { comment: "rolling back", title: "Incident 123" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("PUT");
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1/my_flag/environments/e1/kill");
    expect(req.body).toEqual({ comment: "rolling back", title: "Incident 123" });
  });

  it("new mode: kill routes to the Harness-native feature-flag-definitions path via POST", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "kill", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body: { comment: "rolling back" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag/kill");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
    expect(req.body).toEqual({ comment: "rolling back" });
  });

  it("new mode: restore routes to the Harness-native feature-flag-definitions path via POST", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "restore", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag/restore");
    expect(req.body).toEqual({});
  });

  it("legacy mode: reallocate posts to the Split.io environments path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "reallocate", {
      workspace_id: "ws1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body: { comment: "shifting traffic" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1/my_flag/environments/e1/reallocate");
    expect(req.body).toEqual({ comment: "shifting traffic" });
  });

  it("new mode: reallocate routes to the Harness-native feature-flag-definitions path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "reallocate", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag/reallocate");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
  });

  it("new mode: archive routes to the Harness-native feature-flags path and drops title (unsupported by v4)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "archive", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      body: { comment: "no longer needed", title: "ignored" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flags/my_flag/archive");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(req.body).toEqual({ comment: "no longer needed" });
  });

  it("new mode: unarchive routes to the Harness-native feature-flags path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "unarchive", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flags/my_flag/unarchive");
    expect(req.body).toEqual({});
  });

  it("legacy mode: archive still posts to the Split.io path and forwards comment (title unsupported)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_feature_flag", "archive", {
      workspace_id: "ws1",
      feature_flag_name: "my_flag",
      body: { comment: "no longer needed", title: "cleanup" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1/my_flag/archive");
    expect(req.body).toEqual({ comment: "no longer needed" });
  });
});

describe("fme_feature_flag_definition", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode: get routes to the Split.io path with environment_id in the URL", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag_definition", "get", {
      workspace_id: "ws1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1/my_flag/environments/e1");
    expect(req.product).toBe("fme");
  });

  it("new mode: get routes to the Harness-native feature-flag-definitions path with environment_id as a query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag_definition", "get", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag");
    expect(req.product).toBeUndefined();
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
  });

  it("new mode: create routes to the Harness-native feature-flag-definitions path with the same body shape as legacy, plus optional title", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    const body = {
      treatments: [{ name: "on" }, { name: "off" }],
      defaultTreatment: "off",
      defaultRule: [{ treatment: "off", size: 100 }],
      title: "My Definition",
    };

    await registry.dispatch(client, "fme_feature_flag_definition", "create", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body,
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
    expect(req.body).toEqual(body);
  });

  it("new mode: update routes to the Harness-native feature-flag-definitions path via PATCH with merge-patch content type", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    const body = { treatments: [{ name: "on" }], trafficAllocation: 50 };

    await registry.dispatch(client, "fme_feature_flag_definition", "update", {
      org_id: "o1",
      project_id: "p1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body,
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag");
    expect(req.headers).toMatchObject({ "Content-Type": "application/merge-patch+json" });
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
    expect(req.body).toEqual(body);
  });

  it("legacy mode: update still uses PUT (no merge-patch header) against the Split.io API", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag_definition", "update", {
      workspace_id: "ws1",
      feature_flag_name: "my_flag",
      environment_id: "e1",
      body: { trafficAllocation: 50 },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("PUT");
    expect(req.path).toBe("/internal/api/v2/splits/ws/ws1/my_flag/environments/e1");
    expect(req.headers).toBeUndefined();
  });

  it("mixed params throws the shared error", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "get", {
        workspace_id: "ws1",
        org_id: "o1",
        feature_flag_name: "my_flag",
        environment_id: "e1",
      }),
    ).rejects.toThrow(
      "fme_feature_flag_definition: pass either workspace_id (deprecated) OR org_id+project_id, not both.",
    );
  });
});

describe("fme_identity create", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("transforms body.items into a raw API array without generic NG scope fields", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_identity", "create", {
      traffic_type_id: "tt-user",
      environment_id: "env-prod",
      body: {
        items: [
          { key: "user-1", values: { name: "Ada", company: "Acme" } },
          { key: "user-2", values: { name: "Grace" } },
        ],
      },
    });

    const call = firstRequest(mockRequest);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/internal/api/v2/trafficTypes/tt-user/environments/env-prod/identities");
    expect(call.baseUrl).toBe("https://api.split.io");
    expect(call.product).toBe("fme");
    expect(call.headers).toBeUndefined();
    expect(call.body).toEqual([
      { key: "user-1", values: { name: "Ada", company: "Acme" } },
      { key: "user-2", values: { name: "Grace" } },
    ]);
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("rejects raw identity array bodies outside the public object contract", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);
    const body = [{ key: "user-1", values: { name: "Ada" } }];

    await expect(
      registry.dispatch(client, "fme_identity", "create", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        body,
      }),
    ).rejects.toThrow("fme_identity create requires body.items with at least one identity");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fails before request construction when no identities are provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "create", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        body: { items: [] },
      }),
    ).rejects.toThrow("fme_identity create requires body.items with at least one identity");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("opts out of body scope injection", () => {
    expect(getOperation("fme_identity", "create").skipScopeBodyInjection).toBe(true);
  });
});

describe("fme_segment_keys update", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("uploads a raw key array and omits metadata-only comment", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_keys", "update", {
      environment_id: "env-prod",
      segment_name: "beta_users",
      body: {
        add: ["user-1", "user-2"],
        comment: "metadata only",
      },
    });

    const call = firstRequest(mockRequest);
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/internal/api/v2/segments/env-prod/beta_users/upload");
    expect(call.body).toEqual(["user-1", "user-2"]);
    expect(call.body).not.toHaveProperty("comment");
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("fails before request construction when no keys are provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        body: { add: [] },
      }),
    ).rejects.toThrow("fme_segment_keys update requires body.add with at least one key");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects undocumented body.keys alias", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        body: { keys: ["user-1"] },
      }),
    ).rejects.toThrow("fme_segment_keys update requires body.add with at least one key");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fails before request construction when body is omitted", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        environment_id: "env-prod",
        segment_name: "beta_users",
      }),
    ).rejects.toThrow("fme_segment_keys update requires body.add with at least one key");

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("opts out of body scope injection", () => {
    expect(getOperation("fme_segment_keys", "update").skipScopeBodyInjection).toBe(true);
  });
});

describe("fme_environment dual-mode routing", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("new mode: list routes to /fme/api/v4/environments", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "list", {
      org_id: "o1",
      project_id: "p1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/environments");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(req.params?.orgIdentifier).toBeUndefined();
    expect(req.params?.projectIdentifier).toBeUndefined();
  });

  it("legacy mode: list routes to /internal/api/v2/environments/ws/{wsId}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "list", {
      workspace_id: "ws1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/environments/ws/ws1");
  });
});

describe("fme_standard_segment — legacy only, Harness-native rejected in favor of fme_segment", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each(["list", "get"])("new mode: %s is rejected — use fme_segment instead", async (operation) => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_standard_segment", operation as any, {
        org_id: "o1",
        project_id: "p1",
        segment_name: "seg1",
      }),
    ).rejects.toThrow(/Harness-native.*not supported.*use fme_segment instead/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("legacy mode: list routes to /internal/api/v2/segments/ws/{wsId}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_standard_segment", "list", {
      workspace_id: "ws1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/segments/ws/ws1");
  });

  it("legacy mode: get routes to /internal/api/v2/segments/ws/{wsId}/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_standard_segment", "get", {
      workspace_id: "ws1",
      segment_name: "seg1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/segments/ws/ws1/seg1");
  });
});

describe("fme_rule_based_segment — legacy only, Harness-native rejected in favor of fme_segment", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each(["list", "get", "delete", "create"])("new mode: %s is rejected — use fme_segment instead", async (operation) => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_rule_based_segment", operation as any, {
        org_id: "o1",
        project_id: "p1",
        segment_name: "seg1",
        traffic_type_id: "tt1",
        body: { name: "x" },
      }),
    ).rejects.toThrow(/Harness-native.*not supported.*use fme_segment instead/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("legacy mode: list routes to /internal/api/v2/rule-based-segments/ws/{wsId}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_rule_based_segment", "list", {
      workspace_id: "ws1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/rule-based-segments/ws/ws1");
  });

  it("legacy mode: get routes to /internal/api/v2/rule-based-segments/ws/{wsId}/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_rule_based_segment", "get", {
      workspace_id: "ws1",
      segment_name: "seg1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/rule-based-segments/ws/ws1/seg1");
  });

  it("legacy mode: delete routes to /internal/api/v2/rule-based-segments/ws/{wsId}/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_rule_based_segment", "delete", {
      workspace_id: "ws1",
      segment_name: "seg1",
    });

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/rule-based-segments/ws/ws1/seg1");
  });
});

describe("fme_segment", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: routes /fme/api/v4/segments org_id+project_id with segment_type", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "list", {
      org_id: "o1",
      project_id: "p1",
      segment_type: "STANDARD",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segments");
    expect(req.product).toBeUndefined();
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      segment_type: "STANDARD",
    });
    expect(req.params?.orgIdentifier).toBeUndefined();
    expect(req.params?.projectIdentifier).toBeUndefined();
  });

  it("list: canonicalizes lowercase segment_type to STANDARD", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "list", {
      org_id: "o1",
      project_id: "p1",
      segment_type: "standard",
    });

    expect(firstRequest(mockRequest).params).toMatchObject({ segment_type: "STANDARD" });
  });

  it("list: passes unmatched segment_type through without a local throw", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "list", {
      org_id: "o1",
      project_id: "p1",
      segment_type: "not_a_kind",
    });

    expect(mockRequest).toHaveBeenCalled();
    expect(firstRequest(mockRequest).params).toMatchObject({ segment_type: "not_a_kind" });
  });

  it("list: throws when segment_type is missing and does not call the API", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "list", {
        org_id: "o1",
        project_id: "p1",
      }),
    ).rejects.toThrow(/Missing required filter.*segment_type/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("list: throws when org_id missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "list", {
        project_id: "p1",
        segment_type: "STANDARD",
      }),
    ).rejects.toThrow("fme_segment: org_id and project_id are required (account is taken from config).");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: routes to /fme/api/v4/segments/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "get", {
      org_id: "o1",
      project_id: "p1",
      segment_name: "seg1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segments/seg1");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("get: throws when segment_name missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "get", {
        org_id: "o1",
        project_id: "p1",
      }),
    ).rejects.toThrow(/segment_name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("delete: routes to /fme/api/v4/segments/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "delete", {
      org_id: "o1",
      project_id: "p1",
      segment_name: "seg1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segments/seg1");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("delete: throws when segment_name missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "delete", { org_id: "o1", project_id: "p1" }),
    ).rejects.toThrow(/segment_name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: routes to the Harness-native segments path with the confirmed v4 body shape", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "create", {
      org_id: "o1",
      project_id: "p1",
      body: { name: "x", type: "standard", trafficType: "user", tags: ["a"] },
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segments");
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(req.body).toEqual({
      name: "x",
      trafficType: "user",
      segmentType: "STANDARD",
      tags: [{ name: "a" }],
    });
    expect(req.body).not.toHaveProperty("type");
  });

  it("create: primary path sends segmentType STANDARD and omits type", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "create", {
      org_id: "o1",
      project_id: "p1",
      body: { name: "x", trafficType: "user", segmentType: "STANDARD", tags: ["a"] },
    });

    const body = firstRequest(mockRequest).body as Record<string, unknown>;
    expect(body).toEqual({
      name: "x",
      trafficType: "user",
      segmentType: "STANDARD",
      tags: [{ name: "a" }],
    });
    expect(body).not.toHaveProperty("type");
  });

  it("create: rejects an invalid type value", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x", type: "bogus", trafficType: "user" },
      }),
    ).rejects.toThrow(/invalid type 'bogus'/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: case-canonicalizes lowercase segmentType to STANDARD", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "create", {
      org_id: "o1",
      project_id: "p1",
      body: { name: "x", trafficType: "user", segmentType: "standard" },
    });

    expect(firstRequest(mockRequest).body).toMatchObject({ segmentType: "STANDARD" });
  });

  it("create: rejects an invalid segmentType value without HTTP", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x", trafficType: "user", segmentType: "bogus" },
      }),
    ).rejects.toThrow(/invalid segmentType 'bogus'/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: missing both segmentType and type throws before HTTP", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x", trafficType: "user" },
      }),
    ).rejects.toThrow(/segmentType/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: both present with the same kind is allowed", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "create", {
      org_id: "o1",
      project_id: "p1",
      body: { name: "x", trafficType: "user", segmentType: "STANDARD", type: "standard" },
    });

    const body = firstRequest(mockRequest).body as Record<string, unknown>;
    expect(body).toEqual({ name: "x", trafficType: "user", segmentType: "STANDARD" });
    expect(body).not.toHaveProperty("type");
  });

  it("create: both present with conflicting kinds throws without HTTP", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x", trafficType: "user", segmentType: "LARGE", type: "standard" },
      }),
    ).rejects.toThrow(/conflict/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: missing trafficType surfaces as a missing-required-field error", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        org_id: "o1",
        project_id: "p1",
        body: { name: "x", segmentType: "STANDARD" },
      }),
    ).rejects.toThrow(/trafficType/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: rejects missing org_id/project_id before making a request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment", "create", {
        body: { name: "x", trafficType: "user", segmentType: "STANDARD" },
      }),
    ).rejects.toThrow(/org_id and project_id are required/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("FME new-mode (NYI) resources", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each([
    ["fme_rollout_status", "list", { workspace_id: "ws1" }],
    ["fme_traffic_type", "list", { workspace_id: "ws1" }],
  ] as [string, "get" | "create" | "update" | "list", Record<string, unknown>][])(
    "%s.%s: legacy mode still works, new mode throws not-yet-implemented",
    async (resourceType, operation, legacyInput) => {
      const mockRequest = vi.fn().mockResolvedValue({});
      const client = makeClient(mockRequest);

      await registry.dispatch(client, resourceType, operation, legacyInput);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      const newModeInput = { ...legacyInput, workspace_id: undefined, org_id: "o1", project_id: "p1" };
      await expect(registry.dispatch(client, resourceType, operation, newModeInput)).rejects.toThrow(
        /not yet implemented/i,
      );
    },
  );

  it.each([
    ["list", { workspace_id: "ws1", environment_id: "e1" }],
    ["update", { workspace_id: "ws1", segment_name: "seg1", environment_id: "e1", body: {} }],
  ] as [string, Record<string, unknown>][])(
    "fme_rule_based_segment_definition.%s: legacy mode still works, new mode rejected — use fme_segment_definition instead",
    async (operation, legacyInput) => {
      const mockRequest = vi.fn().mockResolvedValue({});
      const client = makeClient(mockRequest);

      await registry.dispatch(client, "fme_rule_based_segment_definition", operation as any, legacyInput);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      const newModeInput = { ...legacyInput, workspace_id: undefined, org_id: "o1", project_id: "p1" };
      await expect(
        registry.dispatch(client, "fme_rule_based_segment_definition", operation as any, newModeInput),
      ).rejects.toThrow(/Harness-native.*not supported on this deprecated resource/i);
    },
  );

  it.each([
    ["enable", { workspace_id: "ws1", environment_id: "e1", segment_name: "seg1" }],
    ["disable", { workspace_id: "ws1", environment_id: "e1", segment_name: "seg1" }],
    [
      "change_request",
      {
        workspace_id: "ws1",
        environment_id: "e1",
        title: "t",
        operationType: "UPDATE",
        ruleBasedSegment: { title: "seg" },
      },
    ],
  ] as [string, Record<string, unknown>][])(
    "fme_rule_based_segment_definition.%s action: legacy mode still works, new mode rejected — use fme_segment_definition instead",
    async (action, legacyInput) => {
      const mockRequest = vi.fn().mockResolvedValue({});
      const client = makeClient(mockRequest);

      await registry.dispatchExecute(client, "fme_rule_based_segment_definition", action, legacyInput);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      const newModeInput = { ...legacyInput, workspace_id: undefined, org_id: "o1", project_id: "p1" };
      await expect(
        registry.dispatchExecute(client, "fme_rule_based_segment_definition", action, newModeInput),
      ).rejects.toThrow(/Harness-native.*not supported on this deprecated resource/i);
    },
  );
});

describe("fme_workspace permissive resolver", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode: list with zero identifiers still works and logs a deprecation warning", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_workspace", "list", {});

    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/workspaces");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("[DEPRECATION] fme_workspace"));
    spy.mockRestore();
  });

  it("org_id+project_id throws a dedicated no-equivalent error, not the generic NYI message", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_workspace", "list", { org_id: "o1", project_id: "p1" }),
    ).rejects.toThrow(/no Harness-native equivalent/i);
  });
});

describe("fme_identity permissive mode-selector", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode (current traffic_type_id/environment_id contract) still works for create", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_identity", "create", {
      traffic_type_id: "tt-user",
      environment_id: "env-prod",
      body: { items: [{ key: "user-1", values: { name: "Ada" } }] },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/trafficTypes/tt-user/environments/env-prod/identities");
  });

  it("org_id+project_id throws not-yet-implemented for create", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "create", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        org_id: "o1",
        project_id: "p1",
        body: { items: [{ key: "user-1", values: { name: "Ada" } }] },
      }),
    ).rejects.toThrow(/not yet implemented/i);
  });

  it("legacy mode still works for update", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ ok: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_identity", "update", {
      traffic_type_id: "tt-user",
      environment_id: "env-prod",
      key: "user-1",
      body: { values: { name: "Ada" } },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(firstRequest(mockRequest).path).toBe(
      "/internal/api/v2/trafficTypes/tt-user/environments/env-prod/identities/user-1",
    );
  });

  it("org_id+project_id throws not-yet-implemented for update", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "update", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        key: "user-1",
        org_id: "o1",
        project_id: "p1",
        body: { values: { name: "Ada" } },
      }),
    ).rejects.toThrow(/not yet implemented/i);
  });
});

describe("fme_segment_keys permissive mode-selector", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("legacy mode (current environment_id/segment_name contract) still works for list", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_keys", "list", {
      environment_id: "env-prod",
      segment_name: "beta_users",
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/segments/env-prod/beta_users/keys");
  });

  it("org_id+project_id throws not-yet-implemented for list", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "list", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        org_id: "o1",
        project_id: "p1",
      }),
    ).rejects.toThrow(/not yet implemented/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("legacy mode still works for update", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_keys", "update", {
      environment_id: "env-prod",
      segment_name: "beta_users",
      body: { add: ["user-1"] },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(firstRequest(mockRequest).path).toBe("/internal/api/v2/segments/env-prod/beta_users/upload");
  });

  it("org_id+project_id throws not-yet-implemented for update", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        org_id: "o1",
        project_id: "p1",
        body: { add: ["user-1"] },
      }),
    ).rejects.toThrow(/not yet implemented/i);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("FME required identifier validation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("fme_feature_flag get rejects a missing feature_flag_name before any request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag", "get", { workspace_id: "ws1" }),
    ).rejects.toThrow('fme_feature_flag: "feature_flag_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_feature_flag delete rejects a missing feature_flag_name instead of sending a trailing-slash path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag", "delete", { workspace_id: "ws1" }),
    ).rejects.toThrow('fme_feature_flag: "feature_flag_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_feature_flag get rejects a missing feature_flag_name in Harness-native mode too", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag", "get", { org_id: "o1", project_id: "p1" }),
    ).rejects.toThrow('fme_feature_flag: "feature_flag_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_rule_based_segment get rejects a missing segment_name", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_rule_based_segment", "get", { workspace_id: "ws1" }),
    ).rejects.toThrow('fme_rule_based_segment: "segment_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_rule_based_segment delete rejects an empty segment_name", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_rule_based_segment", "delete", { workspace_id: "ws1", segment_name: "" }),
    ).rejects.toThrow('fme_rule_based_segment: "segment_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_standard_segment get rejects a missing segment_name", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_standard_segment", "get", { workspace_id: "ws1" }),
    ).rejects.toThrow('fme_standard_segment: "segment_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_feature_flag kill rejects a missing environment_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "fme_feature_flag", "kill", { workspace_id: "ws1", feature_flag_name: "my_flag" }),
    ).rejects.toThrow('fme_feature_flag: "environment_id" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_identity update rejects a missing key", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "update", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        body: { values: { name: "Ada" } },
      }),
    ).rejects.toThrow('fme_identity: "key" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_segment_keys update rejects a missing segment_name", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        environment_id: "env-prod",
        body: { add: ["user-1"] },
      }),
    ).rejects.toThrow('fme_segment_keys: "segment_name" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("FME permissive mode-selector partial scope pairs", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("fme_identity create rejects a lone org_id instead of leaking orgIdentifier onto the legacy call", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "create", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        org_id: "o1",
        body: { items: [{ key: "user-1", values: { name: "Ada" } }] },
      }),
    ).rejects.toThrow("fme_identity.create: project_id is required when org_id is provided.");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_identity create rejects a lone project_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_identity", "create", {
        traffic_type_id: "tt-user",
        environment_id: "env-prod",
        project_id: "p1",
        body: { items: [{ key: "user-1", values: { name: "Ada" } }] },
      }),
    ).rejects.toThrow("fme_identity.create: org_id is required when project_id is provided.");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_segment_keys list rejects a lone org_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_keys", "list", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        org_id: "o1",
      }),
    ).rejects.toThrow("fme_segment_keys.list: project_id is required when org_id is provided.");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_rule_based_segment_definition enable rejects a lone org_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "fme_rule_based_segment_definition", "enable", {
        environment_id: "env-prod",
        segment_name: "beta_users",
        org_id: "o1",
      }),
    ).rejects.toThrow("fme_rule_based_segment_definition.enable: project_id is required when org_id is provided.");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fme_workspace list rejects a lone org_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_workspace", "list", { org_id: "o1" }),
    ).rejects.toThrow("fme_workspace.list: project_id is required when org_id is provided.");
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("fme_segment_definition", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list: routes to /fme/api/v4/segment-definitions with account_id/organization_identifier/project_identifier/environment_id params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_definition", "list", {
      org_id: "o1",
      project_id: "p1",
      environment_id: "e1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segment-definitions");
    expect(req.product).toBeUndefined();
    expect(req.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
      environment_id: "e1",
    });
  });

  it("list: throws when org_id/project_id missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_definition", "list", { environment_id: "e1" }),
    ).rejects.toThrow("fme_segment_definition: org_id and project_id are required (account is taken from config).");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("get: routes to /fme/api/v4/segment-definitions/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_definition", "get", {
      org_id: "o1",
      project_id: "p1",
      environment_id: "e1",
      segment_name: "seg1",
    });

    const req = firstRequest(mockRequest);
    expect(req.path).toBe("/fme/api/v4/segment-definitions/seg1");
    expect(req.params).toMatchObject({ environment_id: "e1" });
  });

  it("get: throws when segment_name missing", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_segment_definition", "get", { org_id: "o1", project_id: "p1", environment_id: "e1" }),
    ).rejects.toThrow(/segment_name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("create: POSTs to /fme/api/v4/segment-definitions/{segment_name} with description body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_definition", "create", {
      org_id: "o1",
      project_id: "p1",
      environment_id: "e1",
      segment_name: "seg1",
      body: { description: "beta users" },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/fme/api/v4/segment-definitions/seg1");
    expect(req.body).toEqual({ description: "beta users" });
  });

  it("update: PATCHes with merge-patch content type and only the description field", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_definition", "update", {
      org_id: "o1",
      project_id: "p1",
      environment_id: "e1",
      segment_name: "seg1",
      body: { description: null },
    });

    const req = firstRequest(mockRequest);
    expect(req.method).toBe("PATCH");
    expect(req.path).toBe("/fme/api/v4/segment-definitions/seg1");
    expect(req.headers).toMatchObject({ "Content-Type": "application/merge-patch+json" });
    expect(req.body).toEqual({ description: null });
  });

  it("delete: routes to /fme/api/v4/segment-definitions/{segment_name}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment_definition", "delete", {
      org_id: "o1",
      project_id: "p1",
      environment_id: "e1",
      segment_name: "seg1",
    });

    expect(firstRequest(mockRequest).path).toBe("/fme/api/v4/segment-definitions/seg1");
  });

  it("has no enable/disable/change_request execute actions", () => {
    const resource = findResource("fme_segment_definition");
    expect(resource.executeActions).not.toHaveProperty("enable");
    expect(resource.executeActions).not.toHaveProperty("disable");
    expect(resource.executeActions).not.toHaveProperty("change_request");
    expect(resource.executeActions).toHaveProperty("list_keys");
    expect(resource.executeActions).toHaveProperty("add_keys");
    expect(resource.executeActions).toHaveProperty("remove_keys");
  });
});
