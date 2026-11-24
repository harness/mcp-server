/**
 * CCM asset governance (cost_governance_*): request shapes, response projections and the
 * safety rules around live execution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { requiresConfirmation } from "../../src/registry/types.js";
import { resolveConfirmNote } from "../../src/utils/confirm-note.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import {
  ccmGovernanceAlertGetExtract,
  ccmGovernanceEnqueueExtract,
  ccmGovernanceEvaluationGetExtract,
  ccmGovernanceEvaluationListExtract,
  ccmGovernanceExecutionDetailsExtract,
  ccmGovernanceOverviewSeriesExtract,
  ccmGovernanceOverviewValueExtract,
  ccmGovernanceRuleListExtract,
  ccmGovernanceRuleSetFirstExtract,
  ccmGovernanceStringListExtract,
  ccmGovernanceTargetListExtract,
  ccmGovernanceWriteExtract,
} from "../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_TOOLSETS: "ccm",
    ...overrides,
  };
}

function makeClient(response: unknown = { status: "SUCCESS", data: {} }) {
  const request = vi.fn().mockResolvedValue(response);
  return { client: { request, account: "test-account" } as unknown as HarnessClient, request };
}

const GOV = "/ccm/api/governance";

/** The registry adds an `openInHarness` deep link to object results; drop it so shapes compare exactly. */
function bare<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (key, v) => (key === "openInHarness" ? undefined : v))) as T;
}
const ENQUEUE_OK = { status: "SUCCESS", data: { ruleExecutionId: ["exec-1", "exec-2"] } };

describe("cost_governance registration", () => {
  const registry = new Registry(makeConfig());
  const types = [
    "cost_governance_rule",
    "cost_governance_rule_set",
    "cost_governance_enforcement",
    "cost_governance_enforcement_recommendation",
    "cost_governance_recommendation",
    "cost_governance_evaluation",
    "cost_governance_alert",
    "cost_governance_overview",
  ];

  it("registers all eight resource types in the ccm toolset, account scoped", () => {
    for (const t of types) {
      const def = registry.getResource(t);
      expect(def.toolset, t).toBe("ccm");
      expect(def.scope, t).toBe("account");
    }
  });

  it("does not collide with the OPA `governance` toolset", () => {
    expect(registry.getAllResourceTypes()).not.toContain("cost_governance");
    expect(registry.getResource("cost_governance_rule").toolset).not.toBe("governance");
  });

  it("classifies execution risk: dry_run medium_write, run high_write, both need confirmation", () => {
    const actions = registry.getResource("cost_governance_rule").executeActions!;
    expect(actions.dry_run.operationPolicy.risk).toBe("medium_write");
    expect(actions.run.operationPolicy.risk).toBe("high_write");
    expect(requiresConfirmation(actions.dry_run.operationPolicy.risk)).toBe(true);
    expect(requiresConfirmation(actions.run.operationPolicy.risk)).toBe(true);
    expect(actions.validate.operationPolicy.risk).toBe("read");
  });

  it("classifies enforcement and other writes", () => {
    const enforcement = registry.getResource("cost_governance_enforcement");
    expect(enforcement.operations.create!.operationPolicy.risk).toBe("high_write");
    expect(enforcement.operations.update!.operationPolicy.risk).toBe("high_write");
    expect(enforcement.executeActions!.enable.operationPolicy.risk).toBe("high_write");
    expect(enforcement.executeActions!.disable.operationPolicy.risk).toBe("medium_write");
    expect(enforcement.operations.delete!.operationPolicy.risk).toBe("destructive");
    expect(registry.getResource("cost_governance_rule").operations.create!.operationPolicy.risk).toBe("low_write");
    expect(registry.getResource("cost_governance_rule").operations.delete!.operationPolicy.risk).toBe("destructive");
    expect(registry.getResource("cost_governance_enforcement_recommendation").executeActions!.accept.operationPolicy.risk).toBe("high_write");
    expect(registry.getResource("cost_governance_alert").operations.create!.operationPolicy.risk).toBe("low_write");
  });

  it("keeps read-only resources read-only", () => {
    for (const t of ["cost_governance_evaluation", "cost_governance_overview", "cost_governance_recommendation"]) {
      const def = registry.getResource(t);
      for (const spec of Object.values(def.operations)) expect(spec.operationPolicy.risk, t).toBe("read");
    }
  });
});

