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

describe("pipeline_v1 body construction", () => {
  it("extracts identifier from v1 pipeline.id in raw YAML bodies", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "v1-pipeline" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "default",
      project_id: "my-project",
      body: `
pipeline:
  id: v1-pipeline
  name: V1 Pipeline
  stages: []
`,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/orgs/default/projects/my-project/pipelines",
        body: expect.objectContaining({
          identifier: "v1-pipeline",
          name: "V1 Pipeline",
          version: "1",
        }),
      }),
    );
  });
});
