/**
 * Contract tests for registry-level paramsSchema enforcement (#620).
 *
 * paramsSchema.required is validated in Registry.dispatch before any API call.
 * These tests lock in fail-fast behavior and error message shape across toolsets.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
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

function makeClient(): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("paramsSchema dispatch enforcement", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops,semantic-layer" }));
  });

  it("gitops_agent.delete: rejects missing resource_id before path resolution", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_agent", "delete", {}),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_agent\.delete: resource_id/);

    expect((client.request as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("gitops_cluster.delete: rejects missing agent_id", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_cluster", "delete", {
        cluster_id: "my-cluster",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_cluster\.delete: agent_id/);

    expect((client.request as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("kg_type.get: error message includes harness_describe hint", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "kg_type", "get", { type_id: "service" }),
    ).rejects.toThrow(/Use harness_describe\(resource_type="kg_type"\)/);
  });

  it("paramsSchema validation runs before operation-specific preflight hooks", async () => {
    const client = makeClient();

    await expect(
      registry.dispatch(client, "gitops_application", "delete", {
        agent_id: "account.myagent",
        app_name: "demo-app",
        cascade: "true",
        propagation_policy: "foreground",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_application\.delete: remove_existing_finalizers/);

    expect((client.request as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