describe("rule: list / get / write bodies", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list sends the ListDTO `query` filter with explicit paging and strips YAML from the rows", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: {
        totalItems: 57,
        rules: [
          {
            uuid: "r1",
            name: "ec2-idle",
            description: "x".repeat(400),
            cloudProvider: "AWS",
            resourceType: "aws.ec2",
            isOOTB: true,
            savings: 30,
            rulesYaml: "policies: []",
            subRulePolicyDetails: [{ big: true }],
          },
        ],
      },
    });
    const result = (await registry.dispatch(client, "cost_governance_rule", "list", {
      search_term: " ec2 ",
      cloud_provider: "aws",
      is_ootb: "true",
      page: 1,
      size: 10,
    })) as { items: Record<string, unknown>[]; total: number };

    const call = request.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(`${GOV}/rule/list`);
    expect(call.body).toEqual({ query: { cloudProvider: "AWS", search: "ec2", isOOTB: true, limit: 10, offset: 10 } });
    expect(result.total).toBe(57);
    expect(result.items[0]).toMatchObject({ id: "r1", name: "ec2-idle", savingsPercent: 30, isOOTB: true });
    expect(result.items[0]).not.toHaveProperty("rulesYaml");
    expect(result.items[0]).not.toHaveProperty("subRulePolicyDetails");
    expect(String(result.items[0]!.description).length).toBeLessThanOrEqual(301);
  });

  it("list always sends a bounded limit, even with no filters", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { totalItems: 0, rules: [] } });
    await registry.dispatch(client, "cost_governance_rule", "list", {});
    expect(request.mock.calls[0][0].body).toEqual({ query: { limit: 20, offset: 0 } });
    await registry.dispatch(client, "cost_governance_rule", "list", { limit: 9999 });
    expect(request.mock.calls[1][0].body.query.limit).toBe(100);
  });

  it("get returns the full rule including YAML", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "r1", rulesYaml: "policies: []" } });
    const result = await registry.dispatch(client, "cost_governance_rule", "get", { rule_id: "r1" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: `${GOV}/rule/r1` });
    expect(bare(result)).toEqual({ uuid: "r1", rulesYaml: "policies: []" });
  });

  it("create wraps in { rule } and strips fields the caller must not set", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "new", name: "n" } });
    await registry.dispatch(client, "cost_governance_rule", "create", {
      body: {
        name: "n",
        cloudProvider: "AWS",
        rulesYaml: "policies: []",
        accountId: "other-account",
        isOOTB: true,
        uuid: "forced",
        forRecommendation: true,
      },
    });
    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "POST", path: `${GOV}/rule` });
    expect(call.body).toEqual({ rule: { name: "n", cloudProvider: "AWS", rulesYaml: "policies: []" } });
  });

  it("create tolerates an already wrapped body and reports missing required fields", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: {} });
    await registry.dispatch(client, "cost_governance_rule", "create", {
      body: { rule: { name: "n", cloudProvider: "GCP", rulesYaml: "y" } },
    });
    expect(request.mock.calls[0][0].body).toEqual({ rule: { name: "n", cloudProvider: "GCP", rulesYaml: "y" } });
    await expect(
      registry.dispatch(client, "cost_governance_rule", "create", { body: { name: "n" } }),
    ).rejects.toThrow(/Missing required fields.*cloudProvider.*rulesYaml/);
  });

  it("update fills uuid from resource id and uses PUT", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "r1" } });
    await registry.dispatch(client, "cost_governance_rule", "update", {
      rule_id: "r1",
      body: { name: "n", cloudProvider: "AWS", rulesYaml: "y", isOOTB: true },
    });
    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "PUT", path: `${GOV}/rule` });
    expect(call.body).toEqual({ rule: { uuid: "r1", name: "n", cloudProvider: "AWS", rulesYaml: "y" } });
  });

  it("delete wraps the boolean so the write tool gets an object", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: true });
    const result = await registry.dispatch(client, "cost_governance_rule", "delete", { rule_id: "r1" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "DELETE", path: `${GOV}/rule/r1` });
    expect(bare(result)).toEqual({ success: true });
  });
});

