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
});

describe("paramsSchema on pull request resources", () => {
  const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));

  it("documents repo_id for every pull_request operation and action", () => {
    const def = registry.getResource("pull_request");
    const issues: string[] = [];
    const specs = [
      ...Object.entries(def.operations),
      ...Object.entries(def.executeActions ?? {}),
    ] as [string, EndpointSpec][];

    for (const [name, spec] of specs) {
      const repoIdField = spec.paramsSchema?.fields.find((field) => field.name === "repo_id");
      if (!repoIdField) {
        issues.push(`pull_request.${name}: missing repo_id paramsSchema field`);
      } else if (!repoIdField.required) {
        issues.push(`pull_request.${name}: repo_id paramsSchema field should be required`);
      }
    }

    expect(issues, issues.join("\n")).toEqual([]);
  });

  it("documents params for nested PR resources", () => {
    const issues: string[] = [];

    for (const resourceType of ["pr_reviewer", "pr_comment", "pr_check", "pr_activity"]) {
      const def = registry.getResource(resourceType);
      const specs = [
        ...Object.entries(def.operations),
        ...Object.entries(def.executeActions ?? {}),
      ] as [string, EndpointSpec][];

      for (const [name, spec] of specs) {
        const fields = spec.paramsSchema?.fields.map((field) => field.name) ?? [];
        if (!fields.includes("repo_id") || !fields.includes("pr_number")) {
          issues.push(`${resourceType}.${name}: expected repo_id and pr_number paramsSchema fields`);
        }
      }
    }

    expect(issues, issues.join("\n")).toEqual([]);
  });

  it("documents every declared path param when paramsSchema is present", () => {
    const issues: string[] = [];

    for (const resourceType of ["pull_request", "pr_reviewer", "pr_comment", "pr_check", "pr_activity"]) {
      const def = registry.getResource(resourceType);
      const specs = [
        ...Object.entries(def.operations),
        ...Object.entries(def.executeActions ?? {}),
      ] as [string, EndpointSpec][];

      for (const [name, spec] of specs) {
        if (!spec.paramsSchema || !spec.pathParams) continue;
        const documented = new Set(spec.paramsSchema.fields.map((field) => field.name));
        for (const pathParam of Object.keys(spec.pathParams)) {
          if (!documented.has(pathParam)) {
            issues.push(`${resourceType}.${name}: paramsSchema missing path param ${pathParam}`);
          }
        }
      }
    }

    expect(issues, issues.join("\n")).toEqual([]);
  });
});

describe("repo_identifier alias for pull request repo_id", () => {
  it("accepts repo_identifier in place of repo_id for create", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 1 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "create", {
      repo_identifier: "harness-ai-agent",
      body: {
        title: "fix: redact secrets",
        source_branch: "fix/redact",
        target_branch: "main",
      },
      org_id: "PROD",
      project_id: "Data_Platform",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/harness-ai-agent/pullreq",
    }));
  });

  it("accepts repo_identifier in place of repo_id for update paths built dynamically", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { number: 7, title: "updated" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pull_request", "update", {
      repo_identifier: "harness-ai-agent",
      pr_number: "7",
      body: { title: "updated" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "PATCH",
      path: "/code/api/v1/repos/harness-ai-agent/pullreq/7",
    }));
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
