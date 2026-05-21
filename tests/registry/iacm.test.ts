import { describe, it, expect, vi } from "vitest";
import { iacmToolset } from "../../src/registry/toolsets/iacm.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ResourceDefinition, EndpointSpec, PreflightContext } from "../../src/registry/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "Testim",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = iacmToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in iacmToolset`);
  return res;
}

function getOp(type: string, op: "list" | "get"): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── Toolset structure ───────────────────────────────────────────────────────

describe("iacmToolset structure", () => {
  it("has name 'iacm'", () => {
    expect(iacmToolset.name).toBe("iacm");
  });

  it("is opt-in (not loaded by default)", () => {
    expect(iacmToolset.optIn).toBe(true);
  });

  it("registers all 5 resource types", () => {
    const types = iacmToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("iacm_workspace");
    expect(types).toContain("iacm_resource");
    expect(types).toContain("iacm_module");
    expect(types).toContain("iacm_workspace_costs");
    expect(types).toContain("iacm_activity_resource_change");
    expect(types).toHaveLength(5);
  });

  it("iacm_module is account-scoped", () => {
    expect(findResource("iacm_module").scope).toBe("account");
  });

  it("iacm_workspace, iacm_resource, iacm_workspace_costs, iacm_activity_resource_change are project-scoped", () => {
    for (const type of ["iacm_workspace", "iacm_resource", "iacm_workspace_costs", "iacm_activity_resource_change"]) {
      expect(findResource(type).scope).toBe("project");
    }
  });

  it("all endpoint specs have operationPolicy", () => {
    for (const resource of iacmToolset.resources) {
      for (const [opName, spec] of Object.entries(resource.operations)) {
        expect(
          spec.operationPolicy,
          `${resource.resourceType}.${opName} is missing operationPolicy`,
        ).toBeDefined();
        expect(spec.operationPolicy!.risk).toBe("read");
      }
    }
  });
});

// ─── Registry opt-in behaviour ───────────────────────────────────────────────

describe("iacm opt-in with Registry", () => {
  it("is NOT present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).not.toContain("iacm_workspace");
  });

  it("IS present when explicitly enabled with HARNESS_TOOLSETS=iacm", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
    expect(registry.getAllResourceTypes()).toContain("iacm_resource");
    expect(registry.getAllResourceTypes()).toContain("iacm_module");
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace_costs");
    expect(registry.getAllResourceTypes()).toContain("iacm_activity_resource_change");
  });

  it("IS present when enabled with +iacm modifier", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+iacm" }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
  });
});

// ─── requireProjectScope preflight ───────────────────────────────────────────

describe("requireProjectScope preflight", () => {
  const preflight = getOp("iacm_workspace", "list").preflight!;

  it("passes when both org_id and project_id are provided in input", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default", project_id: "Testim" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("passes when org_id and project_id come from config defaults (input omits them)", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "default", HARNESS_PROJECT: "Testim" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("throws when org_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { project_id: "Testim" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "" })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
  });

  it("throws when project_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("throws when both org_id and project_id are missing from input and config", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("error message mentions IaCM and explicit scope requirement", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("IaCM");
  });

  it("is present on all project-scoped list operations", () => {
    for (const type of ["iacm_workspace", "iacm_resource", "iacm_workspace_costs", "iacm_activity_resource_change"]) {
      const spec = getOp(type, "list");
      expect(spec.preflight, `${type}.list is missing preflight`).toBeDefined();
    }
  });

  it("is NOT present on account-scoped iacm_module list", () => {
    expect(getOp("iacm_module", "list").preflight).toBeUndefined();
  });
});

// ─── Response extractor: workspaceListExtract ─────────────────────────────────

describe("workspaceListExtract (via registry dispatch)", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace", "list").responseExtractor!(raw);
  }

  it("wraps array into { items, page_count, has_more }", () => {
    const items = [{ identifier: "ws1" }, { identifier: "ws2" }];
    const result = extract(items) as Record<string, unknown>;
    expect(result.items).toEqual(items);
    expect(result.page_count).toBe(2);
    expect(result.has_more).toBe(false);
  });

  it("has_more=true when page is full (30 items)", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ identifier: `ws${i}` }));
    const result = extract(items) as Record<string, unknown>;
    expect(result.has_more).toBe(true);
  });

  it("handles non-array gracefully", () => {
    const result = extract(null) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.page_count).toBe(0);
    expect(result.has_more).toBe(false);
  });
});

// ─── Response extractor: iacmResourcesExtract ────────────────────────────────

describe("iacmResourcesExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_resource", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("extracts resources, outputs, data_sources sections", () => {
    const raw = {
      resources: [{ name: "aws_instance.main" }],
      outputs: [{ name: "vpc_id", value: "vpc-123" }],
      data_sources: [],
      hasMore: false,
      totalItems: 1,
    };
    const result = extract(raw);
    expect(result.items).toEqual(raw.resources);
    expect((result.resources as unknown[]).length).toBe(1);
    expect((result.outputs as unknown[]).length).toBe(1);
    expect(result.total_items).toBe(1);
    expect(result.has_more).toBe(false);
  });

  it("total_items defaults to -1 when absent", () => {
    const result = extract({ resources: [] });
    expect(result.items).toEqual([]);
    expect(result.total_items).toBe(-1);
  });

  it("returns empty items when the API response has no state sections", () => {
    const result = extract({});
    expect(result.items).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.outputs).toEqual([]);
    expect(result.data_sources).toEqual([]);
    expect(result.page_count).toBe(0);
    expect(result.has_more).toBe(false);
  });

  it("has_more reflects hasMore from API", () => {
    const result = extract({ resources: Array(30).fill({}), hasMore: true });
    expect(result.has_more).toBe(true);
  });
});

// ─── Response extractor: moduleListExtract ───────────────────────────────────

describe("moduleListExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_module", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("wraps module array correctly", () => {
    const modules = [{ name: "vpc" }, { name: "ecs" }];
    const result = extract(modules);
    expect(result.items).toEqual(modules);
    expect(result.page_count).toBe(2);
    expect(result.has_more).toBe(false);
  });

  it("has_more=true for full page", () => {
    const result = extract(Array(30).fill({ name: "mod" }));
    expect(result.has_more).toBe(true);
  });
});

// ─── Response extractor: costsListExtract ────────────────────────────────────

describe("costsListExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace_costs", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("wraps costs array correctly", () => {
    const costs = [{ amount: 1.23, currency: "USD" }];
    const result = extract(costs);
    expect(result.items).toEqual(costs);
    expect(result.page_count).toBe(1);
    expect(result.has_more).toBe(false);
  });
});

// ─── Response extractor: activityChangesExtract ──────────────────────────────

describe("activityChangesExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_activity_resource_change", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("extracts summary counts and resource_changes", () => {
    const raw = {
      activity_id: "act-123",
      workspace_id: "ws-abc",
      resource_changes: [{ resource_name: "aws_instance.main", action: "change" }],
      total_added: 0,
      total_changed: 1,
      total_destroyed: 0,
      total_unchanged: 5,
    };
    const result = extract(raw);
    expect(result.activity_id).toBe("act-123");
    expect(result.workspace_id).toBe("ws-abc");
    const summary = result.summary as Record<string, unknown>;
    expect(summary.total_changed).toBe(1);
    expect(summary.total_unchanged).toBe(5);
    expect((result.resource_changes as unknown[]).length).toBe(1);
  });

  it("defaults counts to 0 when absent", () => {
    const result = extract({});
    const summary = result.summary as Record<string, unknown>;
    expect(summary.total_added).toBe(0);
    expect(summary.total_destroyed).toBe(0);
  });
});

// ─── API paths ───────────────────────────────────────────────────────────────

describe("endpoint paths", () => {
  it("iacm_workspace list uses /iacm/api/orgs/{org}/projects/{project}/workspaces", () => {
    expect(getOp("iacm_workspace", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/workspaces",
    );
  });

  it("iacm_resource list uses /workspaces/{workspaceId}/resources", () => {
    expect(getOp("iacm_resource", "list").path).toContain("/resources");
  });

  it("iacm_module list uses /iacm/api/modules (account-scoped, no org/project)", () => {
    expect(getOp("iacm_module", "list").path).toBe("/iacm/api/modules");
    expect(getOp("iacm_module", "list").pathParams).toBeUndefined();
  });

  it("iacm_module get uses /iacm/api/modules/{moduleId}", () => {
    expect(getOp("iacm_module", "get").path).toBe("/iacm/api/modules/{moduleId}");
  });

  it("iacm_activity_resource_change list uses /activities/{activityId}/resource-changes", () => {
    expect(getOp("iacm_activity_resource_change", "list").path).toContain(
      "/activities/{activityId}/resource-changes",
    );
  });
});