describe("rule: dry_run / run safety", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("dry_run sends isDryRun:true to enqueueAdhocV2", async () => {
    const { client, request } = makeClient(ENQUEUE_OK);
    const result = (await registry.dispatchExecute(client, "cost_governance_rule", "dry_run", {
      rule_id: "r1",
      target_accounts: "111, 222",
      target_regions: ["us-east-1"],
    })) as { evaluationIds: string[]; count: number; status: string };

    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "POST", path: `${GOV}/enqueueAdhocV2` });
    expect(call.body).toEqual({ ruleId: "r1", targetAccounts: ["111", "222"], targetRegions: ["us-east-1"], isDryRun: true });
    expect(result).toMatchObject({ status: "ENQUEUED", evaluationIds: ["exec-1", "exec-2"], count: 2 });
  });

  it("run sends isDryRun:false explicitly (never null)", async () => {
    const { client, request } = makeClient(ENQUEUE_OK);
    await registry.dispatchExecute(client, "cost_governance_rule", "run", {
      rule_id: "r1",
      target_accounts: ["111"],
      target_regions: ["us-east-1"],
    });
    expect(request.mock.calls[0][0].body.isDryRun).toBe(false);
  });

  it("ignores a caller-supplied isDryRun / is_dry_run on both actions", async () => {
    const { client, request } = makeClient(ENQUEUE_OK);
    await registry.dispatchExecute(client, "cost_governance_rule", "dry_run", {
      rule_id: "r1",
      target_accounts: ["111"],
      is_dry_run: false,
      body: { isDryRun: false },
    });
    await registry.dispatchExecute(client, "cost_governance_rule", "run", {
      rule_id: "r1",
      target_accounts: ["111"],
      is_dry_run: true,
      body: { isDryRun: true },
    });
    expect(request.mock.calls[0][0].body.isDryRun).toBe(true);
    expect(request.mock.calls[1][0].body.isDryRun).toBe(false);
  });

  it("accepts targets in the body and omits empty regions", async () => {
    const { client, request } = makeClient(ENQUEUE_OK);
    await registry.dispatchExecute(client, "cost_governance_rule", "dry_run", {
      rule_id: "r1",
      body: { targetAccounts: ["p1"] },
    });
    expect(request.mock.calls[0][0].body).toEqual({ ruleId: "r1", targetAccounts: ["p1"], isDryRun: true });
  });

  it("refuses to send without target accounts or a rule id (no request is made)", async () => {
    const { client, request } = makeClient(ENQUEUE_OK);
    await expect(
      registry.dispatchExecute(client, "cost_governance_rule", "run", { rule_id: "r1" }),
    ).rejects.toThrow(/target_accounts is required/);
    await expect(
      registry.dispatchExecute(client, "cost_governance_rule", "run", { target_accounts: ["1"] }),
    ).rejects.toThrow(/rule_id is required/);
    expect(request).not.toHaveBeenCalled();
  });

  it("the approval prompt says LIVE for run and read-only for dry_run, and names the targets", () => {
    const actions = registry.getResource("cost_governance_rule").executeActions!;
    const input = { rule_id: "r1", target_accounts: ["111"], target_regions: ["eu-west-1"] };
    const live = resolveConfirmNote(actions.run, input) ?? "";
    const dry = resolveConfirmNote(actions.dry_run, input) ?? "";
    expect(live).toMatch(/LIVE RUN/);
    expect(live).toContain("111");
    expect(live).toContain("eu-west-1");
    expect(dry).toMatch(/DRY RUN/);
    expect(dry).toMatch(/no resources are changed/i);
  });

  it("is blocked in read-only mode, while validate still works", async () => {
    const ro = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const { client, request } = makeClient();
    for (const action of ["dry_run", "run"]) {
      await expect(
        ro.dispatchExecute(client, "cost_governance_rule", action, { rule_id: "r1", target_accounts: ["1"] }),
      ).rejects.toThrow(/Read-only mode/);
    }
    expect(request).not.toHaveBeenCalled();
    const validated = await ro.dispatchExecute(client, "cost_governance_rule", "validate", {
      body: { rulesYaml: "policies: []", cloudProvider: "AWS" },
    });
    expect(bare(validated)).toEqual({ valid: true });
  });

  it("validate sends the YAML wrapped as { rule } and never the caller's account fields", async () => {
    const { client, request } = makeClient(undefined);
    request.mockResolvedValue(undefined);
    await registry.dispatchExecute(client, "cost_governance_rule", "validate", {
      body: { rulesYaml: "policies: []", cloudProvider: "AWS", accountId: "x" },
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/ruleValidate` });
    expect(request.mock.calls[0][0].body).toEqual({ rule: { rulesYaml: "policies: []", cloudProvider: "AWS" } });
  });

  it("clone, toggles and discovery actions hit the right endpoints", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "copy" } });
    await registry.dispatchExecute(client, "cost_governance_rule", "clone", { rule_id: "r1" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/ruleClone` });
    expect(request.mock.calls[0][0].body).toEqual({ ruleClone: { uuid: "r1" } });

    await registry.dispatchExecute(client, "cost_governance_rule", "enable_recommendation", {
      rule_id: "r1",
      cloud_account_ids: "a, b",
    });
    const enable = request.mock.calls[1][0];
    expect(enable).toMatchObject({ method: "PUT", path: `${GOV}/rule/toggleForRecommendation` });
    expect(enable.params).toMatchObject({ ruleId: "r1", enableRuleForRecommendation: "true" });
    expect(enable.body).toEqual({ cloudAccountIds: ["a", "b"] });

    await registry.dispatchExecute(client, "cost_governance_rule", "disable_recommendation", { rule_id: "r1" });
    expect(request.mock.calls[2][0].params).toMatchObject({ ruleId: "r1", enableRuleForRecommendation: "false" });
  });

  it("targets defaults to the dry-run permission set and requires cloud_provider", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { "111": "prod", "222": "dev" } });
    const result = await registry.dispatchExecute(client, "cost_governance_rule", "targets", { cloud_provider: "aws" });
    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "GET", path: `${GOV}/governanceTargetList` });
    expect(call.params).toMatchObject({ cloudProvider: ["AWS"], isDryRun: "true" });
    expect(bare(result)).toEqual({ items: [{ id: "111", name: "prod" }, { id: "222", name: "dev" }], total: 2 });
    await expect(registry.dispatchExecute(client, "cost_governance_rule", "regions", {})).rejects.toThrow(/cloud_provider/);
  });

  it("last_evaluation posts a list of rule ids", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: [{ uuid: "e1", ruleIdentifier: "r1" }] });
    const result = (await registry.dispatchExecute(client, "cost_governance_rule", "last_evaluation", {
      rule_id: "r1",
    })) as { items: Record<string, unknown>[] };
    expect(request.mock.calls[0][0].body).toEqual(["r1"]);
    expect(result.items[0]).toMatchObject({ id: "e1", ruleId: "r1" });
  });
});

