import { describe, it, expect, vi } from "vitest";
import {
  collectV1GitDetails,
  firstGitBoolean,
  firstGitString,
  remoteGitUpdatePreflight,
} from "../../src/registry/remote-git-preflight.js";
import type { PreflightContext } from "../../src/registry/types.js";

describe("firstGitString", () => {
  it("returns the first non-empty string", () => {
    expect(firstGitString("", undefined, "main", "other")).toBe("main");
  });

  it("returns undefined when every value is empty or non-string", () => {
    expect(firstGitString("", null, 42)).toBeUndefined();
  });
});

describe("firstGitBoolean", () => {
  it("accepts booleans and quoted boolean strings from JSON params", () => {
    expect(firstGitBoolean(false, "true")).toBe(false);
    expect(firstGitBoolean(" false ")).toBe(false);
    expect(firstGitBoolean("TRUE")).toBe(true);
  });

  it("returns undefined when no boolean-like value is present", () => {
    expect(firstGitBoolean("yes", 1)).toBeUndefined();
  });
});

describe("collectV1GitDetails", () => {
  it("merges v0 param aliases and GET response field names into git_details", () => {
    const details = collectV1GitDetails({
      branch: "main",
      commit_msg: "sync",
      last_object_id: "obj-sha",
      last_commit_id: "commit-sha",
      body: {
        git_details: {
          repo_name: "harness-ci-templates",
          file_path: ".harness/pipeline.yaml",
          connector_ref: "account.GitHub",
          is_harness_code_repo: "true",
        },
      },
    });

    expect(details).toEqual({
      branch_name: "main",
      repo_name: "harness-ci-templates",
      file_path: ".harness/pipeline.yaml",
      connector_ref: "account.GitHub",
      commit_message: "sync",
      last_object_id: "obj-sha",
      last_commit_id: "commit-sha",
      is_harness_code_repo: true,
    });
  });

  it("returns undefined when no Git fields are present", () => {
    expect(collectV1GitDetails({ body: {} })).toBeUndefined();
  });
});

function makePreflightCtx(
  input: Record<string, unknown>,
  getResponse: unknown,
  dispatchError?: Error,
): PreflightContext {
  const dispatch = dispatchError
    ? vi.fn().mockRejectedValue(dispatchError)
    : vi.fn().mockResolvedValue(getResponse);
  return {
    client: {} as PreflightContext["client"],
    input,
    registry: { dispatch } as unknown as PreflightContext["registry"],
    signal: undefined,
    accountId: "acct-1",
  };
}

describe("remoteGitUpdatePreflight", () => {
  const preflight = remoteGitUpdatePreflight({
    resourceType: "pipeline_v1",
    idKeys: ["pipeline_id"],
    getDefaults: { load_from_fallback_branch: true },
    accountIdGetKey: "account_id",
    copyNameTo: "name",
  });

  it("skips the lookup when the caller explicitly selects INLINE storage", async () => {
    const ctx = makePreflightCtx({ store_type: "INLINE", pipeline_id: "p1" }, {});
    await preflight(ctx);
    expect((ctx.registry as { dispatch: ReturnType<typeof vi.fn> }).dispatch).not.toHaveBeenCalled();
  });

  it("skips the lookup when the update already carries a complete remote lock", async () => {
    const ctx = makePreflightCtx({
      pipeline_id: "p1",
      branch_name: "main",
      repo_name: "repo",
      file_path: "path.yaml",
      last_object_id: "obj",
      last_commit_id: "commit",
    }, {});
    await preflight(ctx);
    expect((ctx.registry as { dispatch: ReturnType<typeof vi.fn> }).dispatch).not.toHaveBeenCalled();
  });

  it("hydrates missing Git fields from a pipeline GET response", async () => {
    const input: Record<string, unknown> = { pipeline_id: "ci", org_id: "o", project_id: "p" };
    const ctx = makePreflightCtx(input, {
      git_details: {
        branch_name: "main",
        repo_name: "repo",
        file_path: ".harness/ci.yaml",
        object_id: "obj-1",
        commit_id: "cmt-1",
        connector_ref: "account.git",
        is_harness_code_repo: true,
      },
      store_type: "REMOTE",
      name: "CI",
    });

    await preflight(ctx);

    expect((ctx.registry as { dispatch: ReturnType<typeof vi.fn> }).dispatch).toHaveBeenCalledWith(
      expect.anything(),
      "pipeline_v1",
      "get",
      expect.objectContaining({
        pipeline_id: "ci",
        org_id: "o",
        project_id: "p",
        account_id: "acct-1",
        load_from_fallback_branch: true,
      }),
      undefined,
    );
    expect(input).toMatchObject({
      store_type: "REMOTE",
      branch: "main",
      repo_name: "repo",
      file_path: ".harness/ci.yaml",
      last_object_id: "obj-1",
      last_commit_id: "cmt-1",
      connector_ref: "account.git",
      is_harness_code_repo: true,
      name: "CI",
    });
  });

  it("reads git metadata from a v1 template GET wrapper", async () => {
    const templatePreflight = remoteGitUpdatePreflight({
      resourceType: "template_v1",
      idKeys: ["template_id", "version_label"],
      copyNameTo: "name",
    });
    const input: Record<string, unknown> = {
      template_id: "tmpl",
      version_label: "v1",
    };
    const ctx = makePreflightCtx(input, {
      template: {
        name: "Template",
        store_type: "REMOTE",
        git_details: {
          branch: "develop",
          repoName: "templates",
          filePath: ".harness/tmpl.yaml",
          objectId: "oid",
          commitId: "cid",
          connectorRef: "org.git",
        },
      },
    });

    await templatePreflight(ctx);

    expect(input).toMatchObject({
      store_type: "REMOTE",
      branch: "develop",
      repo_name: "templates",
      file_path: ".harness/tmpl.yaml",
      last_object_id: "oid",
      last_commit_id: "cid",
      connector_ref: "org.git",
      name: "Template",
    });
  });

  it("does not block the write when the preflight GET fails", async () => {
    const input: Record<string, unknown> = { pipeline_id: "ci" };
    const ctx = makePreflightCtx(input, {}, new Error("not found"));
    await preflight(ctx);
    expect(input.branch).toBeUndefined();
  });

  it("throws when remote metadata is present but lock ids cannot be resolved", async () => {
    const input: Record<string, unknown> = { pipeline_id: "ci" };
    const ctx = makePreflightCtx(input, {
      store_type: "REMOTE",
      git_details: { branch_name: "main", repo_name: "repo" },
    });
    await expect(preflight(ctx)).rejects.toThrow(/Unable to resolve Git branch and current object\/commit IDs/);
  });
});
