/**
 * Harness Code keeps default branch and visibility on dedicated endpoints, so
 * repository update silently drops default_branch/is_public. These tests cover
 * the execute actions that reach the endpoints the backend actually accepts.
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

describe("repository default branch action", () => {
  it("posts the default-branch endpoint with a name-only body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ default_branch: "develop" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "update_default_branch", {
      repo_id: "my-repo",
      org_id: "AI_Devops",
      project_id: "Sanity",
      body: { name: "develop" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my-repo/default-branch",
      body: { name: "develop" },
      params: expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
      }),
    }));
  });

  it("accepts the default_branch alias from params/top-level input", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ default_branch: "main" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "update_default_branch", {
      repo_id: "my-repo",
      default_branch: "main",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { name: "main" },
    }));
  });

  it("rejects a missing branch name before calling the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "repository", "update_default_branch", {
        repo_id: "my-repo",
      }),
    ).rejects.toThrow(/name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("repository public access action", () => {
  it("preserves an explicit false visibility", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ is_public: false });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "update_public_access", {
      repo_id: "my-repo",
      body: { is_public: false },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my-repo/public-access",
      body: { is_public: false },
    }));
  });

  it("coerces the string form of is_public", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ is_public: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "repository", "update_public_access", {
      repo_id: "my-repo",
      is_public: "true",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { is_public: true },
    }));
  });

  it("rejects a non-boolean is_public", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "repository", "update_public_access", {
        repo_id: "my-repo",
        is_public: "yes",
      }),
    ).rejects.toThrow(/is_public must be a boolean/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects a missing is_public before calling the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "repository", "update_public_access", {
        repo_id: "my-repo",
      }),
    ).rejects.toThrow(/is_public/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
