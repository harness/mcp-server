/**
 * AI Code Review (aicr) toolset: review, findings, runs, reviewed PRs, and AICR repositories.
 *
 * Fixtures are trimmed from live qa0 responses (repo aicr-runs-fixtures, PR 7/8).
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { applyHeaderPagination } from "../../src/registry/pagination.js";
import { compactItems } from "../../src/utils/compact.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import { aicrToolset, resolveAicrRepoPath, aicrPrNumber } from "../../src/registry/toolsets/aicr.js";
import {
  AICR_NO_REVIEW_NOTE,
  aicrFindingCompact,
  aicrPullRequestCompact,
  aicrRepositoryCompact,
  aicrRunCompact,
} from "../../src/registry/extractors.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const ACCOUNT = "acct123";
const REPO_PATH = `${ACCOUNT}/code/DeepSourceAICR/aicr-runs-fixtures`;
const RUN_ID = "9ea0862f-d920-4fdc-9229-f2d0b5cbb179";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: ACCOUNT,
    HARNESS_BASE_URL: "https://qa0.harness.io",
    HARNESS_ORG: "ambient-org",
    HARNESS_PROJECT: "ambient-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "aicr",
    ...overrides,
  } as Config;
}

type RequestOpts = {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  onResponseHeaders?: (h: Record<string, string>) => void;
};

function makeClient(handler: (opts: RequestOpts) => unknown) {
  const request = vi.fn(async (opts: RequestOpts) => handler(opts));
  return { client: { request, account: ACCOUNT } as unknown as HarnessClient, request };
}

const SCOPE = { repo_id: "aicr-runs-fixtures", org_id: "code", project_id: "DeepSourceAICR" };
/** The repository exists in Code but has no AI Code Review config of its own. */
const noConfig = (opts: RequestOpts) => {
  if (opts.path.startsWith("/code/api/v1/repos/")) return { identifier: "aicr-runs-fixtures" };
  throw new HarnessApiError("Not Found", 404);
};

const FINDING_AI = {
  id: 304,
  run_id: RUN_ID,
  pullreq_id: 2521,
  language: "javascript",
  ordinal: 0,
  key: "dba3238f-8196-55bc-800f-32fbce840884",
  source: "ai",
  path: "js/orders.js",
  line_start: 5,
  line_end: 5,
  column_start: 1,
  column_end: 1,
  severity: "minor",
  category: "security",
  title: "Unencoded `id` interpolated into URL allows path manipulation",
  message: "Unencoded `id` interpolated into URL allows path manipulation",
  summary: "An `id` like `../admin` alters the requested endpoint.",
  text: "Use `encodeURIComponent(id)`.",
  code_snippet: "const res = await fetch(`https://api.example.com/orders/${id}`);",
  is_duplicate: false,
  metadata: { locations_of_interest: [] },
  created: 1793705013747,
  status: "open",
};
const FINDING_DISMISSED = {
  ...FINDING_AI,
  id: 305,
  key: "ceeb25a9-cf73-5b02-85b5-97a7372b2f06",
  severity: "major",
  category: "reliability",
  status: "dismissed",
  dismissal: { reason: "accepted_risk", note: "known", dismissed_by: 7, dismissed: 1793705999999 },
};
const FINDINGS = {
  run_id: RUN_ID,
  counts: { total: 2, critical: 0, major: 1, minor: 1 },
  dismissed: 1,
  findings: [FINDING_AI, FINDING_DISMISSED],
};
const EMPTY_FINDINGS = { run_id: "", counts: { total: 0, critical: 0, major: 0, minor: 0 }, dismissed: 0, findings: [] };

const RUN = {
  id: "e23ec6da-e1dc-49cd-8b4e-af026b2016c1",
  pullreq_id: 2544,
  status: "success",
  head_sha: "ccf86324f59f24a45feab869f8c232285414e140",
  merge_base_sha: "2852d808a26450241a4787be3dd10272ca39ef58",
  diff_type: "commit",
  from_run_id: "fc80f8ac-27f2-472d-ba56-1986d749f54d",
  config: {},
  languages: ["javascript", "python"],
  stats: {
    javascript: {
      status: "success", total: 27, rejected: 0, duplicates: 27, metrics: [], errors: [],
      usage: { total: { cost_usd: 0.0055, input_tokens: 9576 }, by_agent: { duplicate_issue: {} } },
    },
    python: {
      status: "success", total: 27, rejected: 0, duplicates: 27, metrics: [], errors: [],
      usage: { total: { cost_usd: 0.028 }, by_agent: {} },
    },
  },
  created: 1793706302278,
  updated: 1793706880305,
};

const REVIEW = {
  agent_run_id: "QlkhpV2ySre8kKTzl5V2EQ",
  repo_id: 294974,
  pr_number: 7,
  source_sha: "ccf86324f59f24a45feab869f8c232285414e140",
  criteria: [{ id: 1, status: "success", summary: "No secrets committed" }],
  created: 1793706302278,
};
const OVERVIEW = {
  id: 4827,
  pullreq_id: 2544,
  repo_path: REPO_PATH,
  pr_number: 7,
  commit_sha: "ccf86324f59f24a45feab869f8c232285414e140",
  content: "## Summary\nAdds order fetching.",
  risk: "medium",
  status: "success",
  metadata: { agent_run_id: "QlkhpV2ySre8kKTzl5V2EQ" },
  created_by: -1,
  created: 1793706302278,
  updated: 1793706880305,
};

function registry(overrides: Partial<Config> = {}) {
  return new Registry(makeConfig(overrides));
}

