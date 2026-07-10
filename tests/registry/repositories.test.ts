/**
 * Verifies Harness Code repositories toolset dispatch: path building, query params,
 * and scope forwarding for file content and blame APIs.
 *
 * Regression guard for #602 — file_content and blame must forward orgIdentifier /
 * projectIdentifier so Harness Code can resolve project-scoped repositories.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { repositoriesToolset } from "../../src/registry/toolsets/repositories.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = repositoriesToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in repositoriesToolset`);
  return res;
}

function getOp(type: string, op: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op as keyof typeof res.operations];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

function getExecuteAction(type: string, action: string): EndpointSpec {
  const res = findResource(type);
  const spec = res.executeActions?.[action];
  if (!spec) throw new Error(`Execute action "${action}" not found on "${type}"`);
  return spec;
}

// ---------------------------------------------------------------------------
// file_content — scope forwarding (#602)
// ---------------------------------------------------------------------------

describe("file_content scope forwarding", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
  });

  it("get: forwards orgIdentifier and projectIdentifier when org_id/project_id are provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: "hello" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src/index.ts",
      org_id: "code-org",
      project_id: "code-project",
      git_ref: "main",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/content/src%2Findex.ts");
    expect(call.params.orgIdentifier).toBe("code-org");
    expect(call.params.projectIdentifier).toBe("code-project");
    expect(call.params.git_ref).toBe("main");
  });

  it("get: omits org/project when not provided (scopeOptional, no config fallback)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ type: "file" });
    const registryNoDefaults = new Registry(
      makeConfig({
        HARNESS_TOOLSETS: "repositories",
        HARNESS_ORG: "default",
        HARNESS_PROJECT: "test-project",
      }),
    );

    await registryNoDefaults.dispatch(makeClient(mockRequest), "file_content", "get", {
      repo_id: "account-repo",
      path: "README.md",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("blame execute: forwards orgIdentifier and projectIdentifier when org_id/project_id are provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/app.ts",
      org_id: "scoped-org",
      project_id: "scoped-project",
      git_ref: "feature/scope",
      line_from: 1,
      line_to: 50,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/blame/src%2Fapp.ts");
    expect(call.params.orgIdentifier).toBe("scoped-org");
    expect(call.params.projectIdentifier).toBe("scoped-project");
    expect(call.params.git_ref).toBe("feature/scope");
    expect(call.params.line_from).toBe(1);
    expect(call.params.line_to).toBe(50);
  });

  it("blame execute: omits org/project when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });

    await registry.dispatchExecute(makeClient(mockRequest), "file_content", "blame", {
      repo_id: "account-repo",
      path: "pkg/main.go",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// file_content — toolset contract (structural guard for #602)
// ---------------------------------------------------------------------------

describe("file_content toolset contract", () => {
  it("get queryParams map org_id and project_id to Harness Code scope keys", () => {
    const spec = getOp("file_content", "get");
    expect(spec.queryParams?.org_id).toBe("orgIdentifier");
    expect(spec.queryParams?.project_id).toBe("projectIdentifier");
  });

  it("blame execute queryParams map org_id and project_id to Harness Code scope keys", () => {
    const spec = getExecuteAction("file_content", "blame");
    expect(spec.queryParams?.org_id).toBe("orgIdentifier");
    expect(spec.queryParams?.project_id).toBe("projectIdentifier");
  });

  it("is scopeOptional so config defaults are not silently injected", () => {
    const def = findResource("file_content");
    expect(def.scopeOptional).toBe(true);
    expect(def.scope).toBe("account");
  });
});
