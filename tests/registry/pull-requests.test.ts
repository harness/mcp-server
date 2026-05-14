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

describe("pull_request registry mappings", () => {
  it("routes state-only updates to the Harness Code PR state endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "closed" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { state: "closed" },
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed" },
    }));
  });

  it("keeps title and description updates on the PR metadata endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, title: "Updated" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { title: "Updated" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/code/api/v1/repos/rc_tools/pullreq/42",
      body: { title: "Updated" },
    }));
  });

  it("supports an explicit close execute action", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "closed" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "close", {
      repo_id: "rc_tools",
      pr_number: "42",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed" },
    }));
  });
});
