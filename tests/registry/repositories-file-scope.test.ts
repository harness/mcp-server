/**
 * Regression tests for Harness Code file_content scope forwarding (#602).
 *
 * file_content get and blame must forward orgIdentifier/projectIdentifier so
 * scoped repositories resolve correctly — omitting them silently falls back to
 * account-level resolution and returns wrong or empty content.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
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
    HARNESS_AUTO_APPROVE_RISK: "none",
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

describe("file_content scope forwarding", () => {
  it("forwards orgIdentifier and projectIdentifier on file_content get", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "README.md",
      org_id: "AI_Devops",
      project_id: "Sanity",
      git_ref: "main",
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/content/README.md");
    expect(call.params.orgIdentifier).toBe("AI_Devops");
    expect(call.params.projectIdentifier).toBe("Sanity");
    expect(call.params.git_ref).toBe("main");
  });

  it("omits orgIdentifier and projectIdentifier when scope is not provided", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "account-repo",
      path: "src/index.ts",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("forwards orgIdentifier and projectIdentifier on file_content blame execute", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/app.ts",
      org_id: "AI_Devops",
      project_id: "Sanity",
      git_ref: "feature/foo",
      line_from: 10,
      line_to: 20,
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/blame/src%2Fapp.ts");
    expect(call.params.orgIdentifier).toBe("AI_Devops");
    expect(call.params.projectIdentifier).toBe("Sanity");
    expect(call.params.git_ref).toBe("feature/foo");
    expect(call.params.line_from).toBe(10);
    expect(call.params.line_to).toBe(20);
  });
});
