/**
 * Slash-containing branch names, tags, and diff ranges must keep their
 * slashes as extra path segments. Encoding the whole name as one `%2F`
 * segment 404s — the same bug as nested file_content paths.
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

describe("branch path encoding", () => {
  it("keeps slashes in branch names instead of encoding them as %2F", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ name: "feature/foo" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "get", {
      repo_id: "my-repo",
      branch_name: "feature/foo",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/branches/feature/foo",
    }));
  });

  it("encodes spaces in branch segments but still keeps slashes", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ name: "feature/my branch" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "get", {
      repo_id: "my-repo",
      branch_name: "feature/my branch",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/branches/feature/my%20branch",
    }));
  });

  it("leaves slash-free branch names unchanged", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ name: "main" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "get", {
      repo_id: "my-repo",
      branch_name: "main",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/branches/main",
    }));
  });

  it("aliases git_ref onto branch_name for get", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ name: "feature/foo" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "get", {
      repo_id: "my-repo",
      git_ref: "feature/foo",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/branches/feature/foo",
    }));
  });

  it("keeps slashes when deleting a nested branch", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "delete", {
      repo_id: "my-repo",
      branch_name: "feature/foo",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE",
      path: "/code/api/v1/repos/my-repo/branches/feature/foo",
    }));
  });

  it("rejects get without a branch name", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "branch", "get", { repo_id: "my-repo" }),
    ).rejects.toThrow(/branch_name/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("coerces string page to number before applying +1 offset on list", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "branch", "list", {
      repo_id: "my-repo",
      page: "2" as unknown as number,
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.page).toBe(3);
  });
});

describe("tag path encoding", () => {
  it("keeps slashes in tag names on delete", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "SUCCESS" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "tag", "delete", {
      repo_id: "my-repo",
      tag_name: "releases/v1.0",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE",
      path: "/code/api/v1/repos/my-repo/tags/releases/v1.0",
    }));
  });
});

describe("commit diff path encoding", () => {
  it("keeps slashes in diff range refs", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "commit", "diff", {
      repo_id: "my-repo",
      range: "main..feature/foo",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/diff/main..feature/foo",
    }));
  });

  it("keeps slashes in diff_stats range refs", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ files_changed: 1 });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "commit", "diff_stats", {
      repo_id: "my-repo",
      range: "origin/main..feature/foo",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/diff-stats/origin/main..feature/foo",
    }));
  });

  it("keeps slashes on both sides of a two-dot range", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "commit", "diff", {
      repo_id: "my-repo",
      range: "feature/a..feature/b",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/diff/feature/a..feature/b",
    }));
  });

  it("keeps slashes on both sides of a three-dot merge-base range", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ files_changed: 1 });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "commit", "diff_stats", {
      repo_id: "my-repo",
      range: "feature/a...feature/b",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/diff-stats/feature/a...feature/b",
    }));
  });

  it("rejects diff without a range", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "commit", "diff", { repo_id: "my-repo" }),
    ).rejects.toThrow(/range/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});