describe("aicr toolset registration", () => {
  it("is opt-in; reads are safe and every write has the risk its effect calls for", () => {
    expect(aicrToolset.optIn).toBe(true);
    const types = aicrToolset.resources.map((r) => r.resourceType);
    expect(types).toEqual(["aicr_review", "aicr_finding", "aicr_run", "aicr_pull_request", "aicr_repository", "aicr_gate", "aicr_rule", "aicr_convention", "aicr_setting"]);
    const writes: Record<string, unknown> = {};
    for (const res of aicrToolset.resources) {
      expect(res.scope).toBe("account");
      expect(res.scopeOptional).toBe(true);
      for (const [op, spec] of Object.entries(res.operations)) {
        if (spec?.operationPolicy?.risk === "read") expect(spec.operationPolicy.retryPolicy).toBe("safe");
        else writes[`${res.resourceType}.${op}`] = spec?.operationPolicy;
      }
      for (const [action, spec] of Object.entries(res.executeActions ?? {})) {
        if (spec.operationPolicy?.risk === "read") expect(spec.operationPolicy.retryPolicy).toBe("safe");
        else writes[`${res.resourceType}.${action}`] = spec.operationPolicy;
      }
    }
    expect(writes).toEqual({
      // Starts the review pipeline; a retry could start a second one.
      "aicr_review.request_review": { risk: "low_write", retryPolicy: "do_not_retry" },
      // Dismissing can let a PR pass the gate, so it needs confirmation; undo only reopens.
      "aicr_finding.dismiss": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_finding.undo_dismiss": { risk: "low_write", retryPolicy: "do_not_retry" },
      // Enabling adds a trigger (and maybe a pipeline and service account); disabling deletes the repo's config.
      "aicr_repository.enable": { risk: "high_write", retryPolicy: "do_not_retry" },
      "aicr_repository.disable": { risk: "destructive", retryPolicy: "do_not_retry" },
      // Loosening a gate lets PRs pass with findings that failed them.
      "aicr_gate.set": { risk: "medium_write", retryPolicy: "do_not_retry" },
      // A rule can fail the Team rules check on every PR under its scope; turning one off lets them pass.
      "aicr_rule.create": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_rule.update": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_rule.override": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_rule.delete": { risk: "destructive", retryPolicy: "do_not_retry" },
      // Conventions have no check, but change what every review under the scope reports.
      "aicr_convention.create": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_convention.update": { risk: "medium_write", retryPolicy: "do_not_retry" },
      "aicr_convention.delete": { risk: "destructive", retryPolicy: "do_not_retry" },
      // Paths decide what every review under the scope reads; the connector decides where the code is sent.
      "aicr_setting.set": { risk: "high_write", retryPolicy: "do_not_retry" },
    });
  });

  it("refuses a url on every write before sending anything; ids must come through params", async () => {
    // A PR URL's last id ("7") would otherwise land on finding_key / rule_id / repo_id.
    const url = `https://qa0.harness.io/ng/account/${ACCOUNT}/module/code/orgs/code/projects/DeepSourceAICR/repos/aicr-runs-fixtures/pulls/7`;
    const input = { ...SCOPE, pr_number: "7", finding_key: "k", rule_id: "3", convention_id: "4", url };
    const reg = registry();
    const { client, request } = makeClient(() => ({}));
    let writes = 0;
    for (const res of aicrToolset.resources) {
      for (const op of ["create", "update", "delete"] as const) {
        if (!res.operations[op]) continue;
        writes++;
        await expect(reg.dispatch(client, res.resourceType, op, { ...input }), `${res.resourceType}.${op}`).rejects.toThrow(/don't take a Harness URL/);
      }
      for (const [action, spec] of Object.entries(res.executeActions ?? {})) {
        if (spec.operationPolicy?.risk === "read") continue;
        writes++;
        await expect(reg.dispatchExecute(client, res.resourceType, action, { ...input }), `${res.resourceType}.${action}`).rejects.toThrow(/don't take a Harness URL/);
      }
    }
    expect(writes).toBe(14);
    expect(request).not.toHaveBeenCalled();
  });

  it("is not enabled by default and is enabled with HARNESS_TOOLSETS=aicr", () => {
    expect(() => registry({ HARNESS_TOOLSETS: undefined }).getResource("aicr_finding")).toThrow();
    expect(registry().getResource("aicr_finding").resourceType).toBe("aicr_finding");
  });
});

describe("resolveAicrRepoPath", () => {
  it("builds project, org, and account level paths from explicit scope only", () => {
    expect(resolveAicrRepoPath(SCOPE, ACCOUNT)).toBe(REPO_PATH);
    expect(resolveAicrRepoPath({ repo_id: "r", org_id: "o" }, ACCOUNT)).toBe(`${ACCOUNT}/o/r`);
    expect(resolveAicrRepoPath({ repo_id: "r" }, ACCOUNT)).toBe(`${ACCOUNT}/r`);
  });


  it("prefers an explicit repo_path", () => {
    expect(resolveAicrRepoPath({ repo_path: `/${REPO_PATH}/`, repo_id: "other" }, ACCOUNT)).toBe(REPO_PATH);
    expect(() => resolveAicrRepoPath({ repo_path: "otherAcct/o/p/r" }, ACCOUNT)).toThrow(/account "otherAcct"/);
  });

  it("rejects a missing repo, a project without an org, and a missing account", () => {
    expect(() => resolveAicrRepoPath({}, ACCOUNT)).toThrow(/repo_id/);
    expect(() => resolveAicrRepoPath({ repo_id: "r", project_id: "p" }, ACCOUNT)).toThrow(/org_id/);
    expect(() => resolveAicrRepoPath({ repo_id: "r" }, undefined)).toThrow(/account/i);
  });
});

describe("aicrPrNumber", () => {
  it("accepts positive integers as numbers or strings", () => {
    expect(aicrPrNumber({ pr_number: 7 })).toBe("7");
    expect(aicrPrNumber({ pr_number: " 12 " })).toBe("12");
  });

  it.each([[undefined], [0], [-1], ["1.5"], ["7/../../admin"], ["abc"]])("rejects %s", (value) => {
    expect(() => aicrPrNumber({ pr_number: value })).toThrow(/pr_number/);
  });
});

describe("aicr_finding.list", () => {
  it("calls the PR findings route with repo_path, 1-based page, and limit", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    const result = await registry().dispatch(client, "aicr_finding", "list", {
      ...SCOPE, pr_number: 7, page: 0, size: 20, severity: "minor,major",
    }) as Record<string, unknown>;

    const opts = request.mock.calls.at(-1)![0];
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe("/gateway/aicr/api/v1/pullreqs/7/findings");
    expect(opts.params).toMatchObject({ repo_path: REPO_PATH, page: 1, limit: 20, severity: "minor,major" });
    expect(opts.body).toBeUndefined();

    expect(result.run_id).toBe(RUN_ID);
    expect(result.counts).toEqual(FINDINGS.counts);
    expect(result.dismissed).toBe(1);
    expect(result.items).toHaveLength(2);
    expect(result.note).toBeUndefined();
    expect(result.openInHarness).toBe(
      `https://qa0.harness.io/ng/account/${ACCOUNT}/module/code/orgs/code/projects/DeepSourceAICR/repos/aicr-runs-fixtures/pulls/7`,
    );
  });

  it("does not leak ambient HARNESS_ORG / HARNESS_PROJECT into scope or repo_path", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    const result = await registry().dispatch(client, "aicr_finding", "list", { repo_id: "acct-repo", pr_number: 3 }) as Record<string, unknown>;
    expect(result.openInHarness).toBe(`https://qa0.harness.io/ng/account/${ACCOUNT}/module/code/repos/acct-repo/pulls/3`);
    const params = request.mock.calls.at(-1)![0].params ?? {};
    expect(params.repo_path).toBe(`${ACCOUNT}/acct-repo`);
    expect(params.orgIdentifier).toBeUndefined();
    expect(params.projectIdentifier).toBeUndefined();
  });

  it("uses the counts total and derives has_more when no filter is applied", async () => {
    const { client } = makeClient(() => ({ ...FINDINGS, findings: [FINDING_AI] }));
    const result = await registry().dispatch(client, "aicr_finding", "list", {
      ...SCOPE, pr_number: 7, page: 0, size: 1,
    }) as Record<string, unknown>;
    expect(result.total).toBe(2);
    expect(result.has_more).toBe(true);
  });

  it("totals a severity filter from the counts, which apply every other filter", async () => {
    const { client } = makeClient(() => ({ ...FINDINGS, findings: [FINDING_AI] }));
    const result = await registry().dispatch(client, "aicr_finding", "list", {
      ...SCOPE, pr_number: 7, severity: "major,minor", page: 0, size: 1,
    }) as Record<string, unknown>;
    expect(result.total).toBe(2);
    expect(result.has_more).toBe(true);
  });


  it("documents the backend's finding categories and canonicalizes their case", async () => {
    const category = registry().getResource("aicr_finding").listFilterFields?.find((f) => f.name === "category");
    expect(category?.enum).toEqual(["reliability", "security", "complexity", "hygiene"]);

    const { client, request } = makeClient(() => FINDINGS);
    await registry().dispatch(client, "aicr_finding", "list", { ...SCOPE, pr_number: 7, category: "Security, RELIABILITY" });
    expect(request.mock.calls.at(-1)![0].params?.category).toBe("security,reliability");
  });

  it("returns a note instead of a silent empty list when no review has completed", async () => {
    const { client } = makeClient(() => EMPTY_FINDINGS);
    const result = await registry().dispatch(client, "aicr_finding", "list", { ...SCOPE, pr_number: 99 }) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.run_id).toBe("");
    expect(result.note).toBe(AICR_NO_REVIEW_NOTE);
  });



  it("fails fast on a bad pr_number or a missing repo, before any request", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    await expect(registry().dispatch(client, "aicr_finding", "list", { ...SCOPE, pr_number: "7/../x" }))
      .rejects.toThrow(/pr_number/);
    await expect(registry().dispatch(client, "aicr_finding", "list", { pr_number: 7 }))
      .rejects.toThrow(/repo_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("lists one run's findings when run_id is given", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    const result = await registry().dispatch(client, "aicr_finding", "list", {
      ...SCOPE, run_id: RUN_ID, severity: "major",
    }) as Record<string, unknown>;
    const opts = request.mock.calls.at(-1)![0];
    expect(opts.path).toBe(`/gateway/aicr/api/v1/runs/${RUN_ID}/findings`);
    expect(opts.params).toMatchObject({ repo_path: REPO_PATH, severity: "major" });
    expect(result.run_id).toBe(RUN_ID);
    expect(result.note).toBeUndefined();
    expect(result.openInHarness).toBeUndefined();
  });

  it.each([
    ["aicr_finding", "list"], ["aicr_run", "list"], ["aicr_review", "get"],
  ])("%s %s with a typo'd repo_id says so instead of 'no review yet'", async (type, op) => {
    const { client } = makeClient((opts) => {
      if (opts.path.startsWith("/code/api/v1/repos/")) throw new HarnessApiError("Not Found", 404);
      return op === "get" ? REVIEW : FINDINGS;
    });
    await expect(registry().dispatch(client, type, op, { ...SCOPE, repo_id: "aicr-run-fixtures", pr_number: 7 }))
      .rejects.toThrow(/No repository "aicr-run-fixtures" in Harness Code with org_id="code", project_id="DeepSourceAICR"/);
  });

  it("takes a repo_path as given, without the repository check", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    await registry().dispatch(client, "aicr_finding", "list", { repo_path: REPO_PATH, pr_number: 7 });
    expect(request.mock.calls.map((c) => c[0].path)).toEqual(["/gateway/aicr/api/v1/pullreqs/7/findings"]);
  });

  it("encodes run_id and requires pr_number or run_id", async () => {
    const { client, request } = makeClient(() => FINDINGS);
    await registry().dispatch(client, "aicr_finding", "list", { ...SCOPE, run_id: "../x" });
    expect(request.mock.calls.at(-1)![0].path).toBe("/gateway/aicr/api/v1/runs/..%2Fx/findings");

    request.mockClear();
    await expect(registry().dispatch(client, "aicr_finding", "list", { ...SCOPE })).rejects.toThrow(/pr_number.*run_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("compacts findings to the fields an agent needs to fix or dismiss them", () => {
    const [ai, dismissed] = compactItems([FINDING_AI, FINDING_DISMISSED], aicrFindingCompact) as Array<Record<string, unknown>>;
    expect(Object.keys(ai).sort()).toEqual([
      "category", "column_end", "column_start", "key", "language", "line_end", "line_start",
      "path", "severity", "source", "status", "summary", "text", "title",
    ]);
    expect(dismissed.dismissal).toEqual(FINDING_DISMISSED.dismissal);
    expect(ai.code_snippet).toBeUndefined();
    expect(ai.metadata).toBeUndefined();
  });

  it("keeps a static-analysis message that adds to the title, and flags duplicates", () => {
    const sa = aicrFindingCompact({ ...FINDING_AI, source: "static_analysis", message: "x is unused", is_duplicate: true });
    expect(sa).toMatchObject({ message: "x is unused", is_duplicate: true });
    const same = aicrFindingCompact({ ...FINDING_AI, message: FINDING_AI.title, is_duplicate: false });
    expect(same).not.toHaveProperty("message");
    expect(same).not.toHaveProperty("is_duplicate");
  });
});

describe("aicr_finding dismiss / undo_dismiss", () => {
  const KEY = FINDING_AI.key;
  const DISMISSAL = { finding_key: KEY, reason: "accepted_risk", note: "Test fixture", dismissed_by: { id: 7 }, dismissed: 1793800000000 };

  it("dismisses with reason and note in the body, repo_path in the query, and no scope fields in the body", async () => {
    const { client, request } = makeClient(() => DISMISSAL);
    const result = await registry().dispatchExecute(client, "aicr_finding", "dismiss", {
      ...SCOPE, pr_number: 7, finding_key: KEY, body: { reason: "accepted_risk", note: "Test fixture" },
    });
    const opts = request.mock.calls[0][0];
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe(`/gateway/aicr/api/v1/pullreqs/7/findings/${KEY}/dismiss`);
    expect(opts.params?.repo_path).toBe(REPO_PATH);
    expect(opts.body).toEqual({ reason: "accepted_risk", note: "Test fixture" });
    expect(result).toEqual({ ...DISMISSAL, status: "dismissed" });
  });

  it("requires finding_key and reason before any request", async () => {
    const { client, request } = makeClient(() => DISMISSAL);
    await expect(registry().dispatchExecute(client, "aicr_finding", "dismiss", { ...SCOPE, pr_number: 7, body: { reason: "accepted_risk" } }))
      .rejects.toThrow(/finding_key/);
    await expect(registry().dispatchExecute(client, "aicr_finding", "dismiss", { ...SCOPE, pr_number: 7, finding_key: KEY, body: {} }))
      .rejects.toThrow(/reason/);
    expect(request).not.toHaveBeenCalled();
  });

  it("dismisses through harness_execute with the key as resource_id, keeping pr_number", async () => {
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    const tools = new Map<string, (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: Array<{ text: string }> }>>();
    const server = {
      server: {
        getClientCapabilities: () => ({ elicitation: { form: {} } }),
        elicitInput: vi.fn().mockResolvedValue({ action: "accept", content: { confirm: true } }),
      },
      registerTool: (name: string, _schema: unknown, handler: never) => { tools.set(name, handler); },
    };
    const { client, request } = makeClient(() => DISMISSAL);
    registerExecuteTool(server as never, registry(), client, makeConfig());

    const result = await tools.get("harness_execute")!({
      resource_type: "aicr_finding", action: "dismiss", org_id: "code", project_id: "DeepSourceAICR",
      params: { repo_id: "aicr-runs-fixtures", pr_number: "7" }, resource_id: KEY,
      body: { reason: "accepted_risk", note: "Test fixture" },
    }, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} });

    expect(result.isError).toBeFalsy();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].path).toBe(`/gateway/aicr/api/v1/pullreqs/7/findings/${KEY}/dismiss`);
    expect(request.mock.calls[0][0].params?.repo_path).toBe(REPO_PATH);
  });

  it("undoes without a body and reports the finding as open", async () => {
    // The client turns the 204 into a placeholder object.
    const { client, request } = makeClient(() => ({ status: "SUCCESS", message: "No content" }));
    const result = await registry().dispatchExecute(client, "aicr_finding", "undo_dismiss", { ...SCOPE, pr_number: 7, finding_key: KEY });
    const opts = request.mock.calls[0][0];
    expect(opts.path).toBe(`/gateway/aicr/api/v1/pullreqs/7/findings/${KEY}/undo`);
    expect(opts.params?.repo_path).toBe(REPO_PATH);
    expect(opts.body).toBeUndefined();
    expect(result).toEqual({ finding_key: KEY, status: "open" });
  });
});

