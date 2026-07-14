/**
 * Regression tests for Harness Code repository resources — especially file
 * content/blame scope forwarding (#602).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
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

describe("file_content registry mappings", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
  });

  it("declares org/project scope query param mappings on get", () => {
    const spec = getOp("file_content", "get");
    expect(spec.queryParams).toMatchObject({
      org_id: "orgIdentifier",
      project_id: "projectIdentifier",
      git_ref: "git_ref",
      include_commit: "include_commit",
    });
  });

  it("declares org/project scope query param mappings on blame execute", () => {
    const spec = getExecuteAction("file_content", "blame");
    expect(spec.queryParams).toMatchObject({
      org_id: "orgIdentifier",
      project_id: "projectIdentifier",
      git_ref: "git_ref",
      line_from: "line_from",
      line_to: "line_to",
    });
  });

  it("get forwards org_id and project_id as orgIdentifier/projectIdentifier query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: "print('hi')" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src/main.py",
      org_id: "AI_Devops",
      project_id: "Sanity",
      git_ref: "main",
      include_commit: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/repos/my-repo/content/src%2Fmain.py",
      params: expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
        git_ref: "main",
        include_commit: true,
      }),
    }));
  });

  it("get omits scope query params when org/project are not provided", async () => {
    const registryNoDefaults = new Registry(makeConfig({
      HARNESS_TOOLSETS: "repositories",
      HARNESS_ORG: "",
      HARNESS_PROJECT: "",
    }));
    const mockRequest = vi.fn().mockResolvedValue({ content: "README" });
    const client = makeClient(mockRequest);

    await registryNoDefaults.dispatch(client, "file_content", "get", {
      repo_id: "account-repo",
      path: "README.md",
    });

    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("blame execute forwards org_id and project_id as orgIdentifier/projectIdentifier query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ lines: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/main.py",
      org_id: "AI_Devops",
      project_id: "Sanity",
      git_ref: "main",
      line_from: 1,
      line_to: 10,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/repos/my-repo/blame/src%2Fmain.py",
      params: expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
        git_ref: "main",
        line_from: 1,
        line_to: 10,
      }),
    }));
  });

});
