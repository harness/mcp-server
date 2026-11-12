/**
 * HAR v3 lifecycle rules, executions, execution items, stats and dry run —
 * paths, multi-scope params, required filters, compaction and write gating.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { compactItems } from "../../src/utils/compact.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "acct123",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "PROD",
    HARNESS_PROJECT: "Harness_Commons",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function mockClient(response: unknown): HarnessClient {
  return {
    request: vi.fn().mockResolvedValue(response),
  } as unknown as HarnessClient;
}

const lastCall = (client: HarnessClient) =>
  (client.request as ReturnType<typeof vi.fn>).mock.calls[0][0];

const LIFECYCLE_TYPES = ["lifecycle_rule_v3", "lifecycle_execution_v3", "lifecycle_execution_item_v3", "lifecycle_stats_v3"];

const rule = {
  id: "rule-1",
  name: "cleanup-snapshots",
  action: "DELETE",
  enabled: true,
  packageType: "MAVEN",
  applyTo: { mode: "EXPLICIT", registries: ["reg-1"] },
  criteria: { match: "ALL", rules: [{ type: "KEEP_LAST_N", config: { value: 5 } }] },
  hasLocalAssignment: true,
  createdBy: { name: "someone" },
};

describe("lifecycle_rule_v3", () => {
  const registry = new Registry(makeConfig());

  it("list hits /lifecycle/rules with project scope and forwards filters", async () => {
    const client = mockClient({ items: [rule], page: 0, size: 20, hasMore: false });
    const result = (await registry.dispatch(client, "lifecycle_rule_v3", "list", {
      action: "DELETE",
      package_types: "MAVEN",
      registry_ids: "reg-1",
      scope: "descendants",
    })) as { items: Record<string, unknown>[] };

    const call = lastCall(client);
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/har/api/v3/lifecycle/rules");
    expect(call.params).toMatchObject({
      account_identifier: "acct123",
      org_identifier: "PROD",
      project_identifier: "Harness_Commons",
      action: "DELETE",
      package_types: "MAVEN",
      registry_ids: "reg-1",
      scope: "descendants",
    });
    const [compacted] = compactItems(result.items, registry.getResource("lifecycle_rule_v3").compactItem) as Record<string, unknown>[];
    expect(compacted).toMatchObject({ rule_id: "rule-1", action: "DELETE", criteria: rule.criteria, applyTo: rule.applyTo });
    expect(compacted.createdBy).toBeUndefined();
  });

  it("resource_scope=account sends no org/project", async () => {
    const client = mockClient({ items: [], hasMore: false });
    await registry.dispatch(client, "lifecycle_rule_v3", "list", { resource_scope: "account" });
    const call = lastCall(client);
    expect(call.params.account_identifier).toBe("acct123");
    expect(call.params.org_identifier).toBeUndefined();
    expect(call.params.project_identifier).toBeUndefined();
  });

  it("resource_scope=org sends org only", async () => {
    const client = mockClient({ items: [], hasMore: false });
    await registry.dispatch(client, "lifecycle_rule_v3", "list", { resource_scope: "org", org_id: "eng" });
    const call = lastCall(client);
    expect(call.params.org_identifier).toBe("eng");
    expect(call.params.project_identifier).toBeUndefined();
  });

  it("get hits /lifecycle/rules/{id} with the same scope params as list", async () => {
    const client = mockClient(rule);
    const result = (await registry.dispatch(client, "lifecycle_rule_v3", "get", { rule_id: "rule-1" })) as Record<string, unknown>;
    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/lifecycle/rules/rule-1");
    expect(call.params).toMatchObject({ account_identifier: "acct123", org_identifier: "PROD", project_identifier: "Harness_Commons" });
    expect(result.name).toBe("cleanup-snapshots");
  });
});

describe("lifecycle_rule_v3 dry_run", () => {
  it("POSTs { policyId } to /lifecycle/executions with project scope params", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({ id: "exec-1", policyId: "rule-1", status: "PENDING", triggerType: "DRY_RUN" });
    const result = (await registry.dispatchExecute(client, "lifecycle_rule_v3", "dry_run", { rule_id: " rule-1 " })) as Record<string, unknown>;

    const call = lastCall(client);
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/har/api/v3/lifecycle/executions");
    expect(call.body).toEqual({ policyId: "rule-1" });
    expect(call.params).toMatchObject({ account_identifier: "acct123", org_identifier: "PROD", project_identifier: "Harness_Commons" });
    expect(result.triggerType).toBe("DRY_RUN");
  });

  it("accepts body.policyId", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({ id: "exec-1" });
    await registry.dispatchExecute(client, "lifecycle_rule_v3", "dry_run", { body: { policyId: "rule-2" } });
    expect(lastCall(client).body).toEqual({ policyId: "rule-2" });
  });

  it("rejects a missing rule id before calling the API", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({});
    await expect(registry.dispatchExecute(client, "lifecycle_rule_v3", "dry_run", {})).rejects.toThrow(/rule_id/);
    expect(client.request).not.toHaveBeenCalled();
  });

  it("is blocked in read-only mode", async () => {
    const registry = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({});
    await expect(registry.dispatchExecute(client, "lifecycle_rule_v3", "dry_run", { rule_id: "rule-1" })).rejects.toThrow();
    expect(client.request).not.toHaveBeenCalled();
  });

  it("does not expose rule create/update/delete", () => {
    const registry = new Registry(makeConfig());
    const def = registry.getResource("lifecycle_rule_v3");
    expect(Object.keys(def.operations).sort()).toEqual(["get", "list"]);
    expect(Object.keys(def.executeActions ?? {})).toEqual(["dry_run"]);
  });
});

describe("lifecycle_execution_v3", () => {
  const registry = new Registry(makeConfig());

  it("list forwards status and keeps the affected counts in compact mode", async () => {
    const client = mockClient({
      items: [{ id: "exec-1", policyId: "rule-1", policyName: "cleanup", status: "SUCCESS", triggerType: "DRY_RUN", versionsDeleted: 12, protected: 3, storageReclaimed: "1024" }],
      hasMore: false,
    });
    const result = (await registry.dispatch(client, "lifecycle_execution_v3", "list", { status: "SUCCESS" })) as { items: Record<string, unknown>[] };
    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/lifecycle/executions");
    expect(call.params.status).toBe("SUCCESS");
    const [compacted] = compactItems(result.items, registry.getResource("lifecycle_execution_v3").compactItem) as Record<string, unknown>[];
    expect(compacted).toMatchObject({ execution_id: "exec-1", triggerType: "DRY_RUN", versionsDeleted: 12, protected: 3 });
  });

  it("get hits /lifecycle/executions/{executionId}", async () => {
    const client = mockClient({ id: "exec-1", status: "INPROGRESS" });
    await registry.dispatch(client, "lifecycle_execution_v3", "get", { execution_id: "exec-1" });
    expect(lastCall(client).path).toBe("/har/api/v3/lifecycle/executions/exec-1");
  });
});

describe("lifecycle_execution_item_v3", () => {
  const registry = new Registry(makeConfig());

  it("list nests execution_id in the path and keeps item fields", async () => {
    const client = mockClient({
      items: [{ packageName: "app", version: "1.0.0-SNAPSHOT", registryName: "maven-local", status: "WOULD_BE_DELETED", reason: "older than last 5" }],
      hasMore: false,
    });
    const result = (await registry.dispatch(client, "lifecycle_execution_item_v3", "list", {
      execution_id: "exec-1",
      status: "WOULD_BE_DELETED",
    })) as { items: Record<string, unknown>[] };
    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/lifecycle/executions/exec-1/items");
    expect(call.params.status).toBe("WOULD_BE_DELETED");
    expect(result.items[0]).toMatchObject({ packageName: "app", version: "1.0.0-SNAPSHOT", status: "WOULD_BE_DELETED", reason: "older than last 5" });
  });

  it("requires execution_id", async () => {
    const client = mockClient({ items: [] });
    await expect(registry.dispatch(client, "lifecycle_execution_item_v3", "list", {})).rejects.toThrow(/execution_id/);
    expect(client.request).not.toHaveBeenCalled();
  });
});

describe("lifecycle_stats_v3", () => {
  it("get needs no identifier and forwards optional filters", async () => {
    const registry = new Registry(makeConfig());
    const client = mockClient({ storageReclaimed: "2048", artifactsCleaned: 4, executionsLast30Days: 2 });
    const result = (await registry.dispatch(client, "lifecycle_stats_v3", "get", { action: "DELETE", scope: "descendants" })) as Record<string, unknown>;
    const call = lastCall(client);
    expect(call.path).toBe("/har/api/v3/lifecycle/stats");
    expect(call.params).toMatchObject({ action: "DELETE", scope: "descendants", project_identifier: "Harness_Commons" });
    expect(result.artifactsCleaned).toBe(4);
  });
});

describe("registries-lifecycle toolset", () => {
  it("is default-enabled", () => {
    const types = new Registry(makeConfig()).getAllResourceTypes();
    for (const t of LIFECYCLE_TYPES) expect(types).toContain(t);
  });

  it("reads stay available in read-only mode", async () => {
    const registry = new Registry(makeConfig({ HARNESS_READ_ONLY: true }));
    const client = mockClient({ items: [], hasMore: false });
    await registry.dispatch(client, "lifecycle_execution_v3", "list", {});
    expect(client.request).toHaveBeenCalledOnce();
  });

  it("every lifecycle resource supports account, org and project scope", () => {
    const registry = new Registry(makeConfig());
    for (const t of LIFECYCLE_TYPES) {
      expect(registry.getResource(t).supportedScopes).toEqual(["account", "org", "project"]);
    }
  });
});
