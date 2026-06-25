/**
 * Regression tests for _post_update_hint on pipeline and service update
 * responses. Partial YAML updates can silently truncate nested blocks; the hint
 * reminds agents to verify the resource after every update.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("post-update hints", () => {
  it("pipeline update attaches _post_update_hint to verify stages/steps", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({
      data: { identifier: "my_pipe", yamlPipeline: "pipeline:\n  identifier: my_pipe\n" },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "pipeline", "update", {
      pipeline_id: "my_pipe",
      org_id: "default",
      project_id: "my-project",
      body: { yamlPipeline: "pipeline:\n  identifier: my_pipe\n  stages: []\n" },
    })) as Record<string, unknown>;

    expect(result._post_update_hint).toContain("harness_get");
    expect(result._post_update_hint).toContain("stages/steps");
  });

  it("service update attaches _post_update_hint to verify serviceDefinition", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "services" }));
    const mockRequest = vi.fn().mockResolvedValue({
      data: { service: { identifier: "my_svc", name: "My Service" } },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "service", "update", {
      service_id: "my_svc",
      org_id: "default",
      project_id: "my-project",
      body: { service: { identifier: "my_svc", name: "My Service" } },
    })) as Record<string, unknown>;

    expect(result._post_update_hint).toContain("serviceDefinition");
    expect(result._post_update_hint).toContain("harness_get");
  });
});
