/**
 * Harness Code deep links must carry the repository identifier. The Code API accepts a numeric
 * repository ID as the repo ref, but the UI route `.../repos/:repoId/...` only resolves the
 * identifier, and PR responses carry only numeric repo IDs. Callers that pass the numeric ID
 * therefore need the registry to look the identifier (and scope) up before building openInHarness.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

const BASE = "https://app.harness.io/ng/account/test-account/module/code";
const ACCOUNT = "acct123";

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
    HARNESS_TOOLSETS: "pull-requests,repositories",
    ...overrides,
  };
}

type RequestOptions = { method: string; path: string };

/** Mock client that answers by `METHOD path`; an Error value rejects, an unrouted call fails the test. */
function routedClient(routes: Record<string, unknown>) {
  const request = vi.fn(async (opts: RequestOptions) => {
    const key = `${opts.method} ${opts.path}`;
    if (!(key in routes)) throw new Error(`Unrouted request: ${key}`);
    const value = routes[key];
    if (value instanceof Error) throw value;
    return value;
  });
  const client = { request, account: "test-account" } as unknown as HarnessClient;
  const calls = () => request.mock.calls.map(([opts]) => `${opts.method} ${opts.path}`);
  return { client, calls };
}

function repoRecord(path: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const segments = path.split("/");
  return {
    id: 837,
    parent_id: 12,
    identifier: segments[segments.length - 1],
    path,
    root_space_identifier: segments[0],
    ...overrides,
  };
}

/** Shape of the Code create-PR response: numeric repo IDs only, no repo identifier. */
function pullReq(number: number): Record<string, unknown> {
  return {
    number,
    root_space_identifier: ACCOUNT,
    state: "open",
    title: "Grant access",
    source_repo_id: 837,
    target_repo_id: 837,
    source_branch: "feature",
    target_branch: "main",
  };
}

const LOOKUP = "GET /code/api/v1/repos/837";

