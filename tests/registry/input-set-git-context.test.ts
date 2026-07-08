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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("input_set git query-param mapping", () => {
  // Regression (#579): remote/Git-stored input sets silently resolve from the
  // repo default branch when branch/repo/connector/storeType are omitted on GET.
  // The get op must forward git context the same way pipeline and template reads do.
  it("maps git params on get so branch reaches the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "remote-set" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "input_set", "get", {
      pipeline_id: "my-pipeline",
      input_set_id: "remote-set",
      org_id: "default",
      project_id: "my-project",
      branch: "feature/x",
      repo_name: "my-repo",
      connector_ref: "gh_conn",
      store_type: "REMOTE",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/inputSets/remote-set",
        params: expect.objectContaining({
          pipelineIdentifier: "my-pipeline",
          branch: "feature/x",
          repoName: "my-repo",
          connectorRef: "gh_conn",
          storeType: "REMOTE",
        }),
      }),
    );
  });

  it("omits git params when branch is empty so callers do not send blank query values", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "inline-set" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "input_set", "get", {
      pipeline_id: "my-pipeline",
      input_set_id: "inline-set",
      org_id: "default",
      project_id: "my-project",
      branch: "",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/inputSets/inline-set",
        params: expect.objectContaining({
          pipelineIdentifier: "my-pipeline",
        }),
      }),
    );
    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params?.branch).toBeUndefined();
  });
});
