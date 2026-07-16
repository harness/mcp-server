/**
 * Regression tests for Harness Code file_content scope forwarding (#602).
 * Project-scoped repositories require orgIdentifier/projectIdentifier on
 * content and blame APIs — without them the Code service cannot resolve the repo.
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

describe("file_content scope query params", () => {
  it("forwards org_id and project_id on get for project-scoped repos", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "README.md",
      git_ref: "main",
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/repos/my-repo/content/README.md",
      params: expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
        git_ref: "main",
      }),
    }));
  });

  it("omits org/project query params when scope is not provided (account-scoped repo)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "account-repo",
      path: "src/index.ts",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("forwards org_id and project_id on blame execute action", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/main.go",
      git_ref: "main",
      line_from: 1,
      line_to: 50,
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/repos/my-repo/blame/src%2Fmain.go",
      params: expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
        git_ref: "main",
        line_from: 1,
        line_to: 50,
      }),
    }));
  });

  it("uses explicit org_id/project_id over configured defaults for scoped repos", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_TOOLSETS: "repositories",
      HARNESS_ORG: "configured-org",
      HARNESS_PROJECT: "configured-project",
    }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: "data" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "scoped-repo",
      path: "pkg/app.go",
      org_id: "explicit-org",
      project_id: "explicit-project",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        orgIdentifier: "explicit-org",
        projectIdentifier: "explicit-project",
      }),
    }));
  });
});