describe("rule set", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list sends the `ruleSet` filter and returns ruleCount instead of every rule id", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: { totalItems: 1, ruleSet: [{ uuid: "s1", name: "pack", cloudProvider: "AWS", rulesIdentifier: ["a", "b", "c"] }] },
    });
    const result = (await registry.dispatch(client, "cost_governance_rule_set", "list", { cloud_provider: "AWS", rule_id: "a,b" })) as {
      items: Record<string, unknown>[];
    };
    expect(request.mock.calls[0][0].body).toEqual({ ruleSet: { cloudProvider: "AWS", ruleIds: ["a", "b"], limit: 20, offset: 0 } });
    expect(result.items[0]).toMatchObject({ id: "s1", ruleCount: 3 });
    expect(result.items[0]).not.toHaveProperty("rulesIdentifier");
  });

  it("get filters the list by id and 404s when nothing matches", async () => {
    const found = makeClient({ status: "SUCCESS", data: { ruleSet: [{ uuid: "s1", rulesIdentifier: ["a"] }] } });
    const result = await registry.dispatch(found.client, "cost_governance_rule_set", "get", { rule_set_id: "s1" });
    expect(found.request.mock.calls[0][0].body).toEqual({ ruleSet: { ruleSetIds: ["s1"], limit: 1, offset: 0 } });
    expect(bare(result)).toEqual({ uuid: "s1", rulesIdentifier: ["a"] });

    const none = makeClient({ status: "SUCCESS", data: { ruleSet: [], totalItems: 0 } });
    await expect(registry.dispatch(none.client, "cost_governance_rule_set", "get", { rule_set_id: "nope" })).rejects.toThrow(/not found/);
  });

  it("create and update wrap in { ruleSet }", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "s1" } });
    await registry.dispatch(client, "cost_governance_rule_set", "create", {
      body: { name: "p", cloudProvider: "AWS", rulesIdentifier: ["a"], accountId: "x" },
    });
    expect(request.mock.calls[0][0].body).toEqual({ ruleSet: { name: "p", cloudProvider: "AWS", rulesIdentifier: ["a"] } });
    await registry.dispatch(client, "cost_governance_rule_set", "update", {
      rule_set_id: "s1",
      body: { name: "p", rulesIdentifier: ["a", "b"] },
    });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "PUT", path: `${GOV}/ruleSet` });
    expect(request.mock.calls[1][0].body).toEqual({ ruleSet: { uuid: "s1", name: "p", rulesIdentifier: ["a", "b"] } });
  });
});

describe("enforcement", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  const definition = {
    name: "nightly",
    cloudProvider: "AWS",
    ruleIds: ["r1"],
    executionSchedule: "0 2 * * *",
    executionTimezone: "UTC",
    targetAccounts: ["111"],
    targetRegions: ["us-east-1"],
  };

  it("create defaults isDryRun to true and strips platform-only fields", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "e1" } });
    await registry.dispatch(client, "cost_governance_enforcement", "create", {
      body: {
        ...definition,
        isGeneratedByAI: true,
        ruleEnforcementType: "INTERNAL",
        ruleEnforcementRecommendationIdentifier: "rec",
        savings: 99,
        accountId: "x",
      },
    });
    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "POST", path: `${GOV}/enforcement` });
    expect(call.body).toEqual({ ruleEnforcement: { ...definition, isDryRun: true } });
  });

  it("create keeps an explicit isDryRun:false and says LIVE in the approval note", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: {} });
    await registry.dispatch(client, "cost_governance_enforcement", "create", { body: { ...definition, isDryRun: false } });
    expect(request.mock.calls[0][0].body.ruleEnforcement.isDryRun).toBe(false);

    const create = registry.getResource("cost_governance_enforcement").operations.create!;
    expect(resolveConfirmNote(create, { body: { ...definition, isDryRun: false } })).toMatch(/LIVE enforcement/);
    expect(resolveConfirmNote(create, { body: definition })).toMatch(/Dry-run enforcement/);
  });

  it("update requires an explicit boolean isDryRun and fills uuid from resource id", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: {} });
    await expect(
      registry.dispatch(client, "cost_governance_enforcement", "update", { enforcement_id: "e1", body: definition }),
    ).rejects.toThrow(/isDryRun is required on update/);
    expect(request).not.toHaveBeenCalled();

    await registry.dispatch(client, "cost_governance_enforcement", "update", {
      enforcement_id: "e1",
      body: { ...definition, isDryRun: false },
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "PUT", path: `${GOV}/enforcement` });
    expect(request.mock.calls[0][0].body).toEqual({ ruleEnforcement: { ...definition, uuid: "e1", isDryRun: false } });
  });

  it("list posts a bare filter with 0-based pageNumber and keeps update-ready fields", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: { totalItems: 1, ruleEnforcements: [{ uuid: "e1", ...definition, isDryRun: true, isEnabled: true, isGeneratedByAI: true, accountId: "a" }] },
    });
    const result = (await registry.dispatch(client, "cost_governance_enforcement", "list", {
      is_enabled: "true",
      page: 2,
      size: 5,
    })) as { items: Record<string, unknown>[] };
    expect(request.mock.calls[0][0].body).toEqual({ isEnabled: true, pageNumber: 2, pageSize: 5 });
    expect(result.items[0]).toMatchObject({ id: "e1", ruleIds: ["r1"], targetAccounts: ["111"], isDryRun: true });
    expect(result.items[0]).not.toHaveProperty("isGeneratedByAI");
    expect(result.items[0]).not.toHaveProperty("accountId");
  });

  it("enable / disable send an explicit enableEnforcement value (never the default false by accident)", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: true });
    await registry.dispatchExecute(client, "cost_governance_enforcement", "enable", { enforcement_id: "e1" });
    await registry.dispatchExecute(client, "cost_governance_enforcement", "disable", { enforcement_id: "e1" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "PUT", path: `${GOV}/enforcement/toggle` });
    expect(request.mock.calls[0][0].params).toMatchObject({ enforcementId: "e1", enableEnforcement: "true" });
    expect(request.mock.calls[1][0].params).toMatchObject({ enforcementId: "e1", enableEnforcement: "false" });
  });

  it("get reads the details endpoint by enforcementId; delete uses the path id", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { enforcementName: "nightly" } });
    const result = await registry.dispatch(client, "cost_governance_enforcement", "get", { enforcement_id: "e1" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: `${GOV}/enforcement/details` });
    expect(request.mock.calls[0][0].params).toMatchObject({ enforcementId: "e1" });
    expect(bare(result)).toEqual({ enforcementName: "nightly" });
    await registry.dispatch(client, "cost_governance_enforcement", "delete", { enforcement_id: "e1" });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "DELETE", path: `${GOV}/enforcement/e1` });
  });

  it("savings posts a time-filter list", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { AWS: 12.5 } });
    const result = await registry.dispatchExecute(client, "cost_governance_enforcement", "savings", {
      enforcement_id: "e1",
      start_time: "2026-11-01",
      end_time: "2026-11-07",
    });
    expect(request.mock.calls[0][0].body).toEqual([
      { operator: "AFTER", timestamp: Date.UTC(2026, 10, 1) },
      { operator: "BEFORE", timestamp: Date.UTC(2026, 10, 8) - 1 },
    ]);
    expect(bare(result)).toEqual({ AWS: 12.5 });
  });
});

