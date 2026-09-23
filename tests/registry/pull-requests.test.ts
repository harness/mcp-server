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
      body: { state: "closed", is_draft: false },
      org_id: "AI_Devops",
      project_id: "Sanity",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed", is_draft: false },
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
      body: { is_draft: false },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed", is_draft: false },
    }));
  });

  it("rejects close without is_draft to prevent silent undraft", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pull_request", "close", {
        repo_id: "rc_tools",
        pr_number: "42",
      }),
    ).rejects.toThrow(/is_draft is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("close action preserves is_draft when provided in body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "closed" } });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pull_request", "close", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { is_draft: true },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "closed", is_draft: true },
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
        source_sha: "abc123",
        delete_source_branch: false,
        dry_run: false,
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/merge",
      body: {
        method: "squash",
        source_sha: "abc123",
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
      source_sha: "abc123",
      deleteSourceBranch: false,
      dryRun: false,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        method: "merge",
        source_sha: "abc123",
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

  it("rejects merge when source_sha is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pull_request", "merge", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: { method: "squash" },
      }),
    ).rejects.toThrow(/Missing required fields for pull_request: source_sha/);
    expect(mockRequest).not.toHaveBeenCalled();
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

  it("adds PR reviewers with the configured API method", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { reviewer_id: 123 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { reviewer_id: 123 },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PUT",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/reviewers",
      body: { reviewer_id: 123 },
    }));
  });

  it("maps reviewer_email to reviewer_id before adding the reviewer", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce([
        { id: 1642, uid: "hayagriv", email: "other@harness.io", display_name: "Other" },
        { id: 2048, uid: "xzmcoXcmTlybTSR16lKXDw", email: "gaurav.sankhla@harness.io", display_name: "Gaurav Sankhla" },
      ])
      .mockResolvedValueOnce({ reviewer_id: 2048 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "ml-infra",
      pr_number: "1502",
      org_id: "PROD",
      project_id: "Harness_Commons",
      body: { reviewer_email: "gaurav.sankhla@harness.io" },
    });

    expect(mockRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/principals",
      params: { query: "gaurav.sankhla@harness.io", type: "user", limit: 50 },
    }));
    expect(mockRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "PUT",
      path: "/code/api/v1/repos/ml-infra/pullreq/1502/reviewers",
      body: { reviewer_id: 2048 },
    }));
  });

  it("does not inject org/project into the Code reviewer body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ reviewer_id: 123 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "rc_tools",
      pr_number: "42",
      org_id: "PROD",
      project_id: "Harness_Commons",
      body: { reviewer_id: 123 },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { reviewer_id: 123 },
    }));
    const body = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(body.body).not.toHaveProperty("orgIdentifier");
    expect(body.body).not.toHaveProperty("projectIdentifier");
  });

  it("maps an account user id via email then adds the reviewer", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        status: "SUCCESS",
        data: { user: { uuid: "xzmcoXcmTlybTSR16lKXDw", email: "gaurav.sankhla@harness.io", name: "Gaurav Sankhla" } },
      })
      .mockResolvedValueOnce([
        { id: 2048, uid: "xzmcoXcmTlybTSR16lKXDw", email: "gaurav.sankhla@harness.io" },
      ])
      .mockResolvedValueOnce({ reviewer_id: 2048 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "ml-infra",
      pr_number: "1502",
      body: { reviewer_uid: "xzmcoXcmTlybTSR16lKXDw" },
    });

    expect(mockRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({
      method: "GET",
      path: "/ng/api/user/aggregate/xzmcoXcmTlybTSR16lKXDw",
    }));
    expect(mockRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/principals",
      params: { query: "gaurav.sankhla@harness.io", type: "user", limit: 50 },
    }));
    expect(mockRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({
      method: "PUT",
      body: { reviewer_id: 2048 },
    }));
  });

  it("treats a non-numeric reviewer_id string as an account user id", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        data: { user: { email: "gaurav.sankhla@harness.io" } },
      })
      .mockResolvedValueOnce([{ id: 2048, email: "gaurav.sankhla@harness.io" }])
      .mockResolvedValueOnce({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "ml-infra",
      pr_number: "1502",
      body: { reviewer_id: "xzmcoXcmTlybTSR16lKXDw" },
    });

    expect(mockRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({
      body: { reviewer_id: 2048 },
    }));
  });

  it("prefers numeric reviewer_id over reviewer_email", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_reviewer", "create", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { reviewer_id: 123, reviewer_email: "gaurav.sankhla@harness.io" },
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { reviewer_id: 123 },
    }));
  });

  it("rejects create when no reviewer identity is provided", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pr_reviewer", "create", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: {},
      }),
    ).rejects.toThrow(/reviewer_email/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects email lookup when no reviewer matches", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValueOnce([]);
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pr_reviewer", "create", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: { reviewer_email: "missing@harness.io" },
      }),
    ).rejects.toThrow(/No reviewer found/);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects submit_review when commit_sha is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: { decision: "approved" },
      }),
    ).rejects.toThrow(/Missing required fields for pr_reviewer: commit_sha/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("submits a review decision with commit_sha", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { decision: "reviewed", commit_sha: "abc123" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/reviews",
      body: { decision: "reviewed", commit_sha: "abc123" },
    }));
  });

  it("accepts submit_review fields from params/top-level input without a nested body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
      repo_id: "rc_tools",
      pr_number: "42",
      decision: "approved",
      commit_sha: "deadbeef",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/reviews",
      body: { decision: "approved", commit_sha: "deadbeef" },
    }));
  });

  it("maps commitSha alias from top-level input for submit_review", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
      repo_id: "rc_tools",
      pr_number: "42",
      decision: "changereq",
      commitSha: "cafebabe",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: { decision: "changereq", commit_sha: "cafebabe" },
    }));
  });

  it("rejects conflicting submit_review values between body and params/top-level input", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
        repo_id: "rc_tools",
        pr_number: "42",
        commit_sha: "from-params",
        body: { decision: "approved", commit_sha: "from-body" },
      }),
    ).rejects.toThrow(/Conflicting pr_reviewer\.submit_review values/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects submit_review when commit_sha is omitted and no nested body is sent", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "pr_reviewer", "submit_review", {
        repo_id: "rc_tools",
        pr_number: "42",
        decision: "approved",
      }),
    ).rejects.toThrow(/Missing required fields for pr_reviewer: commit_sha/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("pull_request list pagination and query mapping", () => {
  it("converts 0-indexed page to 1-indexed for the Code API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "list", {
      repo_id: "my-repo",
      page: 2,
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    const params = call.params as Record<string, unknown>;
    expect(params.page).toBe(3);
  });

  it("coerces string page to number before applying +1 offset", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "list", {
      repo_id: "my-repo",
      page: "2" as unknown as number,
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    const params = call.params as Record<string, unknown>;
    expect(params.page).toBe(3);
  });

  it("maps search_term to the Code API query param", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "list", {
      repo_id: "my-repo",
      search_term: "auth fix",
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    const params = call.params as Record<string, unknown>;
    expect(params.query).toBe("auth fix");
  });

  it("maps size to the Code API limit param", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "list", {
      repo_id: "my-repo",
      size: 5,
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    const params = call.params as Record<string, unknown>;
    expect(params.limit).toBe(5);
  });
});

