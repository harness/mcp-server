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
const nativeIdentifiers = {
  ...nativeScope,
  feature_flag_name: "my_flag",
  environment_id: "env1",
};

describe("fme_feature_flag_definition native-only operations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("lists native definitions with feature-flag filtering and limit/offset pagination", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag_definition", "list", {
      ...nativeScope,
      feature_flag_name: "my_flag",
      limit: 25,
      offset: 10,
    });

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/fme/api/v4/feature-flag-definitions");
    expect(request.path).not.toContain("/environments/");
    expect(request.params).toMatchObject({
      feature_flag_name: "my_flag",
      limit: 25,
      offset: 10,
      account_id: "test-account",
      organization_identifier: "o1",
      project_identifier: "p1",
    });
  });

  it("rejects workspace_id for native-only lists", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "list", {
        workspace_id: "ws1",
        feature_flag_name: "my_flag",
      }),
    ).rejects.toThrow(
      "fme_feature_flag_definition.list: Harness-native (org_id/project_id) only — pass org_id+project_id instead of workspace_id.",
    );
  });

  it("rejects mixed workspace and native list scope", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "list", {
        workspace_id: "ws1",
        ...nativeScope,
        feature_flag_name: "my_flag",
      }),
    ).rejects.toThrow(
      "fme_feature_flag_definition: pass either workspace_id (deprecated) OR org_id+project_id, not both.",
    );
  });

  it("deletes a native definition with environment_id as a query parameter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "fme_feature_flag_definition", "delete", nativeIdentifiers);

    const request = firstRequest(mockRequest);
    expect(request.method).toBe("DELETE");
    expect(request.path).toBe("/fme/api/v4/feature-flag-definitions/my_flag");
    expect(request.path).not.toContain("/environments/");
    expect(request.params).toMatchObject({ environment_id: "env1" });
  });

  it("rejects workspace_id for native-only deletes", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "delete", {
        workspace_id: "ws1",
        feature_flag_name: "my_flag",
        environment_id: "env1",
      }),
    ).rejects.toThrow(
      "fme_feature_flag_definition.delete: Harness-native (org_id/project_id) only — pass org_id+project_id instead of workspace_id.",
    );
  });

  it.each(["kill", "restore", "reallocate"] as const)(
    "executes native %s with comment and title",
    async (action) => {
      const mockRequest = vi.fn().mockResolvedValue({});
      const client = makeClient(mockRequest);

      await registry.dispatchExecute(client, "fme_feature_flag_definition", action, {
        ...nativeIdentifiers,
        body: { comment: "reason", title: "change" },
      });

      const request = firstRequest(mockRequest);
      expect(request.method).toBe("POST");
      expect(request.path).toBe(`/fme/api/v4/feature-flag-definitions/my_flag/${action}`);
      expect(request.path).not.toContain("/environments/");
      expect(request.params).toMatchObject({ environment_id: "env1" });
      expect(request.body).toEqual({ comment: "reason", title: "change" });
    },
  );

  it("rejects workspace_id for native-only execute actions", async () => {
    const client = makeClient();

    await expect(
      registry.dispatchExecute(client, "fme_feature_flag_definition", "kill", {
        workspace_id: "ws1",
        feature_flag_name: "my_flag",
        environment_id: "env1",
      }),
    ).rejects.toThrow(
      "fme_feature_flag_definition.kill: Harness-native (org_id/project_id) only — pass org_id+project_id instead of workspace_id.",
    );
  });

  it("list rejects a missing feature_flag_name before any request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "list", nativeScope),
    ).rejects.toThrow(
      'Missing required filter(s) for listing fme_feature_flag_definition: feature_flag_name. Pass them via filters (e.g. filters: { feature_flag_name: "..." }).',
    );
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("delete rejects a missing environment_id before any request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "fme_feature_flag_definition", "delete", {
        ...nativeScope,
        feature_flag_name: "my_flag",
      }),
    ).rejects.toThrow('fme_feature_flag_definition: "environment_id" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("kill rejects a missing environment_id before any request", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "fme_feature_flag_definition", "kill", {
        ...nativeScope,
        feature_flag_name: "my_flag",
      }),
    ).rejects.toThrow('fme_feature_flag_definition: "environment_id" is required.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("keeps tool-facing descriptions off HTTP paths", () => {
    const resource = registry.getResource("fme_feature_flag_definition");
    const texts = [
      resource.description,
      resource.operations.list?.description,
      resource.operations.get?.description,
      resource.operations.create?.description,
      resource.operations.update?.description,
      resource.operations.delete?.description,
      resource.executeActions?.kill?.actionDescription,
      resource.executeActions?.restore?.actionDescription,
      resource.executeActions?.reallocate?.actionDescription,
    ];

    for (const text of texts) {
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\/fme\/api\//);
      expect(text).not.toMatch(/\/internal\/api\//);
    }
    expect(resource.description).not.toMatch(/share endpoints/i);
  });
});