describe("enforcement recommendation", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("accept and dismiss take one or many ids as repeated query values", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: ["e1"] });
    const accepted = await registry.dispatchExecute(client, "cost_governance_enforcement_recommendation", "accept", {
      enforcement_recommendation_id: "rec1",
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "PUT", path: `${GOV}/enforcementRecommendation/accept` });
    expect(request.mock.calls[0][0].params.enforcementRecommendationIds).toEqual(["rec1"]);
    expect(accepted).toEqual({ items: ["e1"] });

    await registry.dispatchExecute(client, "cost_governance_enforcement_recommendation", "dismiss", {
      enforcement_recommendation_ids: "rec1, rec2",
    });
    expect(request.mock.calls[1][0].params.enforcementRecommendationIds).toEqual(["rec1", "rec2"]);
  });

  it("list and get use the dedicated endpoints", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: { totalItems: 1, ruleEnforcementRecommendations: [{ uuid: "rec1", name: "n", ruleIds: ["r1"] }] },
    });
    const result = (await registry.dispatch(client, "cost_governance_enforcement_recommendation", "list", {})) as { items: unknown[] };
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/enforcementRecommendation/list` });
    expect(result.items[0]).toMatchObject({ id: "rec1" });
    await registry.dispatch(client, "cost_governance_enforcement_recommendation", "get", { enforcement_recommendation_id: "rec1" });
    expect(request.mock.calls[1][0].params).toMatchObject({ enforcementRecommendationId: "rec1" });
  });
});

describe("evaluation", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-23T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("list defaults to newest-first over the last 30 days and sends a bounded page", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: {
        totalItems: 1,
        ruleExecution: [
          {
            uuid: "e1",
            ruleIdentifier: "r1",
            ruleName: "idle",
            executionStatus: "SUCCESS",
            isDryRun: true,
            resourceCount: 3,
            cost: 120.5,
            savings: 60,
            resourceBreakdownList: [{ big: 1 }],
            subRuleExecutionDetails: [{ big: 1 }],
            errorMessage: "e".repeat(900),
          },
        ],
      },
    });
    const result = (await registry.dispatch(client, "cost_governance_evaluation", "list", {
      rule_id: "r1",
      execution_status: "failed",
      is_dry_run: false,
      has_resources: true,
      cloud_provider: "aws",
    })) as { items: Record<string, unknown>[]; total: number };

    const call = request.mock.calls[0][0];
    expect(call).toMatchObject({ method: "POST", path: `${GOV}/execution/list` });
    const end = Date.parse("2026-11-23T00:00:00Z");
    expect(call.body).toEqual({
      policyExecutionFilter: {
        ruleIds: ["r1"],
        executionStatus: "FAILED",
        cloudProviders: ["AWS"],
        isDryRun: false,
        resourceCountGreaterThanZero: true,
        ruleExecutionSortType: "LAST_UPDATED_AT",
        sortOrder: "DESCENDING",
        time: [
          { operator: "AFTER", timestamp: end - 30 * 86_400_000 },
          { operator: "BEFORE", timestamp: end },
        ],
        limit: 20,
        offset: 0,
      },
    });
    expect(result.items[0]).toMatchObject({ id: "e1", ruleId: "r1", executionStatus: "SUCCESS", cost: 120.5, savings: 60 });
    expect(result.items[0]).not.toHaveProperty("resourceBreakdownList");
    expect(result.items[0]).not.toHaveProperty("subRuleExecutionDetails");
    expect(String(result.items[0]!.errorMessage).length).toBeLessThanOrEqual(501);
  });

  it("list honours an explicit window and rejects a half-open or unknown one", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { ruleExecution: [] } });
    await registry.dispatch(client, "cost_governance_evaluation", "list", { time_filter: "LAST_7_DAYS" });
    const end = Date.parse("2026-11-23T00:00:00Z");
    expect(request.mock.calls[0][0].body.policyExecutionFilter.time[0].timestamp).toBe(end - 7 * 86_400_000);

    await registry.dispatch(client, "cost_governance_evaluation", "list", { start_time: "2026-11-01", end_time: "2026-11-02" });
    expect(request.mock.calls[1][0].body.policyExecutionFilter.time).toEqual([
      { operator: "AFTER", timestamp: Date.UTC(2026, 10, 1) },
      { operator: "BEFORE", timestamp: Date.UTC(2026, 10, 3) - 1 },
    ]);

    await expect(
      registry.dispatch(client, "cost_governance_evaluation", "list", { start_time: "2026-11-01" }),
    ).rejects.toThrow(/start_time and end_time must be provided together/);
    await expect(
      registry.dispatch(client, "cost_governance_evaluation", "list", { time_filter: "LAST_YEAR" }),
    ).rejects.toThrow(/Invalid time_filter/);
  });

  it("get passes executionType through when given and caps the per-resource arrays", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: i }));
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: { uuid: "e1", ruleIdentifier: "r1", executionStatus: "ENQUEUED", resourceBreakdownList: many },
    });
    const result = (await registry.dispatch(client, "cost_governance_evaluation", "get", {
      evaluation_id: "e1",
      execution_type: "INTERNAL",
    })) as Record<string, unknown>;
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: `${GOV}/execution/e1` });
    expect(request.mock.calls[0][0].params).toMatchObject({ executionType: "INTERNAL" });
    expect(result).toMatchObject({ id: "e1", executionStatus: "ENQUEUED", resourceBreakdownTotal: 40, resourceBreakdownListTruncated: true });
    expect((result.resourceBreakdownList as unknown[]).length).toBe(25);
  });

  it("resources / logs / actioned_resources / rule_yaml hit their own endpoints", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: [{ policyName: "p", status: "SUCCESS", response: "[]" }] });
    const paths: Record<string, string> = {
      resources: `${GOV}/status/e1`,
      logs: `${GOV}/logs/e1`,
      actioned_resources: `${GOV}/actionedResources/e1`,
      rule_yaml: `${GOV}/ruleYaml/e1`,
    };
    for (const [action, path] of Object.entries(paths)) {
      request.mockClear();
      const result = await registry.dispatchExecute(client, "cost_governance_evaluation", action, { evaluation_id: "e1" });
      expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path });
      expect(result).toMatchObject({ total: 1, truncated: false });
    }
  });

  it("refresh_cost is a low_write action", async () => {
    const def = registry.getResource("cost_governance_evaluation");
    expect(def.executeActions!.refresh_cost.operationPolicy.risk).toBe("low_write");
    const { client } = makeClient({ status: "SUCCESS", data: "Cost refreshed" });
    expect(bare(await registry.dispatchExecute(client, "cost_governance_evaluation", "refresh_cost", { evaluation_id: "e1" }))).toEqual({
      message: "Cost refreshed",
    });
  });
});

describe("alert", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  const alerts = {
    status: "SUCCESS",
    data: [
      { uuid: "a1", name: "ec2 alert", cloudProvider: "AWS", resourceTypes: ["aws.ec2"], emailIds: ["x@y.z"], isEnabled: true, accountId: "acc" },
      { uuid: "a2", name: "s3 alert", cloudProvider: "AWS", resourceTypes: ["aws.s3"], emailIds: ["x@y.z"], isEnabled: false },
    ],
  };

  it("list projects rows; get filters the list by id and 404s when missing", async () => {
    const { client } = makeClient(alerts);
    const list = (await registry.dispatch(client, "cost_governance_alert", "list", {})) as { items: Record<string, unknown>[]; total: number };
    expect(list.total).toBe(2);
    expect(list.items[0]).toMatchObject({ id: "a1", name: "ec2 alert" });
    expect(list.items[0]).not.toHaveProperty("accountId");

    expect(await registry.dispatch(client, "cost_governance_alert", "get", { alert_id: "a2" })).toMatchObject({ uuid: "a2" });
    await expect(registry.dispatch(client, "cost_governance_alert", "get", { alert_id: "zzz" })).rejects.toThrow(/not found/);
  });

  it("create posts the bare body; update puts it with ?id=; actions use query ids", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: { uuid: "a1" } });
    const body = { name: "n", cloudProvider: "AWS", resourceTypes: ["aws.ec2"], emailIds: ["x@y.z"] };
    await registry.dispatch(client, "cost_governance_alert", "create", { body: { ...body, accountId: "x" } });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/alert` });
    expect(request.mock.calls[0][0].body).toEqual(body);

    await registry.dispatch(client, "cost_governance_alert", "update", { alert_id: "a1", body });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "PUT", path: `${GOV}/alert` });
    expect(request.mock.calls[1][0].params).toMatchObject({ id: "a1" });

    await registry.dispatchExecute(client, "cost_governance_alert", "disable", { alert_id: "a1" });
    expect(request.mock.calls[2][0]).toMatchObject({ method: "PUT", path: `${GOV}/alert/toggle` });
    expect(request.mock.calls[2][0].params).toMatchObject({ id: "a1", enableGovernanceAlertRule: "false" });

    await registry.dispatchExecute(client, "cost_governance_alert", "clone", { alert_id: "a1" });
    expect(request.mock.calls[3][0]).toMatchObject({ method: "POST", path: `${GOV}/alert/clone` });
  });
});

