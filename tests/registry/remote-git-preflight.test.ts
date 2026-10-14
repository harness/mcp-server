import { describe, expect, it, vi } from "vitest";
import {
  collectV1GitDetails,
  firstGitBoolean,
  firstGitString,
  remoteGitUpdatePreflight,
} from "../../src/registry/remote-git-preflight.js";
import type { PreflightContext } from "../../src/registry/types.js";

describe("remote-git-preflight helpers", () => {
  it("firstGitString skips empty strings and returns the first non-empty value", () => {
    expect(firstGitString("", undefined, "main", "other")).toBe("main");
    expect(firstGitString(undefined, null, "")).toBeUndefined();
  });

  it("firstGitBoolean accepts booleans and quoted string literals from agent params", () => {
    expect(firstGitBoolean(false, "true")).toBe(false);
    expect(firstGitBoolean(" true ", undefined)).toBe(true);
    expect(firstGitBoolean("FALSE")).toBe(false);
    expect(firstGitBoolean("maybe")).toBeUndefined();
  });

  it("collectV1GitDetails merges top-level params with body.git_details and alias fields", () => {
    expect(
      collectV1GitDetails({
        branch: "feature/x",
        commit_msg: "ship it",
        body: {
          git_details: {
            repo_name: "my-repo",
            object_id: "obj-sha",
            commit_id: "commit-sha",
            is_harness_code_repo: "true",
          },
        },
      }),
    ).toEqual({
      branch_name: "feature/x",
      commit_message: "ship it",
      repo_name: "my-repo",
      last_object_id: "obj-sha",
      last_commit_id: "commit-sha",
      is_harness_code_repo: true,
    });
  });

  it("collectV1GitDetails returns undefined when no git fields are present", () => {
    expect(collectV1GitDetails({ body: { name: "only metadata" } })).toBeUndefined();
  });
});

function makePreflightCtx(overrides: {
  input: Record<string, unknown>;
  getResult?: Record<string, unknown>;
  getThrows?: boolean;
}): PreflightContext {
  const dispatch = overrides.getThrows
    ? vi.fn().mockRejectedValue(new Error("get failed"))
    : vi.fn().mockResolvedValue(overrides.getResult ?? {});
  return {
    client: { account: "test-account", request: vi.fn() } as unknown as PreflightContext["client"],
    input: overrides.input,
    registry: { dispatch } as unknown as PreflightContext["registry"],
    accountId: "acct-from-session",
    signal: undefined,
  };
}

describe("remoteGitUpdatePreflight", () => {
  const preflight = remoteGitUpdatePreflight({
    resourceType: "template",
    idKeys: ["template_id", "version_label"],
    accountIdGetKey: "parent_entity_account_id",
  });

  it("skips the lookup when the caller explicitly selects INLINE storage", async () => {
    const ctx = makePreflightCtx({
      input: { template_id: "t1", version_label: "v1", store_type: "INLINE", body: "yaml" },
    });
    await preflight(ctx);
    expect(ctx.registry.dispatch).not.toHaveBeenCalled();
  });

  it("skips the lookup when the caller already supplied full remote lock context", async () => {
    const ctx = makePreflightCtx({
      input: {
        template_id: "t1",
        version_label: "v1",
        branch: "main",
        repo_name: "r",
        file_path: "f.yaml",
        last_object_id: "obj",
        last_commit_id: "cmt",
      },
    });
    await preflight(ctx);
    expect(ctx.registry.dispatch).not.toHaveBeenCalled();
  });

  it("hydrates missing git query params from a v0 template GET response", async () => {
    const input: Record<string, unknown> = {
      template_id: "remote_tpl",
      version_label: "v1",
      org_id: "org",
      project_id: "proj",
    };
    const ctx = makePreflightCtx({
      input,
      getResult: {
        storeType: "REMOTE",
        gitDetails: {
          branch: "main",
          repoName: "repo",
          filePath: ".harness/t.yaml",
          connectorRef: "account.Git",
          objectId: "aaa",
          commitId: "bbb",
          isHarnessCodeRepo: true,
        },
      },
    });

    await preflight(ctx);

    expect(ctx.registry.dispatch).toHaveBeenCalledWith(
      ctx.client,
      "template",
      "get",
      expect.objectContaining({
        template_id: "remote_tpl",
        version_label: "v1",
        parent_entity_account_id: "acct-from-session",
      }),
      undefined,
    );
    expect(input).toMatchObject({
      store_type: "REMOTE",
      branch: "main",
      repo_name: "repo",
      file_path: ".harness/t.yaml",
      connector_ref: "account.Git",
      last_object_id: "aaa",
      last_commit_id: "bbb",
      is_harness_code_repo: true,
    });
  });

  it("does not echo the caller store_type into the preflight GET input", async () => {
    const input: Record<string, unknown> = {
      template_id: "remote_tpl",
      version_label: "v1",
      store_type: "REMOTE",
    };
    const ctx = makePreflightCtx({
      input,
      getResult: { storeType: "INLINE" },
    });

    await preflight(ctx);

    const getInput = (ctx.registry.dispatch as ReturnType<typeof vi.fn>).mock.calls[0]![3] as Record<
      string,
      unknown
    >;
    expect(getInput).not.toHaveProperty("store_type");
    expect(input.last_object_id).toBeUndefined();
  });

  it("fails open when the preflight GET errors", async () => {
    const input: Record<string, unknown> = { template_id: "t1", version_label: "v1" };
    const ctx = makePreflightCtx({ input, getThrows: true });
    await expect(preflight(ctx)).resolves.toBeUndefined();
    expect(input.branch).toBeUndefined();
  });

  it("throws when a remote entity is found but lock ids cannot be resolved", async () => {
    const ctx = makePreflightCtx({
      input: { template_id: "t1", version_label: "v1" },
      getResult: {
        storeType: "REMOTE",
        gitDetails: { branch: "main", repoName: "repo" },
      },
    });

    await expect(preflight(ctx)).rejects.toThrow(/Unable to resolve Git branch and current object\/commit IDs/);
  });
});
