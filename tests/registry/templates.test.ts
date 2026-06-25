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

describe("v0 template git query-param mapping", () => {
  // Regression: remote (git-backed) v0 template update previously dropped all git
  // query params, so the Harness API rejected the write with
  // "No branch provided for modifying the file." The update op must map the same
  // git params as pipelines.ts (branch/store_type/last_object_id/...).
  it("maps git params on update so branch reaches the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "tmpl" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template", "update", {
      template_id: "steptemplateremote",
      version_label: "steptemplate",
      org_id: "default",
      project_id: "revanthcstesting",
      store_type: "REMOTE",
      branch: "main",
      connector_ref: "gitconn",
      repo_name: "revanth-cr",
      file_path: ".harness/template.yaml",
      commit_msg: "update via mcp",
      last_object_id: "d88858596768b6c4717b067e885302ba50b99aa7",
      last_commit_id: "44de290e4b7c1990cb0f6f3f0e65551d3242cbe2",
      body: "template:\n  identifier: steptemplateremote\n  versionLabel: steptemplate\n",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        path: "/template/api/templates/update/steptemplateremote/steptemplate",
        params: expect.objectContaining({
          storeType: "REMOTE",
          branch: "main",
          connectorRef: "gitconn",
          repoName: "revanth-cr",
          filePath: ".harness/template.yaml",
          commitMsg: "update via mcp",
          lastObjectId: "d88858596768b6c4717b067e885302ba50b99aa7",
          lastCommitId: "44de290e4b7c1990cb0f6f3f0e65551d3242cbe2",
        }),
      }),
    );
  });

  it("maps git read params on get so a specific branch can be fetched", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "tmpl" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template", "get", {
      template_id: "steptemplateremote",
      version_label: "steptemplate",
      org_id: "default",
      project_id: "revanthcstesting",
      branch: "feature/x",
      store_type: "REMOTE",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/template/api/templates/steptemplateremote",
        params: expect.objectContaining({
          versionLabel: "steptemplate",
          branch: "feature/x",
          storeType: "REMOTE",
        }),
      }),
    );
  });

  it("maps git write params on create for remote templates", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "tmpl" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template", "create", {
      org_id: "default",
      project_id: "revanthcstesting",
      store_type: "REMOTE",
      branch: "main",
      connector_ref: "gitconn",
      repo_name: "revanth-cr",
      file_path: ".harness/template.yaml",
      is_new_branch: true,
      commit_msg: "create via mcp",
      body: "template:\n  identifier: newtmpl\n  versionLabel: v1\n",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/template/api/templates",
        params: expect.objectContaining({
          storeType: "REMOTE",
          branch: "main",
          connectorRef: "gitconn",
          repoName: "revanth-cr",
          filePath: ".harness/template.yaml",
          isNewBranch: true,
          commitMsg: "create via mcp",
        }),
      }),
    );
  });
});

describe("template_v1 global template catalog", () => {
  it("list with global=true hits /v1/templates and passes global_template=true", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template_v1", "list", {
      global: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/templates",
        params: expect.objectContaining({ global_template: true }),
      }),
    );
  });

  it("list with global=true and entity_type=Step passes entity_types filter", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template_v1", "list", {
      global: true,
      entity_type: "Step",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/templates",
        params: expect.objectContaining({
          global_template: true,
          entity_types: "Step",
        }),
      }),
    );
  });

  it("list without global uses scoped path and does not pass global_template", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template_v1", "list", {
      org_id: "default",
      project_id: "my-project",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/orgs/default/projects/my-project/templates",
      }),
    );
    const call = mockRequest.mock.calls[0][0] as { params?: Record<string, unknown> };
    expect(call.params?.global_template).toBeUndefined();
  });

  it("get with global=true passes global_template=true", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "k8sRollingDeployStep" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "template_v1", "get", {
      template_id: "k8sRollingDeployStep",
      version_label: "1.0.7",
      global: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        params: expect.objectContaining({ global_template: true }),
      }),
    );
  });
});
