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

  it("is loaded by default (not opt-in)", () => {
    expect(iacmToolset.optIn).toBe(false);
  });

  it("registers all 6 resource types", () => {
    const types = iacmToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("iacm_workspace");
    expect(types).toContain("iacm_workspace_provisioner_summary");
    expect(types).toContain("iacm_resource");
    expect(types).toContain("iacm_module");
    expect(types).toContain("iacm_workspace_costs");
    expect(types).toContain("iacm_activity_resource_change");
    expect(types).toHaveLength(6);
  });

  it("iacm_module is account-scoped", () => {
    expect(findResource("iacm_module").scope).toBe("account");
  });

  it("IaCM workspace resources are project-scoped", () => {
    for (const type of [
      "iacm_workspace",
      "iacm_workspace_provisioner_summary",
      "iacm_resource",
      "iacm_workspace_costs",
      "iacm_activity_resource_change",
    ]) {
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

// ─── Registry default-on behaviour ───────────────────────────────────────────

describe("iacm default-on with Registry", () => {
  it("IS present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace_provisioner_summary");
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

  it("is present on all project-scoped IaCM operations", () => {
    const operations: Array<[string, "list" | "get"]> = [
      ["iacm_workspace", "list"],
      ["iacm_workspace_provisioner_summary", "get"],
      ["iacm_resource", "list"],
      ["iacm_workspace_costs", "list"],
      ["iacm_activity_resource_change", "list"],
    ];
    for (const [type, operation] of operations) {
      const spec = getOp(type, operation);
      expect(spec.preflight, `${type}.${operation} is missing preflight`).toBeDefined();
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

// ─── Response extractor: workspace provisioner summary ───────────────────────

describe("workspaceProvisionerSummaryExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace_provisioner_summary", "get").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("projects provisioner ratios with derived workspace counts", () => {
    const result = extract({
      total: 10,
      provisioner: {
        terraform: 0.7,
        opentofu: 0.3,
      },
    });

    expect(result).toEqual({
      total_workspaces: 10,
      provisioners: [
        { provisioner: "terraform", ratio: 0.7, workspace_count: 7 },
        { provisioner: "opentofu", ratio: 0.3, workspace_count: 3 },
      ],
    });
  });

  it("omits a derived count when the API value is not a ratio", () => {
    const result = extract({ total: 10, provisioner: { terraform: 70 } });

    expect(result.provisioners).toEqual([
      { provisioner: "terraform", ratio: 70 },
    ]);
  });

  it("handles malformed responses without leaking the backend envelope", () => {
    expect(extract({ debug: "internal" })).toEqual({
      provisioners: [],
    });
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

  it("passes through documented execution resource-change sections", () => {
    const raw = {
      pipeline_execution: "exec-123",
      workspace_id: "ws-abc",
      resources: [{ name: "aws_instance.main" }],
      planned_changes: [{ name: "aws_instance.main", change: "changed" }],
      drift_changes: [],
      outputs: [],
      data_sources: [],
    };
    const result = extract(raw);
    expect(result.pipeline_execution).toBe("exec-123");
    expect(result.workspace_id).toBe("ws-abc");
    expect(result.resources).toEqual([{ name: "aws_instance.main" }]);
    expect(result.planned_changes).toEqual([{ name: "aws_instance.main", change: "changed" }]);
  });

  it("adds resource_changes alias from planned_changes when absent", () => {
    const result = extract({ planned_changes: [{ name: "aws_instance.main" }] });
    expect(result.resource_changes).toEqual([{ name: "aws_instance.main" }]);
  });
});

// ─── API paths ───────────────────────────────────────────────────────────────

describe("endpoint paths", () => {
  it("iacm_workspace list uses /iacm/api/orgs/{org}/projects/{project}/workspaces", () => {
    expect(getOp("iacm_workspace", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/workspaces",
    );
  });

  it("iacm_workspace_provisioner_summary get uses the provisioners-ratio endpoint", () => {
    expect(getOp("iacm_workspace_provisioner_summary", "get").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/workspaces/provisioners-ratio",
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

  it("iacm_activity_resource_change list uses the activity resource-changes endpoint", () => {
    expect(getOp("iacm_activity_resource_change", "list").path).toContain(
      "/activities/{activityId}/resource-changes",
    );
  });
});

// ─── Registry dispatch integration ───────────────────────────────────────────

describe("iacm registry dispatch", () => {
  it("dispatches the provisioner summary with optional time filters", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      total: 4,
      provisioner: { terraform: 0.75, opentofu: 0.25 },
    });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    const result = await registry.dispatch(
      makeClient(mockRequest),
      "iacm_workspace_provisioner_summary",
      "get",
      {
        org_id: "default",
        project_id: "Testim",
        start_time: 1000,
        end_time: 2000,
      },
    );

    const request = mockRequest.mock.calls[0]![0] as {
      path: string;
      params: Record<string, unknown>;
    };
    expect(request.path).toBe(
      "/iacm/api/orgs/default/projects/Testim/workspaces/provisioners-ratio",
    );
    expect(request.params).toMatchObject({
      start_time: 1000,
      end_time: 2000,
    });
    expect(result).toMatchObject({
      total_workspaces: 4,
      provisioners: expect.arrayContaining([
        { provisioner: "terraform", ratio: 0.75, workspace_count: 3 },
      ]),
    });
  });

  it("discovers the provisioner summary for Terraform workspace count questions", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    expect(registry.searchResources("number of terraform workspaces")[0]?.type).toBe(
      "iacm_workspace_provisioner_summary",
    );
  });

  it("dispatches iacm_module get using the numeric id from harness_get resource_id mapping", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: 4640, name: "vpc" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_module", "get", { id: "4640" });

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/modules/4640");
  });

  it("dispatches activity resource changes by activity id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ planned_changes: [] });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_activity_resource_change", "list", {
      org_id: "default",
      project_id: "Testim",
      activity_id: "exec-123",
      workspace_id: "ws-1",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/Testim/activities/exec-123/resource-changes");
    expect(request.params.workspace).toBe("ws-1");
  });
});
