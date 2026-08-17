import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { RequestOptions } from "../../src/client/types.js";
import { Registry } from "../../src/registry/index.js";

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
const KEYS_POINTER =
  "fme_segment_definition execute actions list_keys, add_keys, and remove_keys";

describe("fme_segment remaining native update", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("patches a segment via merge-patch with description tags and owners", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "update", {
      ...nativeScope,
      segment_name: "seg1",
      body: { description: "updated", tags: ["beta"], owners: [{ type: "USER", email: "a@b.c" }] },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("PATCH");
    expect(request.path).toBe("/fme/api/v4/segments/seg1");
    expect(request.headers).toMatchObject({ "Content-Type": "application/merge-patch+json" });
    expect(request.params).toMatchObject({
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
    expect(request.body).toEqual({
      description: "updated",
      tags: [{ name: "beta" }],
      owners: [{ type: "USER", email: "a@b.c" }],
    });
  });

  it("omits unset merge-patch fields and forwards explicit nulls", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_segment", "update", {
      ...nativeScope,
      segment_name: "seg1",
      body: { description: null, tags: [] },
    });

    expect(firstRequest(mockRequest).body).toEqual({ description: null, tags: [] });
  });

  it("rejects workspace_id because fme_segment is Harness-native only", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_segment", "update", {
        workspace_id: "ws1",
        segment_name: "seg1",
        body: { description: "x" },
      }),
    ).rejects.toThrow("fme_segment: org_id and project_id are required (account is taken from config).");
  });
});

describe("fme_segment_definition remaining key execute actions", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("lists keys with environment_id limit and offset", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_segment_definition", "list_keys", {
      ...nativeScope,
      segment_name: "seg1",
      environment_id: "env1",
      limit: 25,
      offset: 10,
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/fme/api/v4/segment-definitions/seg1/keys");
    expect(request.path).not.toContain("/environments/");
    expect(request.params).toMatchObject({
      environment_id: "env1",
      limit: 25,
      offset: 10,
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("adds keys with optional replace query and comment title", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_segment_definition", "add_keys", {
      ...nativeScope,
      segment_name: "seg1",
      environment_id: "env1",
      replace: true,
      body: { keys: ["a", "b"], comment: "c", title: "t" },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/fme/api/v4/segment-definitions/seg1/keys");
    expect(request.params).toMatchObject({ environment_id: "env1", replace: true });
    expect(request.body).toEqual({ keys: ["a", "b"], comment: "c", title: "t" });
  });

  it("removes keys via POST keys/remove", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "fme_segment_definition", "remove_keys", {
      ...nativeScope,
      segment_name: "seg1",
      environment_id: "env1",
      body: { keys: ["a"], comment: "c", title: "t" },
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/fme/api/v4/segment-definitions/seg1/keys/remove");
    expect(request.params).toMatchObject({ environment_id: "env1" });
    expect(request.body).toEqual({ keys: ["a"], comment: "c", title: "t" });
  });

  it("requires keys array on remove_keys", async () => {
    const client = makeClient();

    await expect(
      registry.dispatchExecute(client, "fme_segment_definition", "remove_keys", {
        ...nativeScope,
        segment_name: "seg1",
        environment_id: "env1",
        body: { keys: [] },
      }),
    ).rejects.toThrow(/keys/);
  });
});

describe("fme_segment_keys native pointer", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("points native list at segment definition execute actions", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_segment_keys", "list", {
        ...nativeScope,
        environment_id: "env1",
        segment_name: "seg1",
      }),
    ).rejects.toThrow(KEYS_POINTER);
  });

  it("points native update at segment definition execute actions", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_segment_keys", "update", {
        ...nativeScope,
        environment_id: "env1",
        segment_name: "seg1",
        body: { add: ["a"] },
      }),
    ).rejects.toThrow(KEYS_POINTER);
  });
});