describe("pr_activity list query mapping", () => {
  it("maps size to the Code API limit param", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_activity", "list", {
      repo_id: "my-repo",
      pr_number: "1",
      size: 10,
    });

    const call = mockRequest.mock.calls[0]![0] as Record<string, unknown>;
    const params = call.params as Record<string, unknown>;
    expect(params.limit).toBe(10);
  });
});

describe("pull_request update preserves is_draft on state changes", () => {
  it("forwards is_draft alongside state", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 42, state: "open" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_id: "rc_tools",
      pr_number: "42",
      body: { state: "open", is_draft: false },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/rc_tools/pullreq/42/state",
      body: { state: "open", is_draft: false },
    }));
  });

  it("rejects state change without is_draft to prevent silent undraft", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pull_request", "update", {
        repo_id: "rc_tools",
        pr_number: "42",
        body: { state: "closed" },
      }),
    ).rejects.toThrow(/is_draft is required/);
    expect(mockRequest).not.toHaveBeenCalled();
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

  it("documents comment_id for pr_comment update and delete", () => {
    const commentDef = registry.getResource("pr_comment");
    expect(commentDef.identifierFields).toEqual(["repo_id", "pr_number", "comment_id"]);

    for (const opName of ["update", "delete"] as const) {
      const spec = commentDef.operations[opName];
      expect(spec?.paramsSchema?.fields).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "comment_id", required: true }),
      ]));
    }
  });

  it("documents the PR activity comment-read hint without broadening activity type metadata", () => {
    const activityDef = registry.getResource("pr_activity");
    const typeField = activityDef.listFilterFields?.find((field) => field.name === "type");

    expect(typeField?.enum).toEqual([
      "comment",
      "code-comment",
      "review-submit",
      "reviewer-add",
      "reviewer-delete",
      "state-change",
      "branch-update",
      "branch-delete",
      "branch-restore",
      "merge",
      "title-change",
      "label-modify",
      "target-branch-change",
      "user-group-reviewer-add",
      "user-group-reviewer-delete",
    ]);
    expect(activityDef.diagnosticHint).toContain("type: ['comment', 'code-comment']");
  });
});

describe("pr_comment bodyBuilder translation", () => {
  it("updates comments with the required comment_id path parameter", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 123, text: "updated" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "update", {
      repo_id: "my_repo",
      pr_number: "5",
      comment_id: "123",
      body: { text: "updated" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/code/api/v1/repos/my_repo/pullreq/5/comments/123",
      body: { text: "updated" },
    }));
  });

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

  it("coerces string line_new to number for inline comments", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 4 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "create", {
      repo_id: "my_repo",
      pr_number: "5",
      body: {
        text: "string line number",
        path: "main.ts",
        line_new: "42",
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        text: "string line number",
        path: "main.ts",
        line_start: 42,
        line_end: 42,
        line_start_new: true,
        line_end_new: true,
        source_commit_sha: "abc123",
        target_commit_sha: "def456",
      },
    }));
  });

  it("coerces string line_old to number for inline comments", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { id: 5 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pr_comment", "create", {
      repo_id: "my_repo",
      pr_number: "5",
      body: {
        text: "old side string",
        path: "old.ts",
        line_old: "7",
        source_commit_sha: "abc",
        target_commit_sha: "def",
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      body: {
        text: "old side string",
        path: "old.ts",
        line_start: 7,
        line_end: 7,
        line_start_new: false,
        line_end_new: false,
        source_commit_sha: "abc",
        target_commit_sha: "def",
      },
    }));
  });
});
