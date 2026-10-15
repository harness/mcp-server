import { describe, expect, it, vi } from "vitest";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import {
  collectV1GitDetails,
  firstGitBoolean,
  firstGitString,
  remoteGitUpdatePreflight,
} from "../../src/registry/remote-git-preflight.js";

describe("remote-git-preflight helpers", () => {
  it("firstGitString skips empty strings and returns the first non-empty value", () => {
    expect(firstGitString("", undefined, "main", "feature")).toBe("main");
    expect(firstGitString(null, 0, false)).toBeUndefined();
  });

  it("firstGitBoolean accepts quoted boolean strings from agent params", () => {
    expect(firstGitBoolean("true")).toBe(true);
    expect(firstGitBoolean(" FALSE ")).toBe(false);
    expect(firstGitBoolean("maybe")).toBeUndefined();
  });

  it("collectV1GitDetails merges top-level params with body.git_details aliases", () => {
    const details = collectV1GitDetails({
      branch: "develop",
      commit_msg: "fix pipeline",
      last_object_id: "obj-sha",
      body: {
        git_details: {
          repo_name: "pipelines",
          commit_id: "commit-sha",
          is_harness_code_repo: "true",
        },
      },
    });

    expect(details).toEqual({
      branch_name: "develop",
      repo_name: "pipelines",
      commit_message: "fix pipeline",
      last_object_id: "obj-sha",
      last_commit_id: "commit-sha",
      is_harness_code_repo: true,
    });
  });
});

describe("remoteGitUpdatePreflight", () => {
  const preflight = remoteGitUpdatePreflight({
    resourceType: "template_v1",
    idKeys: ["template_id", "version_label"],
    getDefaults: { include_yaml: true },
    copyNameTo: "name",
  });

  it("no-ops when the caller already supplied full remote lock context", async () => {
    const dispatch = vi.fn();
    const registry = { dispatch } as unknown as Registry;
    const input: Record<string, unknown> = {
      template_id: "t1",
      version_label: "v1",
      branch: "main",
      repo_name: "repo",
      file_path: "path.yaml",
      last_object_id: "obj",
      last_commit_id: "commit",
    };

    await preflight({
      client: {} as HarnessClient,
      input,
      registry,
      signal: undefined,
      accountId: "acct",
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it("hydrates missing Git fields from a remote template GET", async () => {
    const dispatch = vi.fn().mockResolvedValue({
      template: {
        name: "My Template",
        store_type: "REMOTE",
        connector_ref: "account.git",
        git_details: {
          branch_name: "main",
          repo_name: "templates",
          file_path: ".harness/t.yaml",
          object_id: "blob-id",
          commit_id: "commit-id",
        },
      },
    });
    const registry = { dispatch } as unknown as Registry;
    const input: Record<string, unknown> = {
      template_id: "t1",
      version_label: "v1",
      org_id: "org",
      project_id: "proj",
      body: { template_yaml: "version: 1\ntemplate:\n  step: {}\n" },
    };

    await preflight({
      client: {} as HarnessClient,
      input,
      registry,
      signal: undefined,
      accountId: "acct",
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.anything(),
      "template_v1",
      "get",
      expect.objectContaining({
        template_id: "t1",
        version_label: "v1",
        include_yaml: true,
      }),
      undefined,
    );
    expect(input).toMatchObject({
      store_type: "REMOTE",
      branch: "main",
      repo_name: "templates",
      file_path: ".harness/t.yaml",
      connector_ref: "account.git",
      last_object_id: "blob-id",
      last_commit_id: "commit-id",
      name: "My Template",
    });
  });

  it("does not block when preflight GET fails (inline updates still proceed)", async () => {
    const dispatch = vi.fn().mockRejectedValue(new Error("not found"));
    const registry = { dispatch } as unknown as Registry;
    const input: Record<string, unknown> = {
      template_id: "t1",
      version_label: "v1",
      store_type: "INLINE",
      body: {},
    };

    await expect(
      preflight({
        client: {} as HarnessClient,
        input,
        registry,
        signal: undefined,
        accountId: "acct",
      }),
    ).resolves.toBeUndefined();
  });

  it("throws a actionable error when remote metadata cannot be resolved to lock ids", async () => {
    const dispatch = vi.fn().mockResolvedValue({
      template: { store_type: "REMOTE", git_details: { branch_name: "main" } },
    });
    const registry = { dispatch } as unknown as Registry;
    const input: Record<string, unknown> = {
      template_id: "t1",
      version_label: "v1",
    };

    await expect(
      preflight({
        client: {} as HarnessClient,
        input,
        registry,
        signal: undefined,
        accountId: "acct",
      }),
    ).rejects.toThrow(/Unable to resolve Git branch and current object\/commit IDs/);
  });
});
