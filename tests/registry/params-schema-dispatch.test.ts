/**
 * Regression tests for generic paramsSchema enforcement in Registry.dispatch (#620).
 * Required params declared on endpoint specs must fail fast before any HTTP call.
 */
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

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("paramsSchema dispatch enforcement", () => {
  it("blocks gitops_repository delete when required agent_id is missing", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_repository", "delete", {
        repo_id: "my-repo",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_repository\.delete: agent_id/);

    expect(client.request).not.toHaveBeenCalled();
  });

  it("blocks gitops_cluster delete when required agent_id is missing", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_cluster", "delete", {
        cluster_id: "cluster11",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_cluster\.delete: agent_id/);

    expect(client.request).not.toHaveBeenCalled();
  });

  it("includes harness_describe hint in paramsSchema validation errors", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_repo_credential", "delete", {
        credential_id: "my-cred",
      }),
    ).rejects.toThrow(/Use harness_describe\(resource_type="gitops_repo_credential"\)/);

    expect(client.request).not.toHaveBeenCalled();
  });
});