describe("recommendation health", () => {
  it("list and get project the summary and drop per-run executions", async () => {
    const registry = new Registry(makeConfig());
    const summary = {
      id: { ruleId: "r1", accountId: "a" },
      ruleName: "idle",
      cloudProvider: "AWS",
      status: "SUCCESS",
      potentialSavings: 410.2,
      totalRecommendations: 7,
      executions: [{ big: true }],
    };
    const { client, request } = makeClient({ status: "SUCCESS", data: { totalItems: 1, ruleRecommendationSummaries: [summary] } });
    const list = (await registry.dispatch(client, "cost_governance_recommendation", "list", { health_status: "success" })) as {
      items: Record<string, unknown>[];
    };
    expect(request.mock.calls[0][0].body).toEqual({ healthStatus: "SUCCESS", limit: 20, offset: 0 });
    expect(list.items[0]).toMatchObject({ ruleId: "r1", potentialSavings: 410.2, totalRecommendations: 7 });
    expect(list.items[0]).not.toHaveProperty("executions");

    const one = makeClient({ status: "SUCCESS", data: summary });
    expect(await registry.dispatch(one.client, "cost_governance_recommendation", "get", { rule_id: "r1" })).toMatchObject({ ruleId: "r1" });
    expect(one.request.mock.calls[0][0].params).toMatchObject({ ruleId: "r1" });
  });
});