describe("aicr_repository enable / disable", () => {
  const ONBOARDED = {
    service_account_created: false, pipeline_created: false,
    repositories: [{ repo_path: REPO_PATH, trigger_created: true, setting_enabled: true, linked_repo: false }],
  };

  it("enables through onboarding v2 with the repo's parent space and no scope fields", async () => {
    const { client, request } = makeClient(() => ONBOARDED);
    const result = await registry().dispatchExecute(client, "aicr_repository", "enable", { ...SCOPE });
    const opts = request.mock.calls[0][0];
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/gateway/aicr/api/v2/onboard");
    expect(opts.params).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR` });
    expect(opts.body).toEqual({ type: "harness_code", repositories: [{ repo_path: REPO_PATH }] });
    expect(result).toEqual({
      repo_path: REPO_PATH, enabled: true, trigger_created: true, setting_enabled: true,
      pipeline_created: false, service_account_created: false,
    });
  });

  it("fails when the backend reports the repo's own error inside a 200", async () => {
    const failed = { ...ONBOARDED, repositories: [{ repo_path: REPO_PATH, error: "repository not found" }] };
    const { client } = makeClient(() => failed);
    await expect(registry().dispatchExecute(client, "aicr_repository", "enable", { ...SCOPE })).rejects.toThrow(/repository not found/);
  });

  it("does not report a repo as enabled when its AI review setting could not be turned on", async () => {
    const partial = { ...ONBOARDED, repositories: [{ repo_path: REPO_PATH, trigger_created: true, setting_enabled: false }] };
    const { client } = makeClient(() => partial);
    const result = await registry().dispatchExecute(client, "aicr_repository", "enable", { ...SCOPE }) as Record<string, unknown>;
    expect(result.enabled).toBe(false);
    expect(result.warning).toMatch(/could not be turned on/);
  });

  it("disables by repo_path alone and reports the repo as off", async () => {
    const { client, request } = makeClient(() => ({ status: "SUCCESS", message: "No content" }));
    const result = await registry().dispatchExecute(client, "aicr_repository", "disable", { ...SCOPE });
    const opts = request.mock.calls[0][0];
    expect(opts.path).toBe("/gateway/aicr/api/v2/offboard");
    expect(opts.params).toEqual({ repo_path: REPO_PATH });
    expect(opts.body).toBeUndefined();
    expect(result).toEqual({ repo_path: REPO_PATH, enabled: false });
  });

  it("rejects an account path with no repo segment before any request", async () => {
    const { client, request } = makeClient(() => ONBOARDED);
    await expect(registry().dispatchExecute(client, "aicr_repository", "enable", { repo_path: ACCOUNT })).rejects.toThrow(/repo_path/);
    expect(request).not.toHaveBeenCalled();
  });
});

describe("aicr_gate.get", () => {
  const GATES = {
    repo_config_id: 41, provider: "harness", connector_ref: "", provider_repo: "",
    categories: [{ category: "security", reported: true, fail_at: "major_and_above", org_reported: true, org_fail_at: "critical", set_by: "repository" }],
  };

  it("reads a space's gates by space_path only", async () => {
    const { client, request } = makeClient(() => GATES);
    const result = await registry().dispatch(client, "aicr_gate", "get", { org_id: "code", project_id: "DeepSourceAICR" });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0].path).toBe("/gateway/aicr/api/v1/gates");
    expect(request.mock.calls[0][0].params).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR` });
    expect(result).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR`, categories: GATES.categories });
  });

  it("reads a repo's gates by the id of its AI Code Review config", async () => {
    const { client, request } = makeClient((opts) => (opts.path.endsWith("/config/repo") ? { id: 41 } : GATES));
    const result = await registry().dispatch(client, "aicr_gate", "get", { ...SCOPE });
    expect(request.mock.calls[0][0].params).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR`, repo_identifier: "aicr-runs-fixtures" });
    // repo_path is only for auth: with repo_config_id alone qa0 answers 401.
    expect(request.mock.calls[1][0].params).toEqual({ repo_config_id: 41, repo_path: REPO_PATH });
    expect(result).toEqual({ repo_path: REPO_PATH, categories: GATES.categories });
  });

  it("answers a repo without its own config the way the check gates it: nothing reported", async () => {
    const { client, request } = makeClient(noConfig);
    const result = await registry().dispatch(client, "aicr_gate", "get", { ...SCOPE }) as Record<string, unknown>;
    expect(request).toHaveBeenCalledTimes(2);
    expect(result.repo_path).toBe(REPO_PATH);
    expect(result.categories).toHaveLength(4);
    expect(result.categories).toContainEqual(
      { category: "security", reported: false, fail_at: "never", org_reported: false, org_fail_at: "never", set_by: "organization" },
    );
    expect(result.note).toMatch(/no AI Code Review config/);
  });

  it("names a repository that does not exist instead of reporting it as ungated", async () => {
    const { client } = makeClient(() => { throw new HarnessApiError("Not Found", 404); });
    await expect(registry().dispatch(client, "aicr_gate", "get", { ...SCOPE }))
      .rejects.toThrow(/No repository "aicr-runs-fixtures" in Harness Code/);
  });

  it.each([
    ["a denied lookup", new HarnessApiError("Forbidden", 403)],
    ["a cluster without the route", new HarnessApiError("404 page not found", 404)],
  ])("fails on %s instead of reporting the repo as ungated", async (_case, error) => {
    const { client } = makeClient(() => { throw error; });
    await expect(registry().dispatch(client, "aicr_gate", "get", { ...SCOPE })).rejects.toThrow(error.message);
  });

  const SECURITY = { category: "security", reported: true, fail_at: "critical" };

  it("sets a space's gates with only the category fields", async () => {
    const { client, request } = makeClient(() => GATES);
    const result = await registry().dispatchExecute(client, "aicr_gate", "set", {
      org_id: "code", project_id: "DeepSourceAICR", body: { categories: [{ ...SECURITY, set_by: "repository" }] },
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "PUT", path: "/gateway/aicr/api/v1/gates", params: { space_path: `${ACCOUNT}/code/DeepSourceAICR` } });
    expect(request.mock.calls[0][0].body).toEqual({ categories: [SECURITY] });
    expect(result).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR`, categories: GATES.categories });
  });

  it("sets a repo's gates by its config id", async () => {
    const { client, request } = makeClient((opts) => (opts.path.endsWith("/config/repo") ? { id: 41 } : GATES));
    await registry().dispatchExecute(client, "aicr_gate", "set", { ...SCOPE, body: { categories: [SECURITY] } });
    expect(request.mock.calls[1][0].params).toEqual({ repo_config_id: 41, repo_path: REPO_PATH });
  });

  it("refuses an entry without reported, which the server would save as off", async () => {
    const { client, request } = makeClient(() => GATES);
    await expect(registry().dispatchExecute(client, "aicr_gate", "set", {
      org_id: "code", body: { categories: [{ category: "security", fail_at: "critical" }] },
    })).rejects.toThrow(/categories\[0\] needs/);
    expect(request).not.toHaveBeenCalled();
  });

  it("sends category and fail_at in the backend's lower case, and rejects unknown values", async () => {
    const { client, request } = makeClient(() => GATES);
    await registry().dispatchExecute(client, "aicr_gate", "set", {
      org_id: "code", body: { categories: [{ category: "Security", reported: true, fail_at: "CRITICAL" }] },
    });
    expect(request.mock.calls[0][0].body).toEqual({ categories: [SECURITY] });
    await expect(registry().dispatchExecute(client, "aicr_gate", "set", {
      org_id: "code", body: { categories: [{ category: "security", reported: true, fail_at: "major" }] },
    })).rejects.toThrow(/major_and_above/);
  });
});

describe("aicr_rule", () => {
  const PROJECT = `${ACCOUNT}/code/DeepSourceAICR`;
  const RULE = {
    id: 7, space_path: PROJECT, space_config_id: 3, provider: "harness", connector_ref: "", provider_repo: "",
    title: "Log the request id", description: "", enabled: true, overridable: true, paths: ["api/**"],
    source: "human", status: "active", created_by: { uid: "u1", name: "Sawez" }, created: 1, updated: 2,
  };
  const configThen = (body: unknown) => (opts: RequestOpts) => (opts.path.endsWith("/config/repo") ? { id: 41 } : body);

  it("lists a space's rules by space_path only, and a repo's by its config id", async () => {
    const space = makeClient(() => [RULE]);
    const result = await registry().dispatch(space.client, "aicr_rule", "list", { org_id: "code", project_id: "DeepSourceAICR", status: "all" });
    expect(space.request.mock.calls[0][0].params).toMatchObject({ space_path: PROJECT, status: "all" });
    expect(space.request.mock.calls[0][0].params).not.toHaveProperty("repo_config_id");
    expect((result as { items: unknown[] }).items[0]).toEqual({
      id: 7, title: "Log the request id", enabled: true, overridable: true, paths: ["api/**"],
      source: "human", status: "active", space_path: PROJECT, created: 1, updated: 2, created_by: "Sawez",
    });

    const repo = makeClient(configThen([{ ...RULE, inherited: true, overridden_by: { ...RULE, id: 9, enabled: false } }]));
    const repoResult = await registry().dispatch(repo.client, "aicr_rule", "list", { ...SCOPE }) as { items: Record<string, unknown>[] };
    expect(repo.request.mock.calls[1][0].params).toMatchObject({ repo_config_id: 41, repo_path: REPO_PATH });
    expect(repo.request.mock.calls[1][0].params).not.toHaveProperty("space_path");
    expect(repoResult.items[0]).toMatchObject({ inherited: true, repo_override: { enabled: false } });
  });

  it("lists no rules for a repo without its own config, as prepare does", async () => {
    const { client, request } = makeClient(noConfig);
    const result = await registry().dispatch(client, "aicr_rule", "list", { ...SCOPE }) as Record<string, unknown>;
    expect(request).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ items: [], total: 0, repo_path: REPO_PATH });
  });

  it("creates with only rule fields in the body and the scope in the query", async () => {
    const { client, request } = makeClient(() => RULE);
    await registry().dispatch(client, "aicr_rule", "create", {
      org_id: "code", project_id: "DeepSourceAICR", body: { title: "Log the request id", overridable: true, org_id: "x" },
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: "/gateway/aicr/api/v1/rules", params: { space_path: PROJECT } });
    expect(request.mock.calls[0][0].body).toEqual({ title: "Log the request id", overridable: true });
  });

  it("reports where a created space rule landed, which the create response leaves out", async () => {
    const { space_path: _omitted, ...created } = RULE;
    const { client } = makeClient(() => created);
    const result = await registry().dispatch(client, "aicr_rule", "create", { org_id: "code", project_id: "DeepSourceAICR", body: { title: "t" } });
    expect(result).toMatchObject({ id: 7, space_path: PROJECT });
  });

  it("refuses to create on a repo without its own config instead of creating it elsewhere", async () => {
    const { client, request } = makeClient(noConfig);
    await expect(registry().dispatch(client, "aicr_rule", "create", { ...SCOPE, body: { title: "t" } })).rejects.toThrow(/no AI Code Review config/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("edits a rule by id only at the scope it is set on (the account when none)", async () => {
    const account = makeClient((opts) => (opts.method === "GET" ? { ...RULE, space_path: ACCOUNT } : undefined));
    await registry().dispatch(account.client, "aicr_rule", "update", { rule_id: "7", body: { enabled: false, status: "archived" } });
    expect(account.request.mock.calls[0][0]).toMatchObject({ method: "GET", path: "/gateway/aicr/api/v1/rules/7", params: { space_path: ACCOUNT } });
    expect(account.request.mock.calls[1][0]).toMatchObject({ method: "PATCH", path: "/gateway/aicr/api/v1/rules/7", params: { space_path: ACCOUNT } });
    expect(account.request.mock.calls[1][0].body).toEqual({ enabled: false, status: "archived" });

    const repo = makeClient((opts) => opts.path.endsWith("/config/repo") ? { id: 41 }
      : opts.method === "GET" ? { ...RULE, space_path: "", repo_config_id: 41 } : undefined);
    const result = await registry().dispatch(repo.client, "aicr_rule", "delete", { ...SCOPE, rule_id: "7" });
    expect(repo.request.mock.calls[2][0]).toMatchObject({ method: "DELETE", path: "/gateway/aicr/api/v1/rules/7", params: { repo_path: REPO_PATH } });
    expect(result).toEqual({ id: "7", status: "archived" });
  });

  it.each([
    ["an inherited project rule from a repo", SCOPE, RULE, /inherits it.*execute override/s],
    ["a rule of another space", { org_id: "code" }, RULE, /set on space .*DeepSourceAICR/],
    ["a repo's override row", SCOPE, { ...RULE, space_path: "", repo_config_id: 41, overrides_id: 3 }, /override/],
  ])("refuses to edit %s", async (_case, scope, row, error) => {
    const { client, request } = makeClient((opts) => (opts.path.endsWith("/config/repo") ? { id: 41 } : row));
    await expect(registry().dispatch(client, "aicr_rule", "update", { ...scope, rule_id: "7", body: { enabled: false } })).rejects.toThrow(error);
    expect(request.mock.calls.every((c) => c[0].method === "GET")).toBe(true);
  });

  it.each([
    [{ enabled: "no" }, /enabled must be true or false/],
    [{ paths: "api/**" }, /paths must be an array of strings/],
    [{ status: "deleted" }, /status must be "active" or "archived"/],
  ])("rejects a mistyped field before any request: %j", async (body, error) => {
    const { client, request } = makeClient(() => RULE);
    await expect(registry().dispatch(client, "aicr_rule", "update", { rule_id: "7", body })).rejects.toThrow(error);
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an update with nothing to change", async () => {
    const { client, request } = makeClient(() => RULE);
    await expect(registry().dispatch(client, "aicr_rule", "update", { rule_id: "7", body: {} })).rejects.toThrow(/at least one of/);
    expect(request).not.toHaveBeenCalled();
  });

  it("overrides a space rule for one repo by its config id", async () => {
    const { client, request } = makeClient(configThen({ ...RULE, id: 9, space_path: "", repo_config_id: 41, overrides_id: 7, enabled: false }));
    const result = await registry().dispatchExecute(client, "aicr_rule", "override", { ...SCOPE, rule_id: "7", body: { enabled: false } });
    expect(request.mock.calls[1][0]).toMatchObject({
      method: "PUT", path: "/gateway/aicr/api/v1/rules/7/override", params: { repo_config_id: 41, repo_path: REPO_PATH }, body: { enabled: false },
    });
    expect(result).toMatchObject({ id: 9, overrides_id: 7, enabled: false, repo_path: REPO_PATH });
  });

  it.each([
    ["without a repo", { org_id: "code", project_id: "DeepSourceAICR", rule_id: "7", body: { enabled: false } }, /one repository/],
    ["without enabled", { ...SCOPE, rule_id: "7", body: { enabled: "no" } }, /true or false/],
  ])("rejects an override %s", async (_case, input, error) => {
    const { client } = makeClient(configThen(RULE));
    await expect(registry().dispatchExecute(client, "aicr_rule", "override", input)).rejects.toThrow(error);
  });
});

describe("aicr_convention", () => {
  const PROJECT = `${ACCOUNT}/code/DeepSourceAICR`;
  const CONVENTION = {
    id: 3, space_config_id: 3, title: "Wrap errors", body: "Use fmt.Errorf with %w.", enabled: true,
    languages: ["go"], repos: [], paths: [], source: "human", status: "active", created: 1, updated: 1,
  };

  it("lists a repo's conventions by its config id", async () => {
    const { client, request } = makeClient((opts) => (opts.path.endsWith("/config/repo") ? { id: 41 } : [{ ...CONVENTION, space_path: PROJECT, inherited: true }]));
    const result = await registry().dispatch(client, "aicr_convention", "list", { ...SCOPE }) as { items: Record<string, unknown>[] };
    expect(request.mock.calls[1][0]).toMatchObject({ path: "/gateway/aicr/api/v1/conventions", params: { repo_config_id: 41, repo_path: REPO_PATH } });
    expect(result.items[0]).toMatchObject({ id: 3, body: "Use fmt.Errorf with %w.", languages: ["go"], inherited: true });
  });

  it("creates with only convention fields and reports the space it landed on", async () => {
    const { client, request } = makeClient(() => CONVENTION);
    const result = await registry().dispatch(client, "aicr_convention", "create", {
      org_id: "code", project_id: "DeepSourceAICR", body: { title: "Wrap errors", body: "Use fmt.Errorf with %w.", languages: ["go"], overridable: true },
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", params: { space_path: PROJECT } });
    expect(request.mock.calls[0][0].body).toEqual({ title: "Wrap errors", body: "Use fmt.Errorf with %w.", languages: ["go"] });
    expect(result).toMatchObject({ id: 3, space_path: PROJECT });
  });

  it("archives on delete", async () => {
    const { client, request } = makeClient((opts) => (opts.method === "GET" ? { ...CONVENTION, space_path: ACCOUNT } : undefined));
    const result = await registry().dispatch(client, "aicr_convention", "delete", { convention_id: "3" });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "DELETE", path: "/gateway/aicr/api/v1/conventions/3", params: { space_path: ACCOUNT } });
    expect(result).toEqual({ id: "3", status: "archived" });
  });
});

describe("aicr_setting", () => {
  const PROJECT = `${ACCOUNT}/code/DeepSourceAICR`;
  const MCP_SERVERS = { jira: { connector_path: "account.jira", tools: ["search"] } };
  // The project's own row (non-recursive read).
  const OWN = {
    id: 5, version: 2, space_path: PROJECT, llm_connector_ref: "account.myClaude", mcp_servers: MCP_SERVERS,
    review_triggers: { on_pr_open: true, on_push: null, drafts: null }, dismissable: null,
    paths: [{ pattern: "gen/**", type: "excluded", source: "detected" }],
    created_by: { uid: "u1", name: "Ann" }, updated_by: { uid: "u1", name: "Ann" }, created: 1, updated: 2,
  };

  it("gets a space's settings in effect, with the built-in default named", async () => {
    const { client, request } = makeClient(() => ({
      ...OWN, mcp_servers: { jira: { ...MCP_SERVERS.jira, scope: PROJECT } },
      review_triggers: { on_pr_open: true, on_push: true, drafts: false },
      review_triggers_scope: { on_pr_open: PROJECT, on_push: "", drafts: "" },
      dismissable: true, llm_connector_ref_scope: PROJECT,
      paths: [{ ...OWN.paths[0], scope: PROJECT }],
    }));
    const result = await registry().dispatch(client, "aicr_setting", "get", { org_id: "code", project_id: "DeepSourceAICR" });
    expect(request.mock.calls[0][0]).toMatchObject({ path: "/gateway/aicr/api/v1/config/space" });
    expect(request.mock.calls[0][0].params).toEqual({ space_path: PROJECT, recursive: "true" });
    expect(result).toEqual({
      space_path: PROJECT,
      llm_connector_ref: "account.myClaude", llm_connector_ref_scope: PROJECT,
      review_triggers: { on_pr_open: true, on_push: true, drafts: false },
      review_triggers_scope: { on_pr_open: PROJECT, on_push: "default", drafts: "default" },
      dismissable: true, dismissable_scope: "default",
      paths: [{ pattern: "gen/**", type: "excluded", source: "detected", scope: PROJECT }],
      updated: 2, updated_by: "Ann",
    });
  });

  it("gets a repo's settings by parent space and identifier, and notes a repo without its own config", async () => {
    const { client, request } = makeClient(() => ({ id: 0, space_path: PROJECT, repo_identifier: "aicr-runs-fixtures", paths: [] }));
    const result = await registry().dispatch(client, "aicr_setting", "get", { ...SCOPE }) as Record<string, unknown>;
    expect(request.mock.calls[0][0]).toMatchObject({ path: "/gateway/aicr/api/v1/config/repo" });
    expect(request.mock.calls[0][0].params).toEqual({ space_path: PROJECT, repo_identifier: "aicr-runs-fixtures", recursive: "true" });
    expect(result.repo_path).toBe(REPO_PATH);
    expect(result.note).toMatch(/no AI Code Review config of its own/);
  });

  it("saves a space's own row with only the change applied, keeping MCP servers, connector and path sources", async () => {
    const { client, request } = makeClient((opts) => (opts.method === "GET" ? OWN : { ...OWN, updated: 3 }));
    await registry().dispatchExecute(client, "aicr_setting", "set", {
      org_id: "code", project_id: "DeepSourceAICR",
      body: { review_triggers: { on_push: false }, add_paths: [{ pattern: "vendor/**", type: "excluded" }] },
    });
    // The own row, not the resolved one: inherited values must not be copied onto the space.
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: "/gateway/aicr/api/v1/config/space", params: { space_path: PROJECT } });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "PUT", path: "/gateway/aicr/api/v1/config/space", params: { space_path: PROJECT } });
    expect(request.mock.calls[1][0].body).toEqual({
      llm_connector_ref: "account.myClaude",
      mcp_servers: MCP_SERVERS,
      review_triggers: { on_pr_open: true, on_push: false, drafts: null },
      dismissable: null,
      paths: [{ pattern: "gen/**", type: "excluded", source: "detected" }, { pattern: "vendor/**", type: "excluded" }],
    });
  });

  it("creates a space's row from the change alone when it has none", async () => {
    const { client, request } = makeClient((opts) => {
      if (opts.method === "GET") throw new HarnessApiError("Not Found", 404);
      return {};
    });
    await registry().dispatchExecute(client, "aicr_setting", "set", { org_id: "code", body: { dismissable: false } });
    expect(request.mock.calls[1][0].body).toEqual({
      llm_connector_ref: "", mcp_servers: {},
      review_triggers: { on_pr_open: null, on_push: null, drafts: null }, dismissable: false, paths: [],
    });
  });

  it("saves a repo's row without the space-only fields, and removes one of its own paths", async () => {
    const own = { id: 41, review_triggers: { on_pr_open: null, on_push: null, drafts: null }, dismissable: false, paths: [{ pattern: "a/**", type: "tests", source: "user" }] };
    const { client, request } = makeClient(() => own);
    await registry().dispatchExecute(client, "aicr_setting", "set", {
      ...SCOPE, body: { dismissable: null, remove_paths: [{ pattern: "a/**", type: "tests" }] },
    });
    expect(request.mock.calls[1][0]).toMatchObject({
      method: "PUT", path: "/gateway/aicr/api/v1/config/repo", params: { space_path: PROJECT, repo_identifier: "aicr-runs-fixtures" },
    });
    expect(request.mock.calls[1][0].body).toEqual({ review_triggers: own.review_triggers, dismissable: null, paths: [] });
  });

  it.each([
    ["a field set does not take", { org_id: "code", body: { paths: [] } }, /does not take paths/],
    ["llm_connector_ref on a repository", { ...SCOPE, body: { llm_connector_ref: "account.x" } }, /set on a space/],
    ["a trigger that is not a boolean", { org_id: "code", body: { review_triggers: { on_push: "yes" } } }, /review_triggers takes/],
    ["a path type other than excluded or tests", { org_id: "code", body: { add_paths: [{ pattern: "vendor/**", type: "exclude" }] } }, /excluded or tests/],
  ])("refuses %s before any request", async (_case, input, error) => {
    const { client, request } = makeClient(() => OWN);
    await expect(registry().dispatchExecute(client, "aicr_setting", "set", { ...input })).rejects.toThrow(error);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    ["a repo without its own config", noConfig, { dismissable: true }, /no AI Code Review config/],
    ["removing a path the scope does not set", () => OWN, { remove_paths: [{ pattern: "docs/**", type: "excluded" }] }, /not set on/],
  ])("does not save for %s", async (_case, handler, body, error) => {
    const { client, request } = makeClient(handler);
    await expect(registry().dispatchExecute(client, "aicr_setting", "set", { ...SCOPE, body })).rejects.toThrow(error);
    expect(request.mock.calls.every((c) => c[0].method === "GET")).toBe(true);
  });
});

describe("aicr_run", () => {
  it("lists runs with repo_path and 1-based paging, and strips token/cost usage", async () => {
    const { client, request } = makeClient((opts) => {
      opts.onResponseHeaders?.({ "x-total": "3", "x-page": "1", "x-per-page": "30" });
      return [RUN];
    });
    const result = await registry().dispatch(client, "aicr_run", "list", {
      ...SCOPE, pr_number: 8, page: 0, size: 30,
    }) as Record<string, unknown>;

    const opts = request.mock.calls.at(-1)![0]; // after the repo-exists check
    expect(opts.path).toBe("/gateway/aicr/api/v1/pullreqs/8/runs");
    expect(opts.params).toMatchObject({ repo_path: REPO_PATH, page: 1, limit: 30 });

    const [run] = result.items as Array<Record<string, unknown>>;
    const stats = run.stats as Record<string, Record<string, unknown>>;
    expect(stats.javascript).toEqual({ status: "success", total: 27, rejected: 0, duplicates: 27, metrics: [], errors: [] });
    expect(JSON.stringify(result)).not.toContain("cost_usd");

    expect(result.total).toBe(3);
    expect(result.has_more).toBe(true);
    expect(result.page).toBe(0);
    expect(result.page_size).toBe(30);
  });

  it("requires pr_number for list", async () => {
    const { client } = makeClient(() => []);
    await expect(registry().dispatch(client, "aicr_run", "list", { ...SCOPE })).rejects.toThrow(/pr_number/);
  });

  it("gets a run by run_id with repo_path and without usage", async () => {
    const { client, request } = makeClient(() => RUN);
    const result = await registry().dispatch(client, "aicr_run", "get", { ...SCOPE, run_id: RUN.id }) as Record<string, unknown>;
    expect(request.mock.calls[0][0].path).toBe(`/gateway/aicr/api/v1/runs/${RUN.id}`);
    expect(request.mock.calls[0][0].params?.repo_path).toBe(REPO_PATH);
    expect(result.status).toBe("success");
    expect(JSON.stringify(result)).not.toContain("usage");
  });

  it("maps resource_id onto run_id for get", () => {
    expect(registry().getResource("aicr_run").identifierFields.at(-1)).toBe("run_id");
  });

  it("compacts runs to status, commit, and stats", () => {
    const [compact] = compactItems([{ ...RUN, stats: {} }], aicrRunCompact) as Array<Record<string, unknown>>;
    expect(compact.config).toBeUndefined();
    expect(compact.pullreq_id).toBeUndefined();
    expect(compact).toMatchObject({ id: RUN.id, status: "success", head_sha: RUN.head_sha, diff_type: "commit" });
  });
});

describe("aicr_review request_review / review_status", () => {
  const RUNNING = { id: RUN_ID, pullreq_id: 2521, status: "running", head_sha: "abc123", pipeline_ref: "exec-1", config: { x: 1 } };
  const exists = (body: unknown) => (opts: RequestOpts) =>
    opts.path.startsWith("/code/api/v1/repos/") ? { identifier: "aicr-runs-fixtures" } : body;

  it("starts a review: POST with repo_path, no body, never retried, and says how to follow it", async () => {
    const { client, request } = makeClient(exists({ pr_number: 7, status: "running", run: RUNNING }));
    const result = await registry().dispatchExecute(client, "aicr_review", "request_review", { ...SCOPE, pr_number: 7 }) as Record<string, unknown>;
    const start = request.mock.calls.map((c) => c[0]).find((o) => o.path.endsWith("/review/start"))!;
    expect(start).toMatchObject({ method: "POST", path: "/gateway/aicr/api/v1/pullreqs/7/review/start", params: { repo_path: REPO_PATH }, retryPolicy: "do_not_retry" });
    expect(start.body).toBeUndefined();
    expect(result).toMatchObject({ pr_number: 7, status: "running", run: { id: RUN_ID, status: "running", head_sha: "abc123" } });
    expect((result.run as Record<string, unknown>).config).toBeUndefined();
    expect(result.note).toMatch(/review_status/);
  });

  it("checks a typed repo exists before starting", async () => {
    const { client, request } = makeClient((opts) => {
      if (opts.path.startsWith("/code/api/v1/repos/")) throw new HarnessApiError("Not Found", 404);
      return {};
    });
    await expect(registry().dispatchExecute(client, "aicr_review", "request_review", { ...SCOPE, pr_number: 7 })).rejects.toThrow(/No repository/);
    expect(request.mock.calls.some((c) => c[0].path.endsWith("/review/start"))).toBe(false);
  });

  it("reads the status with a GET, takes a URL, and points to request_review when there is no run", async () => {
    const url = `https://qa0.harness.io/ng/account/${ACCOUNT}/module/code/orgs/code/projects/DeepSourceAICR/repos/aicr-runs-fixtures/pulls/7`;
    const { client, request } = makeClient(exists({ pr_number: 7 }));
    const result = await registry().dispatchExecute(client, "aicr_review", "review_status", { ...SCOPE, pr_number: 7, url }) as Record<string, unknown>;
    expect(request.mock.calls.at(-1)![0]).toMatchObject({ method: "GET", path: "/gateway/aicr/api/v1/pullreqs/7/review/status", params: { repo_path: REPO_PATH } });
    expect(result).toMatchObject({ pr_number: 7, status: "none" });
    expect(result.note).toMatch(/request_review/);
  });

  it("reports a failed run with its error", async () => {
    const run = { ...RUNNING, status: "error", error_message: "The review pipeline ended with status aborted." };
    const { client } = makeClient(exists({ pr_number: 7, status: "failure", run }));
    const result = await registry().dispatchExecute(client, "aicr_review", "review_status", { ...SCOPE, pr_number: 7 }) as Record<string, unknown>;
    expect(result).toMatchObject({ status: "failure", run: { status: "error", error_message: run.error_message } });
    expect(result.note).toMatch(/error_message/);
  });
});

