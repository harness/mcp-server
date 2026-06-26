import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import type { EndpointSpec } from "../../src/registry/types.js";

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

describe("pull_request registry mappings", () => {
  it("routes state-only updates to the Harness Code PR state endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "closed" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { state: "closed" },
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed" },
    }));
  });

  it("keeps title and description updates on the PR metadata endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, title: "Updated" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { title: "Updated" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/code/api/v1/repos/rc_tools/pullreq/42",
      body: { title: "Updated" },
    }));
  });

  it("rejects mixed state + metadata updates", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pull_request", "update", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: { state: "closed", title: "Updated title", description: "keep me" },
      }),
    ).rejects.toThrow(/Cannot combine state change with metadata fields/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("supports an explicit close execute action", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "closed" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "close", {
      repo_id: "rc_tools",
      pr_number: "42",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed" },
    }));
  });

  it("preserves explicit false merge options without injecting scope into the body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ branch_deleted: false, dry_run: false });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      org_id: "AI_Devops",
      project_id: "Sanity",
      body: {
        method: "squash",
        delete_source_branch: false,
        dry_run: false,
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/merge",
      body: {
        method: "squash",
        delete_source_branch: false,
        dry_run: false,
      },
    }));
  });

  it("accepts merge options from params/top-level input and maps aliases to API fields", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ branch_deleted: false });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      method: "merge",
      deleteSourceBranch: false,
      dryRun: false,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        method: "merge",
        delete_source_branch: false,
        dry_run: false,
      },
    }));
  });

  it("rejects conflicting merge option values between body and params/top-level input", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pull_request", "merge", {
        repo_id: "rc_tools",
        pr_number: "42",
        delete_source_branch: true,
        body: { delete_source_branch: false },
      }),
    ).rejects.toThrow(/Conflicting pull_request\.merge values/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("forwards all documented merge body fields and maps camelCase aliases", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ merged: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: {
        method: "rebase",
        sourceSha: "abc123def456",
        delete_source_branch: true,
        dryRun: true,
        dryRunRules: true,
        message: "Merge PR #42",
        title: "feat: add merge tests",
        bypassRules: true,
        bypass_message: "emergency hotfix",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        method: "rebase",
        source_sha: "abc123def456",
        delete_source_branch: true,
        dry_run: true,
        dry_run_rules: true,
        message: "Merge PR #42",
        title: "feat: add merge tests",
        bypass_rules: true,
        bypass_message: "emergency hotfix",
      },
    }));
  });

  it("preserves explicit false for bypass_rules and dry_run_rules", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ merged: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      method: "fast-forward",
      bypass_rules: false,
      dry_run_rules: false,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        method: "fast-forward",
        bypass_rules: false,
        dry_run_rules: false,
      },
    }));
  });

  it("sends an empty merge body when no merge options are provided", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ merged: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {},
    }));
    const call = mockRequest.mock.calls[0]![0] as { body?: Record<string, unknown> };
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
    expect(call.body).not.toHaveProperty("accountIdentifier");
  });

  it("allows matching merge option values in body and params without conflict", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ merged: true });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: "rc_tools",
      pr_number: "42",
      delete_source_branch: false,
      body: { delete_source_branch: false, method: "squash" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        method: "squash",
        delete_source_branch: false,
      },
    }));
  });

  it("requires repo_id for create instead of accepting repo_identifier", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 1 } });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pull_request", "create", {
        repo_identifier: "harness-ai-agent",
        body: { title: "fix: redact secrets", source_branch: "fix/redact", target_branch: "main" },
        org_id: "PROD",
        project_id: "Data_Platform",
      }),
    ).rejects.toThrow(/repo_id/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("pull_request merge action metadata", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
  const def = registry.getResource("pull_request");

  it("merge has skipScopeBodyInjection enabled", () => {
    expect(def.executeActions?.merge?.skipScopeBodyInjection).toBe(true);
  });
});

describe("paramsSchema on pull_request operations", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
  const def = registry.getResource("pull_request");

  it("every operation on pull_request has a paramsSchema with repo_id", () => {
    const issues: string[] = [];
    const allSpecs = [
      ...Object.entries(def.operations),
      ...Object.entries(def.executeActions ?? {}),
    ] as [string, EndpointSpec][];

    for (const [opName, spec] of allSpecs) {
      if (!spec.paramsSchema) {
        issues.push(`pull_request.${opName}: missing paramsSchema`);
        continue;
      }
      const hasRepoId = spec.paramsSchema.fields.some((f) => f.name === "repo_id");
      if (!hasRepoId) {
        issues.push(`pull_request.${opName}: paramsSchema missing repo_id field`);
      }
      const repoIdField = spec.paramsSchema.fields.find((f) => f.name === "repo_id");
      if (repoIdField && !repoIdField.required) {
        issues.push(`pull_request.${opName}: repo_id paramsSchema field should be required`);
      }
    }

    expect(issues, issues.join("\n")).toEqual([]);
  });

  it("paramsSchema is present on pr_reviewer, pr_comment, pr_check, pr_activity", () => {
    const issues: string[] = [];
    for (const type of ["pr_reviewer", "pr_comment", "pr_check", "pr_activity"]) {
      const d = registry.getResource(type);
      const allSpecs = [
        ...Object.entries(d.operations),
        ...Object.entries(d.executeActions ?? {}),
      ] as [string, EndpointSpec][];
      for (const [opName, spec] of allSpecs) {
        if (!spec.paramsSchema) {
          issues.push(`${type}.${opName}: missing paramsSchema`);
        }
      }
    }
    expect(issues, issues.join("\n")).toEqual([]);
  });
});

describe("pr_comment bodyBuilder translation", () => {
  it("translates line_new to line_start/line_end with line_start_new=true", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 1 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "create", {
      repo_id: "my_repo",
      pr_number: "5",
      body: {
        text: "inline comment",
        path: "main.ts",
        line_new: 8,
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my_repo/pullreq/5/comments",
      body: {
        text: "inline comment",
        path: "main.ts",
        line_start: 8,
        line_end: 8,
        line_start_new: true,
        line_end_new: true,
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    }));
  });

  it("translates line_old to line_start/line_end with line_start_new=false", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 2 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "create", {
      repo_id: "my_repo",
      pr_number: "5",
      body: {
        text: "old side comment",
        path: "removed.ts",
        line_old: 12,
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        text: "old side comment",
        path: "removed.ts",
        line_start: 12,
        line_end: 12,
        line_start_new: false,
        line_end_new: false,
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    }));
  });

  it("passes general comments through without translation", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 3 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "create", {
      repo_id: "my_repo",
      pr_number: "5",
      body: { text: "general comment" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { text: "general comment" },
    }));
  });
});
