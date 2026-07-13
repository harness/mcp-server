/**
 * Regression tests for Harness Code file content/blame scope forwarding (#602).
 * Project-scoped repositories require orgIdentifier and projectIdentifier query
 * params on content APIs — omitting them causes resolution failures in QA/prod.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { repositoriesToolset } from "../../src/registry/toolsets/repositories.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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
    HARNESS_TOOLSETS: "+repositories",
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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ content: "file body" }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = repositoriesToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in repositoriesToolset`);
  return res;
}

function getOperation(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

describe("file_content endpoint scope queryParams (#602)", () => {
  it("get declares org_id and project_id in queryParams", () => {
    const spec = getOperation("file_content", "get");
    expect(spec.queryParams).toMatchObject({
      org_id: "orgIdentifier",
      project_id: "projectIdentifier",
      git_ref: "git_ref",
    });
  });

  it("blame execute action declares org_id and project_id in queryParams", () => {
    const blameAction = findResource("file_content").executeActions?.blame;
    expect(blameAction).toBeDefined();
    expect(blameAction!.queryParams).toMatchObject({
      org_id: "orgIdentifier",
      project_id: "projectIdentifier",
      git_ref: "git_ref",
    });
  });
});

describe("file_content dispatch scope forwarding (#602)", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get forwards orgIdentifier and projectIdentifier for scoped repos", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      org_id: "code_org",
      project_id: "code_project",
      repo_id: "my-repo",
      path: "README.md",
      git_ref: "main",
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/content/README.md");
    expect(call.params.orgIdentifier).toBe("code_org");
    expect(call.params.projectIdentifier).toBe("code_project");
    expect(call.params.git_ref).toBe("main");
  });

  it("blame execute forwards orgIdentifier and projectIdentifier for scoped repos", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      org_id: "code_org",
      project_id: "code_project",
      repo_id: "my-repo",
      path: "src/app.ts",
      git_ref: "main",
      line_from: 1,
      line_to: 10,
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/blame/src%2Fapp.ts");
    expect(call.params.orgIdentifier).toBe("code_org");
    expect(call.params.projectIdentifier).toBe("code_project");
    expect(call.params.git_ref).toBe("main");
    expect(call.params.line_from).toBe(1);
    expect(call.params.line_to).toBe(10);
  });

  it("get omits org/project query params when caller does not supply scope (scopeOptional)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "account-repo",
      path: "README.md",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });
});