describe("aicr_review.get", () => {
  function reviewClient(overrides: { overview?: () => unknown; findings?: () => unknown } = {}) {
    return makeClient((opts) => {
      if (opts.path.endsWith("/review")) return REVIEW;
      if (opts.path.endsWith("/overview")) return (overrides.overview ?? (() => OVERVIEW))();
      if (opts.path.endsWith("/findings")) return (overrides.findings ?? (() => FINDINGS))();
      throw new Error(`unexpected path ${opts.path}`);
    });
  }

  it("composes checks, overview, counts, and open issues from three calls", async () => {
    const { client, request } = reviewClient();
    const result = await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 7 }) as Record<string, unknown>;

    const calls = request.mock.calls.map((c) => c[0]).filter((c) => c.path.startsWith("/gateway/aicr/"));
    expect(calls.map((c) => c.path).sort()).toEqual([
      "/gateway/aicr/api/v1/pullreqs/7/findings",
      "/gateway/aicr/api/v1/pullreqs/7/overview",
      "/gateway/aicr/api/v1/pullreqs/7/review",
    ]);
    for (const c of calls) expect(c.params?.repo_path).toBe(REPO_PATH);

    expect(result.repo_path).toBe(REPO_PATH);
    expect(result.pr_number).toBe(7);
    expect(result.source_sha).toBe(REVIEW.source_sha);
    expect(result.checks).toEqual(REVIEW.criteria);
    expect(result.overview).toEqual({
      status: "success", risk: "medium", commit_sha: OVERVIEW.commit_sha,
      content: OVERVIEW.content, updated: OVERVIEW.updated,
    });
    expect(result.run_id).toBe(RUN_ID);
    expect(result.counts).toEqual(FINDINGS.counts);
    expect(result.dismissed).toBe(1);
    expect((result.open_issues as Array<{ key: string }>).map((i) => i.key)).toEqual([FINDING_AI.key]);
    expect(result.unavailable).toBeUndefined();
    expect(result.open_issues_truncated).toBeUndefined();
    expect(typeof result.openInHarness).toBe("string");
  });

  it.each([
    [{ risk: "low" }, "success"],
    [{ risk: "" }, "running"],
  ])("fills in the status of an overview row written before status existed (%o)", async (row, status) => {
    const { client } = reviewClient({ overview: () => ({ ...OVERVIEW, status: "", ...row }) });
    const result = await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 7 }) as Record<string, unknown>;
    expect((result.overview as Record<string, unknown>).status).toBe(status);
  });

  it("still returns the checks when overview is forbidden and findings fail", async () => {
    const { client } = reviewClient({
      overview: () => { throw new HarnessApiError("Forbidden", 403); },
      findings: () => { throw new HarnessApiError("Internal Server Error", 500); },
    });
    const result = await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 8 }) as Record<string, unknown>;
    expect(result.checks).toEqual(REVIEW.criteria);
    expect(result.overview).toBeUndefined();
    expect(result.open_issues).toBeUndefined();
    expect(Object.keys(result.unavailable as object).sort()).toEqual(["findings", "overview"]);
  });

  it("adds the no-review note when the PR has no completed run", async () => {
    const { client } = reviewClient({ findings: () => EMPTY_FINDINGS });
    const result = await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 9 }) as Record<string, unknown>;
    expect(result.note).toBe(AICR_NO_REVIEW_NOTE);
    expect(result.open_issues).toEqual([]);
  });

  it("asks the findings API for the maximum page size", async () => {
    const { client, request } = reviewClient();
    await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 7 });
    const findingsCall = request.mock.calls.map((c) => c[0]).find((c) => c.path.endsWith("/findings"));
    expect(findingsCall?.params).toMatchObject({ page: 1, limit: 100 });
  });

  it("flags open issues as truncated when the review has more findings than one page", async () => {
    const { client } = reviewClient({ findings: () => ({ ...FINDINGS, counts: { ...FINDINGS.counts, total: 150 } }) });
    const result = await registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 7 }) as Record<string, unknown>;
    expect(result.open_issues_truncated).toBe(true);
  });

  it("fails the call when the main review request fails", async () => {
    const { client } = makeClient((opts) => {
      if (opts.path.endsWith("/review")) throw new HarnessApiError("404 page not found", 404);
      return {};
    });
    await expect(registry().dispatch(client, "aicr_review", "get", { ...SCOPE, pr_number: 7 })).rejects.toThrow(/404/);
  });

  it("maps resource_id onto pr_number for get", () => {
    expect(registry().getResource("aicr_review").identifierFields.at(-1)).toBe("pr_number");
  });
});

