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

  it("documents fme_traffic_type list workspace_id requirement", () => {
    const resource = findResource("fme_traffic_type");

    expect(resource.listFilterFields).toContainEqual({
      name: "workspace_id",
      description: "FME workspace ID (get from fme_workspace)",
      required: true,
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

describe("FME auth", () => {
  it("uses x-api-key auth from a non-placeholder HARNESS_API_KEY fallback", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_workspace", "list", {});

    const call = firstRequest(mockRequest);
    expect(call.product).toBe("fme");
    expect(call.baseUrl).toBe("https://api.split.io");
    expect(call.headers).toMatchObject({ "x-api-key": "pat.test" });
    expect(call.headers).not.toHaveProperty("Authorization");
  });

  it("prefers explicit HARNESS_FME_API_KEY over a hosted placeholder HARNESS_API_KEY", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_API_KEY: "dummy",
      HARNESS_FME_API_KEY: "fme-admin-key",
    }));
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_workspace", "list", {});

    const call = firstRequest(mockRequest);
    expect(call.headers).toMatchObject({ "x-api-key": "fme-admin-key" });
    expect(call.headers).not.toHaveProperty("Authorization");
  });

  it("fails before sending hosted placeholder credentials to Split.io", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_API_KEY: "dummy",
      HARNESS_FME_API_KEY: undefined,
    }));
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    try {
      await registry.dispatch(client, "fme_workspace", "list", {});
      expect.fail("expected FME auth guard to throw");
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain("FME is not configured or authorized for this MCP session");
      expect(message).toContain("Ask your Harness administrator to configure an FME/Split Admin API key");
    }

    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("fails before sending dotted internal placeholders to Split.io", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_API_KEY: "pat.internal.internal.dummy",
      HARNESS_FME_API_KEY: undefined,
    }));
    const mockRequest = vi.fn().mockResolvedValue({ objects: [], totalCount: 0, offset: 0, limit: 20 });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_workspace", "list", {}),
    ).rejects.toThrow("Hosted OAuth placeholders");

    expect(mockRequest).not.toHaveBeenCalled();
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
      org_id: "ignored-org",
      project_id: "ignored-project",
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
    expect(call.headers).toMatchObject({ "x-api-key": "pat.test" });
    expect(call.headers).not.toHaveProperty("Authorization");
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
      org_id: "ignored-org",
      project_id: "ignored-project",
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