describe("Harness Code deep links with a numeric repo_id", () => {
  it("builds the PR link from the repository identifier (ticket repro)", async () => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      "POST /code/api/v1/repos/837/pullreq": pullReq(1272),
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "pull_request", "create", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
      body: { title: "Grant access", source_branch: "feature", target_branch: "main" },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/1272`,
    );
    expect(result.openInHarness).not.toContain("/repos/837/");
    expect(calls()).toEqual(["POST /code/api/v1/repos/837/pullreq", LOOKUP]);
  });

  it("does not issue an extra lookup when repo_id is already an identifier", async () => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      "POST /code/api/v1/repos/dataops-platform/pullreq": pullReq(7),
    });

    const result = (await registry.dispatch(client, "pull_request", "create", {
      repo_id: "dataops-platform",
      org_id: "PROD",
      project_id: "Data_Ops",
      body: { title: "t", source_branch: "feature", target_branch: "main" },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/7`,
    );
    expect(calls()).toEqual(["POST /code/api/v1/repos/dataops-platform/pullreq"]);
  });

  it.each([
    ["project-scoped", `${ACCOUNT}/PROD/Data_Ops/dataops-platform`, "/orgs/PROD/projects/Data_Ops/repos/dataops-platform"],
    ["org-scoped", `${ACCOUNT}/PROD/dataops-platform`, "/orgs/PROD/repos/dataops-platform"],
    ["account-scoped", `${ACCOUNT}/dataops-platform`, "/repos/dataops-platform"],
  ])("takes org/project from the repo path for %s repos when the caller passed none", async (_label, path, expected) => {
    const registry = new Registry(makeConfig({ HARNESS_ORG: undefined, HARNESS_PROJECT: undefined }));
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq/5": pullReq(5),
      [LOOKUP]: repoRecord(path),
    });

    const result = (await registry.dispatch(client, "pull_request", "get", {
      repo_id: "837",
      pr_number: "5",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(`${BASE}${expected}/pulls/5`);
  });

  it("overrides a caller-supplied scope that disagrees with where the repo lives", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq/5": pullReq(5),
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "pull_request", "get", {
      repo_id: "837",
      pr_number: "5",
      org_id: "WrongOrg",
      project_id: "WrongProject",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/5`,
    );
  });

  it("keeps the caller's scope when the repo path cannot be interpreted", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq/5": pullReq(5),
      // Path does not start with the root space, so its segments are ambiguous.
      [LOOKUP]: repoRecord("other/PROD/Data_Ops/dataops-platform", { root_space_identifier: ACCOUNT }),
    });

    const result = (await registry.dispatch(client, "pull_request", "get", {
      repo_id: "837",
      pr_number: "5",
      org_id: "CallerOrg",
      project_id: "CallerProject",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/CallerOrg/projects/CallerProject/repos/dataops-platform/pulls/5`,
    );
  });

  it("omits openInHarness but still returns the result when the lookup fails", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq/5": pullReq(5),
      [LOOKUP]: new Error("boom"),
    });

    const result = (await registry.dispatch(client, "pull_request", "get", {
      repo_id: "837",
      pr_number: "5",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as Record<string, unknown>;

    expect(result.number).toBe(5);
    expect(result).not.toHaveProperty("openInHarness");
  });

  it("omits openInHarness when the lookup returns no identifier", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq/5": pullReq(5),
      [LOOKUP]: { id: 837 },
    });

    const result = (await registry.dispatch(client, "pull_request", "get", {
      repo_id: "837",
      pr_number: "5",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as Record<string, unknown>;

    expect(result).not.toHaveProperty("openInHarness");
  });

  it("resolves a list envelope with a single lookup and links every item to the identifier", async () => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      "GET /code/api/v1/repos/837/pullreq": { items: [pullReq(1), pullReq(2), pullReq(3)] },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "pull_request", "list", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items.map((item) => item.openInHarness)).toEqual([
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/1`,
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/2`,
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/3`,
    ]);
    expect(calls().filter((call) => call === LOOKUP)).toHaveLength(1);
  });

  it("does not look the repo up for bare-array list results (no link survives serialization)", async () => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      "GET /code/api/v1/repos/837/pullreq": [pullReq(1), pullReq(2)],
    });

    const result = await registry.dispatch(client, "pull_request", "list", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
    });

    expect(Array.isArray(result)).toBe(true);
    expect(calls()).toEqual(["GET /code/api/v1/repos/837/pullreq"]);
  });

  it("omits every item link in a list when the lookup fails", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/pullreq": { items: [pullReq(1), pullReq(2)] },
      [LOOKUP]: new Error("boom"),
    });

    const result = (await registry.dispatch(client, "pull_request", "list", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items).toHaveLength(2);
    for (const item of result.items) expect(item).not.toHaveProperty("openInHarness");
  });

  it("uses the repository response directly for repository get (no extra lookup)", async () => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "repository", "get", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(`${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform`);
    expect(calls()).toEqual([LOOKUP]);
  });

  it("fixes branch get links", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/branches/main": { name: "main", commit: { sha: "abc" } },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "branch", "get", {
      repo_id: "837",
      branch_name: "main",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/files/main`,
    );
  });

  it("keeps the repo identifier on branch list items (not the branch name)", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/branches": { items: [{ name: "main" }, { name: "dev" }] },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "branch", "list", {
      repo_id: "837",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items.map((item) => item.openInHarness)).toEqual([
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/files/main`,
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/files/dev`,
    ]);
  });

  it("fixes file_content get links", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "GET /code/api/v1/repos/837/content/README.md": { type: "file", content: { data: "aGk=", encoding: "base64" } },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "837",
      path: "README.md",
      git_ref: "main",
      org_id: "PROD",
      project_id: "Data_Ops",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/files/main/~/README.md`,
    );
  });

  it("fixes links returned by execute actions and updates", async () => {
    const registry = new Registry(makeConfig());
    const { client } = routedClient({
      "POST /code/api/v1/repos/837/pullreq/9/state": { ...pullReq(9), state: "closed" },
      "PATCH /code/api/v1/repos/837/pullreq/9": { ...pullReq(9), title: "Renamed" },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });
    const expected = `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/9`;

    const closed = (await registry.dispatchExecute(client, "pull_request", "close", {
      repo_id: "837",
      pr_number: "9",
      org_id: "PROD",
      project_id: "Data_Ops",
      body: { is_draft: false },
    })) as Record<string, unknown>;
    const updated = (await registry.dispatch(client, "pull_request", "update", {
      repo_id: "837",
      pr_number: "9",
      org_id: "PROD",
      project_id: "Data_Ops",
      body: { title: "Renamed" },
    })) as Record<string, unknown>;

    expect(closed.openInHarness).toBe(expected);
    expect(updated.openInHarness).toBe(expected);
  });

  it.each([
    ["numeric repo_id", "837", true],
    ["slug repo_id", "dataops-platform", false],
  ])("links merge results (no `number` in the response) with the caller's pr_number: %s", async (_label, repoId, needsLookup) => {
    const registry = new Registry(makeConfig());
    const { client, calls } = routedClient({
      [`POST /code/api/v1/repos/${repoId}/pullreq/9/merge`]: { sha: "abc123", rule_violations: [] },
      [LOOKUP]: repoRecord(`${ACCOUNT}/PROD/Data_Ops/dataops-platform`),
    });

    const result = (await registry.dispatchExecute(client, "pull_request", "merge", {
      repo_id: repoId,
      pr_number: "9",
      org_id: "PROD",
      project_id: "Data_Ops",
      body: { source_sha: "abc123" },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      `${BASE}/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/9`,
    );
    expect(calls().includes(LOOKUP)).toBe(needsLookup);
  });
});