const PAGE_HEADERS = { "x-total": "3", "x-page": "1", "x-per-page": "2" };

/** `GET /prs` row as the backend serializes it: state/branch/draft fields are always zero values. */
const REVIEWED_PR = {
  number: 7, title: "rules-e2e: team rules", state: "", is_draft: false, repo_id: 0,
  repo_path: REPO_PATH, author: { id: 12, uid: "sawez", display_name: "Sawez Faisal" },
  source_branch: "", target_branch: "", source_sha: "ccf86324", risk: "medium",
  created: 1793706302278, updated: 1793706880305,
};

const REPO_SETTING = {
  id: 41, version: 3, repo_path: REPO_PATH, connector_path: "", system_prompt: "Be strict.",
  mcp_servers: [{ url: "https://mcp.example.com", headers: { authorization: "secret" } }],
  criteria: [{ id: 1, title: "No secrets", enabled: true, bypassable: false }],
  has_linked_repo: false, created_by: 7, updated_by: 7, created: 1793705000000, updated: 1793706000000, source: "assigned",
};

describe("space-level lists (aicr_pull_request, aicr_repository)", () => {
  it.each([
    [{ org_id: "code", project_id: "DeepSourceAICR" }, `${ACCOUNT}/code/DeepSourceAICR`],
    [{ org_id: "code" }, `${ACCOUNT}/code`],
    [{}, ACCOUNT],
  ])("sends %o only as space_path, without orgIdentifier/projectIdentifier", async (scope, spacePath) => {
    // With projectIdentifier set, qa0 returns an empty list for a project space.
    for (const resourceType of ["aicr_pull_request", "aicr_repository"]) {
      const { client, request } = makeClient(() => []);
      await registry().dispatch(client, resourceType, "list", { ...scope });
      expect(request.mock.calls[0][0].params).toEqual({ space_path: spacePath });
    }
  });

  it("does not leak ambient HARNESS_ORG / HARNESS_PROJECT into scope params", async () => {
    const { client, request } = makeClient(() => []);
    await registry().dispatch(client, "aicr_repository", "list", {});
    expect(request.mock.calls[0][0].params).toEqual({ space_path: ACCOUNT });
  });

  it("rejects project_id without org_id before any request", async () => {
    const { client, request } = makeClient(() => []);
    await expect(registry().dispatch(client, "aicr_repository", "list", { project_id: "p" })).rejects.toThrow(/org_id/);
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an org_id that is more than one path segment", async () => {
    const { client, request } = makeClient(() => []);
    await expect(registry().dispatch(client, "aicr_repository", "list", { org_id: "code/DeepSourceAICR" }))
      .rejects.toThrow(/org_id must be a single identifier/);
    expect(request).not.toHaveBeenCalled();
  });

  it("lists reviewed PRs with title search, 1-based paging, and header totals", async () => {
    const { client, request } = makeClient((opts) => {
      opts.onResponseHeaders?.(PAGE_HEADERS);
      return [REVIEWED_PR, { ...REVIEWED_PR, number: 8 }];
    });
    const result = await registry().dispatch(client, "aicr_pull_request", "list", {
      org_id: "code", project_id: "DeepSourceAICR", query: "rules", page: 0, size: 2,
    }) as Record<string, unknown>;

    const opts = request.mock.calls[0][0];
    expect(opts.path).toBe("/gateway/aicr/api/v1/prs");
    expect(opts.params).toEqual({ space_path: `${ACCOUNT}/code/DeepSourceAICR`, query: "rules", page: 1, limit: 2 });
    expect(result).toMatchObject({ total: 3, has_more: true, page: 0, page_size: 2 });

    const [pr] = result.items as Array<Record<string, unknown>>;
    expect(pr).toEqual({
      number: 7, title: REVIEWED_PR.title, repo_path: REPO_PATH, source_sha: "ccf86324",
      author: REVIEWED_PR.author, risk: "medium", created: REVIEWED_PR.created, updated: REVIEWED_PR.updated,
    });
  });

  it("does not forward state, branch, or author filters the backend cannot apply", async () => {
    const { client, request } = makeClient(() => []);
    await registry().dispatch(client, "aicr_pull_request", "list", {
      state: "merged", source_branch: "main", author_id: 12, page: 0, size: 20,
    });
    expect(request.mock.calls[0][0].params).toEqual({ space_path: ACCOUNT, page: 1, limit: 20 });
  });

  it("compacts reviewed PRs to number, title, repo_path, risk, and author name", () => {
    const [compact] = compactItems([REVIEWED_PR], aicrPullRequestCompact) as Array<Record<string, unknown>>;
    expect(compact).toEqual({
      number: 7, title: REVIEWED_PR.title, repo_path: REPO_PATH, risk: "medium",
      updated: REVIEWED_PR.updated, author: "Sawez Faisal",
    });
  });

  it("lists AICR-enabled repositories without prompt, MCP server, or criteria config", async () => {
    const { client, request } = makeClient((opts) => {
      opts.onResponseHeaders?.({ "x-total": "1", "x-page": "1", "x-per-page": "20" });
      return [REPO_SETTING];
    });
    const result = await registry().dispatch(client, "aicr_repository", "list", {
      org_id: "code", query: "fixtures", page: 0, size: 20,
    }) as Record<string, unknown>;

    const opts = request.mock.calls[0][0];
    expect(opts.path).toBe("/gateway/aicr/api/v1/repos");
    expect(opts.params).toEqual({ space_path: `${ACCOUNT}/code`, query: "fixtures", page: 1, limit: 20 });
    expect(result.items).toEqual([{
      repo_path: REPO_PATH, source: "assigned", has_linked_repo: false,
      created: REPO_SETTING.created, updated: REPO_SETTING.updated,
    }]);
    const text = JSON.stringify(result);
    for (const leaked of ["system_prompt", "mcp_servers", "criteria", "secret"]) expect(text).not.toContain(leaked);
  });

  it("compacts repositories to repo_path, source, and update time", () => {
    const [compact] = compactItems([REPO_SETTING], aicrRepositoryCompact) as Array<Record<string, unknown>>;
    expect(compact).toEqual({ repo_path: REPO_PATH, source: "assigned", updated: REPO_SETTING.updated });
  });
});

describe("applyHeaderPagination with gitness-style headers", () => {
  it("reads x-total and converts 1-based x-page to a 0-based page", () => {
    const result = applyHeaderPagination(
      { items: [1, 2], total: 2 },
      { "x-total": "5", "x-page": "2", "x-per-page": "2" },
    ) as Record<string, unknown>;
    expect(result).toMatchObject({ total: 5, page: 1, page_size: 2, has_more: true });
  });

  it("reports the last page as complete", () => {
    const result = applyHeaderPagination(
      { items: [1], total: 1 },
      { "x-total": "5", "x-page": "3", "x-per-page": "2" },
    ) as Record<string, unknown>;
    expect(result).toMatchObject({ total: 5, page: 2, has_more: false });
  });

  it("prefers 0-based page headers when both styles are present", () => {
    const result = applyHeaderPagination(
      { items: [1], total: 1 },
      { "x-total-elements": "10", "x-page-number": "4", "x-page": "9", "x-page-size": "1" },
    ) as Record<string, unknown>;
    expect(result.page).toBe(4);
  });
});
