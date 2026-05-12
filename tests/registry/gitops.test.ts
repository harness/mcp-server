import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("GitOps registry metadata", () => {
  it("describes application update with app name as resource_id and agent_id in params", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const description = registry.getResource("gitops_application").operations.update?.description ?? "";

    expect(description).toContain("resource_id must be the app_name");
    expect(description).toContain("params={agent_id:'account.myagent'");
    expect(description).not.toContain("resource_id must be the agent_id");
  });

  it("describes ApplicationSet update with UUID as resource_id and agent_id in params", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const description = registry.getResource("gitops_applicationset").operations.update?.description ?? "";

    expect(description).toContain("resource_id='<appset_id>'");
    expect(description).toContain("params={agent_id:'account.myagent'}");
    expect(description).not.toContain("resource_id='account.myagent'");
  });
});

describe("GitOps update dispatch", () => {
  it("updates applications with agent_id in params and app_name as the resource identifier", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "demo-app" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "update", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      body: {
        application: {
          metadata: { name: "demo-app" },
          spec: {},
        },
      },
    });

    const call = mockRequest.mock.calls[0]?.[0] as { method: string; path: string };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app");
  });

  it("updates ApplicationSets with agent_id as a query param", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const mockRequest = vi.fn().mockResolvedValue({ applicationset: { metadata: { name: "demo-set" } } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "update", {
      appset_id: "cce8a056-8059-4b2b-a268-f1b715d74a59",
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: {
            name: "demo-set",
            uid: "cce8a056-8059-4b2b-a268-f1b715d74a59",
          },
          spec: {
            template: {
              spec: {
                project: "default",
              },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0]?.[0] as {
      method: string;
      path: string;
      params: Record<string, string>;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gitops/api/v1/applicationset");
    expect(call.params.agentIdentifier).toBe("account.myagent");
  });
});
