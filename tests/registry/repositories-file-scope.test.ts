/**
 * Regression tests for Harness Code file_content scope forwarding (#602).
 * file_content get and blame must pass orgIdentifier/projectIdentifier query params
 * so scoped repositories resolve correctly.
 */
import { describe, it, expect, vi } from "vitest";
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
    LOG_LEVEL: "info",
    HARNESS_TOOLSETS: "repositories",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("file_content scope forwarding (#602)", () => {
  it("get: forwards org_id and project_id as orgIdentifier/projectIdentifier query params", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ content: "file body" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src/index.ts",
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
    expect(call.path).toBe("/code/api/v1/repos/my-repo/content/src%2Findex.ts");
    expect(call.params.orgIdentifier).toBe("AI_Devops");
    expect(call.params.projectIdentifier).toBe("Sanity");
    expect(call.params.git_ref).toBe("main");
  });

  it("get: omits org/project query params when not provided (account-scoped repo)", async () => {
    const registry = new Registry(makeConfig({
      HARNESS_ORG: "",
      HARNESS_PROJECT: "",
    }));
    const mockRequest = vi.fn().mockResolvedValue({ content: "file body" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "account-repo",
      path: "README.md",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("blame execute: forwards org_id and project_id as orgIdentifier/projectIdentifier query params", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/index.ts",
      org_id: "AI_Devops",
      project_id: "Sanity",
      git_ref: "main",
      line_from: 1,
      line_to: 10,
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/blame/src%2Findex.ts");
    expect(call.params.orgIdentifier).toBe("AI_Devops");
    expect(call.params.projectIdentifier).toBe("Sanity");
    expect(call.params.git_ref).toBe("main");
    expect(call.params.line_from).toBe(1);
    expect(call.params.line_to).toBe(10);
  });
});