describe("overview", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get dispatches GET scalar metrics by name with comma-separated providers", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: 42 });
    const result = await registry.dispatch(client, "cost_governance_overview", "get", {
      metric: "total_evaluations",
      cloud_provider: "aws, gcp",
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "GET", path: `${GOV}/overview/totalEvaluations` });
    expect(request.mock.calls[0][0].params.cloudProvider).toEqual(["AWS", "GCP"]);
    expect(request.mock.calls[0][0].body).toBeUndefined();
    expect(result).toEqual({ metric: "total_evaluations", value: 42 });
  });

  it("get posts the time window for savings", async () => {
    const { client, request } = makeClient({ status: "SUCCESS", data: 1234.5 });
    const result = await registry.dispatch(client, "cost_governance_overview", "get", {
      metric: "total_realised_savings",
      start_time: "2026-11-01",
      end_time: "2026-11-02",
    });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/overview/totalRealisedSavingsV2` });
    expect(request.mock.calls[0][0].body).toEqual([
      { operator: "AFTER", timestamp: Date.UTC(2026, 10, 1) },
      { operator: "BEFORE", timestamp: Date.UTC(2026, 10, 3) - 1 },
    ]);
    expect(result).toEqual({ metric: "total_realised_savings", value: 1234.5 });
  });

  it("an unknown or missing metric fails locally and lists the valid ones", async () => {
    const { client, request } = makeClient();
    await expect(registry.dispatch(client, "cost_governance_overview", "get", { metric: "nope" })).rejects.toThrow(/total_evaluations/);
    await expect(registry.dispatch(client, "cost_governance_overview", "get", {})).rejects.toThrow(/metric is required/);
    // a series metric is not valid for get, and vice versa
    await expect(registry.dispatch(client, "cost_governance_overview", "get", { metric: "savings_time_series" })).rejects.toThrow(/metric is required/);
    expect(request).not.toHaveBeenCalled();
  });

  it("list returns breakdown rows for series metrics", async () => {
    const { client, request } = makeClient({
      status: "SUCCESS",
      data: { granularity: "DAY", timeSeriesData: [{ time: 1, savings: 5 }, { time: 2, savings: 6 }] },
    });
    const result = await registry.dispatch(client, "cost_governance_overview", "list", { metric: "savings_time_series" });
    expect(request.mock.calls[0][0]).toMatchObject({ method: "POST", path: `${GOV}/overview/totalRealisedSavingsTimeSeries` });
    expect(result).toEqual({ items: [{ time: 1, savings: 5 }, { time: 2, savings: 6 }], total: 2, granularity: "DAY" });
    await expect(registry.dispatch(client, "cost_governance_overview", "list", {})).rejects.toThrow(/metric/);
  });
});

describe("governance extractors", () => {
  it("rule list: tolerates empty and malformed payloads", () => {
    expect(ccmGovernanceRuleListExtract({ status: "SUCCESS", data: { totalItems: 0, rules: [] } })).toEqual({ items: [], total: 0 });
    expect(ccmGovernanceRuleListExtract(undefined)).toEqual({ items: [], total: 0 });
    expect(ccmGovernanceRuleListExtract({ data: null })).toEqual({ items: [], total: 0 });
    expect(ccmGovernanceRuleListExtract({ data: { rules: ["odd"] } })).toEqual({ items: ["odd"], total: 1 });
  });

  it("keeps falsy-but-meaningful values (0, false) in projections", () => {
    const { items } = ccmGovernanceEvaluationListExtract({
      data: { ruleExecution: [{ uuid: "e", resourceCount: 0, cost: 0, isDryRun: false, executionStatus: "SUCCESS" }] },
    });
    expect(items[0]).toMatchObject({ id: "e", resourceCount: 0, cost: 0, isDryRun: false });
  });

  it("execution details: caps entries and long responses and says so", () => {
    const long = "x".repeat(10_000);
    const result = ccmGovernanceExecutionDetailsExtract({
      data: Array.from({ length: 30 }, (_, i) => ({ policyName: `p${i}`, status: "SUCCESS", response: i === 0 ? long : "[]" })),
    });
    expect(result.total).toBe(30);
    expect(result.items).toHaveLength(25);
    expect(result.truncated).toBe(true);
    const first = result.items[0] as { response: string; responseTruncated: boolean; responseChars: number };
    expect(first.response.length).toBeLessThan(7_000);
    expect(first).toMatchObject({ responseTruncated: true, responseChars: 10_000 });
  });

  it("execution details: small payloads are not marked truncated; non-lists are empty", () => {
    expect(ccmGovernanceExecutionDetailsExtract({ data: [{ policyName: "p", response: "ok" }] })).toEqual({
      items: [{ policyName: "p", response: "ok" }],
      total: 1,
      truncated: false,
    });
    expect(ccmGovernanceExecutionDetailsExtract({ data: null })).toEqual({ items: [], total: 0, truncated: false });
  });

  it("evaluation get: passes non-objects through", () => {
    expect(ccmGovernanceEvaluationGetExtract({ data: null })).toBeNull();
  });

  it("write extractor wraps each non-object shape and passes entities through", () => {
    expect(ccmGovernanceWriteExtract({ data: true })).toEqual({ success: true });
    expect(ccmGovernanceWriteExtract({ data: false })).toEqual({ success: false });
    expect(ccmGovernanceWriteExtract({ data: "done" })).toEqual({ message: "done" });
    expect(ccmGovernanceWriteExtract({ data: 3 })).toEqual({ result: 3 });
    expect(ccmGovernanceWriteExtract({ data: ["a"] })).toEqual({ items: ["a"] });
    expect(ccmGovernanceWriteExtract(undefined)).toEqual({ success: true });
    expect(ccmGovernanceWriteExtract({ data: { uuid: "x" } })).toEqual({ uuid: "x" });
  });

  it("enqueue extractor handles an empty result", () => {
    expect(ccmGovernanceEnqueueExtract({ data: {} })).toMatchObject({ evaluationIds: [], count: 0 });
    expect(ccmGovernanceEnqueueExtract(undefined)).toMatchObject({ evaluationIds: [], count: 0 });
  });

  it("small helpers: target list, string list, rule set first, alert get, overview", () => {
    expect(ccmGovernanceTargetListExtract({ data: { a: "A" } })).toEqual({ items: [{ id: "a", name: "A" }], total: 1 });
    expect(ccmGovernanceTargetListExtract({ data: null })).toEqual({ items: [], total: 0 });
    expect(ccmGovernanceStringListExtract({ data: ["us-west-2", "us-east-1"] })).toEqual({ items: ["us-east-1", "us-west-2"], total: 2 });
    expect(() => ccmGovernanceRuleSetFirstExtract({ data: { ruleSet: [] } })).toThrow(/not found/);
    expect(() => ccmGovernanceAlertGetExtract({ data: [] }, { alert_id: "x" })).toThrow(/not found/);
    expect(ccmGovernanceOverviewValueExtract({ data: null }, { metric: "total_evaluations" })).toEqual({ metric: "total_evaluations", value: 0 });
    expect(ccmGovernanceOverviewSeriesExtract({ data: { AWS: 5, GCP: 1 } })).toEqual({
      items: [{ key: "AWS", value: 5 }, { key: "GCP", value: 1 }],
      total: 2,
    });
    expect(ccmGovernanceOverviewSeriesExtract({ data: { "2026-11-01": { SUCCESS: 3, FAILED: 1 } } })).toEqual({
      items: [{ key: "2026-11-01", SUCCESS: 3, FAILED: 1 }],
      total: 1,
    });
    expect(ccmGovernanceOverviewSeriesExtract({ data: null })).toEqual({ items: [], total: 0 });
  });
});
