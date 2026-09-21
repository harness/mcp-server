/**
 * Regression tests for repository.update field contracts and the
 * set_default_branch / set_public_access execute actions (PR #994 review).
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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("repository.update field contract", () => {
  it("sends state as an integer, not a string", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "repository", "update", {
      repo_id: "my-repo",
      body: { state: 4 },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/code/api/v1/repos/my-repo",
      body: { state: 4 },
    }));
  });
});

describe("repository set_default_branch execute action", () => {
  it("posts the branch name to the default-branch endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "set_default_branch", {
      repo_id: "my-repo",
      body: { name: "develop" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my-repo/default-branch",
      body: { name: "develop" },
    }));
  });

  it("rejects when name is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "repository", "set_default_branch", {
        repo_id: "my-repo",
        body: {},
      }),
    ).rejects.toThrow(/Missing required fields for repository: name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("repository set_public_access execute action", () => {
  it("posts is_public to the public-access endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "set_public_access", {
      repo_id: "my-repo",
      body: { is_public: true },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my-repo/public-access",
      body: { is_public: true },
    }));
  });

  it("rejects when is_public is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "repository", "set_public_access", {
        repo_id: "my-repo",
        body: {},
      }),
    ).rejects.toThrow(/Missing required fields for repository: is_public/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
