import { describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...ConfigSchema.parse({
      HARNESS_API_KEY: "pat.test-account.token.secret",
      HARNESS_ACCOUNT_ID: "test-account",
      HARNESS_ORG: "default",
      HARNESS_PROJECT: "test-project",
    }),
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
  it("maps git params on update so branch reaches the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const requestFn = vi.fn().mockResolvedValue({ data: { identifier: "remote_template" } });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "template", "update", {
      template_id: "remote_template",
      version_label: "v1",
      org_id: "default",
      project_id: "test-project",
      store_type: "REMOTE",
      connector_ref: "account.git_connector",
      repo_name: "template-repo",
      branch: "main",
      file_path: ".harness/remote_template.yaml",
      base_branch: "develop",
      commit_msg: "update template",
      is_new_branch: true,
      is_harness_code_repo: false,
      last_object_id: "object-sha",
      last_commit_id: "commit-sha",
      body: "template:\n  identifier: remote_template\n  versionLabel: v1\n",
    });

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        path: "/template/api/templates/update/remote_template/v1",
        params: expect.objectContaining({
          storeType: "REMOTE",
          connectorRef: "account.git_connector",
          repoName: "template-repo",
          branch: "main",
          filePath: ".harness/remote_template.yaml",
          baseBranch: "develop",
          commitMsg: "update template",
          isNewBranch: true,
          isHarnessCodeRepo: false,
          lastObjectId: "object-sha",
          lastCommitId: "commit-sha",
        }),
      }),
    );
  });

  it("maps git read params on get so a specific branch can be fetched", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const requestFn = vi.fn().mockResolvedValue({ data: { identifier: "remote_template" } });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "template", "get", {
      template_id: "remote_template",
      version_label: "v1",
      org_id: "default",
      project_id: "test-project",
      store_type: "REMOTE",
      connector_ref: "account.git_connector",
      repo_name: "template-repo",
      branch: "feature/template-edit",
    });

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/template/api/templates/remote_template",
        params: expect.objectContaining({
          versionLabel: "v1",
          storeType: "REMOTE",
          connectorRef: "account.git_connector",
          repoName: "template-repo",
          branch: "feature/template-edit",
        }),
      }),
    );
  });

  it("maps git write params on create for remote templates", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const requestFn = vi.fn().mockResolvedValue({ data: { identifier: "new_remote_template" } });
    const client = makeClient(requestFn);

    await registry.dispatch(client, "template", "create", {
      org_id: "default",
      project_id: "test-project",
      store_type: "REMOTE",
      connector_ref: "account.git_connector",
      repo_name: "template-repo",
      branch: "main",
      file_path: ".harness/new_remote_template.yaml",
      base_branch: "develop",
      commit_msg: "create template",
      is_new_branch: true,
      is_harness_code_repo: false,
      body: "template:\n  identifier: new_remote_template\n  versionLabel: v1\n",
    });

    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/template/api/templates",
        params: expect.objectContaining({
          storeType: "REMOTE",
          connectorRef: "account.git_connector",
          repoName: "template-repo",
          branch: "main",
          filePath: ".harness/new_remote_template.yaml",
          baseBranch: "develop",
          commitMsg: "create template",
          isNewBranch: true,
          isHarnessCodeRepo: false,
        }),
      }),
    );
  });
});
