import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";
import { featureFlagsToolset } from "../../src/registry/toolsets/feature-flags.js";

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

function firstRequest(mockRequest: ReturnType<typeof vi.fn>): RequestOptions {
  return mockRequest.mock.calls[0][0] as RequestOptions;
}

const nativeScope = { org_id: "o1", project_id: "p1" };
const ENV_ID = "a4cb7d40-67ef-11f1-9ff8-96e3734caedf";

describe("fme_environment remaining dual-mode ops", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get: native routes to v4 environments by id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "get", {
      ...nativeScope,
      environment_id: ENV_ID,
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("GET");
    expect(request.path).toBe(`/fme/api/v4/environments/${ENV_ID}`);
    expect(request.path).not.toContain("/environments/ws/");
    expect(request.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("get: legacy workspace_id is rejected because v2 has no item GET", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_environment", "get", {
        workspace_id: "ws1",
        environment_id: ENV_ID,
      }),
    ).rejects.toThrow(/Harness-native only/i);
  });

  it("create: native POST omits type and uses isProduction", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "create", {
      ...nativeScope,
      body: { name: "mcp_pr3_smoke", isProduction: false },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/fme/api/v4/environments");
    expect(request.body).toEqual({ name: "mcp_pr3_smoke", isProduction: false });
    const create = featureFlagsToolset.resources.find((r) => r.resourceType === "fme_environment")?.operations.create;
    expect(create?.skipScopeBodyInjection).toBe(true);
  });

  it("create: legacy POST uses production on the v2 workspace path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "create", {
      workspace_id: "ws1",
      body: { name: "legacy-env", production: true },
    });

    const request = firstRequest(mockRequest);
    expect(request.path).toBe("/internal/api/v2/environments/ws/ws1");
    expect(request.body).toEqual({ name: "legacy-env", production: true });
  });

  it("update: native merge-patch maps production to isProduction", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "update", {
      ...nativeScope,
      environment_id: ENV_ID,
      body: { name: "renamed", production: false },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("PATCH");
    expect(request.path).toBe(`/fme/api/v4/environments/${ENV_ID}`);
    expect(request.headers).toMatchObject({ "Content-Type": "application/merge-patch+json" });
    expect(request.body).toEqual({ name: "renamed", isProduction: false });
  });

  it("update: legacy sends JSON Patch replace ops", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "update", {
      workspace_id: "ws1",
      environment_id: ENV_ID,
      body: { name: "renamed", production: true },
    });

    const request = firstRequest(mockRequest);
    expect(request.path).toBe(`/internal/api/v2/environments/ws/ws1/${ENV_ID}`);
    expect(request.body).toEqual([
      { op: "replace", path: "/name", value: "renamed" },
      { op: "replace", path: "/production", value: true },
    ]);
  });

  it("delete: native and legacy route by environment_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_environment", "delete", {
      ...nativeScope,
      environment_id: ENV_ID,
    });

    expect(firstRequest(mockRequest).method).toBe("DELETE");
    expect(firstRequest(mockRequest).path).toBe(`/fme/api/v4/environments/${ENV_ID}`);

    mockRequest.mockClear();
    await registry.dispatch(client, "fme_environment", "delete", {
      workspace_id: "ws1",
      environment_id: ENV_ID,
    });
    expect(firstRequest(mockRequest).path).toBe(`/internal/api/v2/environments/ws/ws1/${ENV_ID}`);
  });
});
