/**
 * Unit tests for the CCM cost_budget resource registration and bodyBuilders.
 * Guards the public contract of the budget CRUD + clone + bulk_delete tools.
 */
import { describe, it, expect, vi } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import {
  ccmBudgetWriteExtract,
  ccmBudgetListCompactExtract,
  ccmBudgetDetailExtract,
} from "../../src/registry/extractors.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const budget = ccmToolset.resources.find((r) => r.resourceType === "cost_budget");
const variance = ccmToolset.resources.find((r) => r.resourceType === "cost_budget_variance");
const budgetGroup = ccmToolset.resources.find((r) => r.resourceType === "cost_budget_group");

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
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("cost_budget resource", () => {
  it("is registered in the ccm toolset", () => {
    expect(budget).toBeDefined();
    expect(budget!.toolset).toBe("ccm");
    expect(budget!.scope).toBe("account");
    expect(budget!.identifierFields).toEqual(["budget_id"]);
  });

  it("exposes the full CRUD operation set", () => {
    expect(Object.keys(budget!.operations).sort()).toEqual(
      ["create", "delete", "get", "list", "update"].sort(),
    );
  });

  it("maps list/get/update/delete to the correct paths and methods", () => {
    expect(budget!.operations.list).toMatchObject({ method: "POST", path: "/ccm/api/budgets/v2/list" });
    expect(budget!.operations.get).toMatchObject({ method: "GET", path: "/ccm/api/budgets/{budgetId}" });
    expect(budget!.operations.create).toMatchObject({ method: "POST", path: "/ccm/api/budgets" });
    expect(budget!.operations.update).toMatchObject({ method: "PUT", path: "/ccm/api/budgets/{budgetId}" });
    expect(budget!.operations.delete).toMatchObject({ method: "DELETE", path: "/ccm/api/budgets/{budgetId}" });
  });

  it("builds the v2 list body: filterType, limit/offset, searchKey, perspectiveNames", () => {
    const builder = budget!.operations.list!.bodyBuilder!;
    expect(builder({})).toEqual({ filterType: "CCMBudget", limit: 20, offset: 0 });
    expect(builder({ search_term: "  Q1  ", limit: 5, offset: 10 })).toEqual({
      filterType: "CCMBudget",
      limit: 5,
      offset: 10,
      searchKey: "Q1",
    });
    // perspective_name accepts comma-separated string or array, trimmed + de-blanked
    expect(builder({ perspective_name: "Prod, , Staging" })).toEqual({
      filterType: "CCMBudget",
      limit: 20,
      offset: 0,
      perspectiveNames: ["Prod", "Staging"],
    });
    expect(builder({ perspective_name: ["A", "B"] })).toMatchObject({
      perspectiveNames: ["A", "B"],
    });
  });

  it("classifies write risk: low_write for create/update, destructive for delete", () => {
    expect(budget!.operations.create!.operationPolicy.risk).toBe("low_write");
    expect(budget!.operations.update!.operationPolicy.risk).toBe("low_write");
    expect(budget!.operations.delete!.operationPolicy.risk).toBe("destructive");
  });

  it("injects accountId into the create body and passes the user body through", () => {
    expect(budget!.operations.create!.injectAccountInBody).toBe("accountId");
    const body = { name: "Q1 Budget", type: "SPECIFIED_AMOUNT", budgetAmount: 1000, period: "MONTHLY" };
    expect(budget!.operations.create!.bodyBuilder!({ body })).toEqual(body);
  });

  it("exposes clone and bulk_delete actions", () => {
    expect(Object.keys(budget!.executeActions!).sort()).toEqual(["bulk_delete", "clone"]);
    expect(budget!.executeActions!.clone).toMatchObject({
      method: "POST",
      path: "/ccm/api/budgets/{budgetId}",
    });
    expect(budget!.executeActions!.clone.queryParams).toEqual({ clone_name: "cloneName" });
    expect(budget!.executeActions!.bulk_delete).toMatchObject({
      method: "POST",
      path: "/ccm/api/budgets/bulk/delete",
    });
    expect(budget!.executeActions!.bulk_delete.operationPolicy.risk).toBe("destructive");
  });

  it("bulk_delete wraps budget_ids into { budgetIds } and accepts body.budgetIds", () => {
    const builder = budget!.executeActions!.bulk_delete.bodyBuilder!;
    expect(builder({ budget_ids: ["a", "b"] })).toEqual({ budgetIds: ["a", "b"] });
    expect(builder({ body: { budgetIds: ["c"] } })).toEqual({ budgetIds: ["c"] });
  });
});

describe("ccmBudgetListCompactExtract", () => {
  it("projects summaries to essential budget health fields and strips noise", () => {
    const raw = {
      status: "SUCCESS",
      data: {
        summaries: [
          {
            uuid: "bud-1",
            name: "Q1 Prod",
            perspectiveName: "Production",
            budgetAmount: 1000,
            actualCost: 850,
            forecastCost: 920,
            alertThresholds: [{ percentage: 80, emailAddresses: ["ops@example.com"] }],
            budgetMonthlyBreakdown: { budgetBreakdown: "MONTHLY" },
          },
        ],
        totalCount: 12,
      },
    };

    const result = ccmBudgetListCompactExtract(raw);
    expect(result.total).toBe(12);
    expect(result.items).toEqual([
      {
        id: "bud-1",
        name: "Q1 Prod",
        perspectiveId: undefined,
        perspectiveName: "Production",
        budgetAmount: 1000,
        actualCost: 850,
        forecastCost: 920,
        timeLeft: undefined,
        timeUnit: undefined,
        period: undefined,
        type: undefined,
        growthRate: undefined,
        actualCostAlerts: undefined,
        forecastCostAlerts: undefined,
        budgetGroup: undefined,
        folderId: undefined,
      },
    ]);
    expect(result.items[0]).not.toHaveProperty("alertThresholds");
    expect(result.items[0]).not.toHaveProperty("budgetMonthlyBreakdown");
  });

  it("falls back to standard paged content when summaries is absent", () => {
    const raw = {
      data: {
        content: [{ id: "legacy-1", name: "Legacy Budget" }],
        totalElements: 1,
      },
    };

    expect(ccmBudgetListCompactExtract(raw)).toEqual({
      items: [{ id: "legacy-1", name: "Legacy Budget" }],
      total: 1,
    });
  });

  it("is wired into cost_budget list", () => {
    expect(budget!.operations.list!.responseExtractor).toBe(ccmBudgetListCompactExtract);
  });
});

describe("ccmBudgetDetailExtract", () => {
  it("sorts budgetHistory into ascending costData for variance views", () => {
    const raw = {
      data: {
        uuid: "bud-1",
        name: "Q1 Prod",
        period: "MONTHLY",
        budgetAmount: 1000,
        actualCost: 850,
        forecastCost: 920,
        budgetHistory: {
          "1704067200000": {
            time: 1704067200000,
            endTime: 1706745599999,
            actualCost: 400,
            forecastCost: 450,
            budgeted: 500,
            budgetVariance: -100,
            budgetVariancePercentage: -20,
          },
          "1701388800000": {
            time: 1701388800000,
            endTime: 1704067199999,
            actualCost: 300,
            forecastCost: 320,
            budgeted: 500,
            budgetVariance: -200,
            budgetVariancePercentage: -40,
          },
        },
      },
    };

    expect(ccmBudgetDetailExtract(raw)).toEqual({
      budgetId: "bud-1",
      name: "Q1 Prod",
      period: "MONTHLY",
      budgetAmount: 1000,
      forecastCost: 920,
      actualCost: 850,
      costData: [
        {
          time: 1701388800000,
          endTime: 1704067199999,
          actualCost: 300,
          forecastCost: 320,
          budgeted: 500,
          budgetVariance: -200,
          budgetVariancePercentage: -40,
        },
        {
          time: 1704067200000,
          endTime: 1706745599999,
          actualCost: 400,
          forecastCost: 450,
          budgeted: 500,
          budgetVariance: -100,
          budgetVariancePercentage: -20,
        },
      ],
    });
  });

  it("reads budgetGroupHistory and budgetGroupAmount for budget groups", () => {
    const raw = {
      data: {
        id: "grp-1",
        name: "Eng Group",
        period: "YEARLY",
        budgetGroupAmount: 5000,
        budgetGroupHistory: {
          "1700000000000": {
            time: 1700000000000,
            actualCost: 1200,
            budgeted: 1500,
          },
        },
      },
    };

    expect(ccmBudgetDetailExtract(raw)).toMatchObject({
      budgetId: "grp-1",
      name: "Eng Group",
      budgetAmount: 5000,
      costData: [{ time: 1700000000000, actualCost: 1200, budgeted: 1500 }],
    });
  });

  it("is wired into cost_budget_variance get", () => {
    expect(variance!.operations.get!.responseExtractor).toBe(ccmBudgetDetailExtract);
  });
});

describe("cost_budget registry dispatch", () => {
  it("list uses compact extractor output and forwards search_term in the POST body", async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        summaries: [
          {
            uuid: "bud-1",
            name: "Q1 Prod",
            budgetAmount: 1000,
            actualCost: 850,
            alertThresholds: [{ emailAddresses: ["ops@example.com"] }],
          },
        ],
        totalCount: 1,
      },
    });
    const registry = new Registry(makeConfig());

    const result = (await registry.dispatch(makeClient(requestSpy), "cost_budget", "list", {
      search_term: "Q1",
      limit: 5,
      offset: 10,
    })) as { items: Array<Record<string, unknown>>; total: number };

    expect(requestSpy).toHaveBeenCalledOnce();
    const call = requestSpy.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ccm/api/budgets/v2/list");
    expect(call.body).toMatchObject({
      filterType: "CCMBudget",
      searchKey: "Q1",
      limit: 5,
      offset: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ id: "bud-1", name: "Q1 Prod", actualCost: 850 });
    expect(result.items[0]).not.toHaveProperty("alertThresholds");
  });
});

describe("cost_budget_variance registry dispatch", () => {
  it("get projects sorted costData from budgetHistory", async () => {
    const requestSpy = vi.fn().mockResolvedValue({
      data: {
        uuid: "bud-1",
        name: "Q1 Prod",
        budgetAmount: 1000,
        budgetHistory: {
          "2": { time: 2, actualCost: 200, budgeted: 500 },
          "1": { time: 1, actualCost: 100, budgeted: 500 },
        },
      },
    });
    const registry = new Registry(makeConfig());

    const result = (await registry.dispatch(makeClient(requestSpy), "cost_budget_variance", "get", {
      budget_id: "bud-1",
    })) as { budgetId: string; costData: Array<{ time: number }> };

    expect(requestSpy).toHaveBeenCalledOnce();
    const call = requestSpy.mock.calls[0]![0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ccm/api/budgets/bud-1");

    expect(result.budgetId).toBe("bud-1");
    expect(result.costData.map((row) => row.time)).toEqual([1, 2]);
  });
});

describe("ccmBudgetWriteExtract", () => {
  it("wraps a bare-string id (create/clone return { status, data: '<id>' })", () => {
    expect(ccmBudgetWriteExtract({ status: "SUCCESS", data: "abc123XYZ" })).toEqual({
      id: "abc123XYZ",
      status: "SUCCESS",
    });
  });

  it("treats a spaced string as a message (delete returns a confirmation)", () => {
    expect(ccmBudgetWriteExtract({ status: "SUCCESS", data: "Successfully deleted the budget" })).toEqual({
      message: "Successfully deleted the budget",
      status: "SUCCESS",
    });
  });

  it("wraps boolean/number data under result", () => {
    expect(ccmBudgetWriteExtract({ status: "SUCCESS", data: true })).toEqual({ result: true, status: "SUCCESS" });
  });

  it("passes object data through (full entity payloads)", () => {
    expect(ccmBudgetWriteExtract({ data: { uuid: "x", name: "n" } })).toEqual({ uuid: "x", name: "n" });
  });

  it("is wired into budget + budget group writes and actions", () => {
    expect(budget!.operations.create!.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budget!.operations.update!.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budget!.operations.delete!.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budget!.executeActions!.clone.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budget!.executeActions!.bulk_delete.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budgetGroup!.operations.create!.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budgetGroup!.operations.update!.responseExtractor).toBe(ccmBudgetWriteExtract);
    expect(budgetGroup!.operations.delete!.responseExtractor).toBe(ccmBudgetWriteExtract);
  });
});

describe("cost_budget_variance resource", () => {
  it("is registered as a read-only resource in the ccm toolset", () => {
    expect(variance).toBeDefined();
    expect(variance!.toolset).toBe("ccm");
    expect(variance!.scope).toBe("account");
    expect(variance!.identifierFields).toEqual(["budget_id"]);
    // Read-only: only a get operation, no create/update/delete.
    expect(Object.keys(variance!.operations)).toEqual(["get"]);
  });

  it("get reads the REST budget detail and maps budget_id to the path param", () => {
    // The GraphQL FetchBudgetsGridData grid resolver returns empty costData even
    // for budgets with history, so variance is sourced from the REST budget
    // detail's populated budgetHistory map instead.
    expect(variance!.operations.get).toMatchObject({ method: "GET", path: "/ccm/api/budgets/{budgetId}" });
    expect(variance!.operations.get!.operationPolicy.risk).toBe("read");
    expect(variance!.operations.get!.pathParams).toEqual({ budget_id: "budgetId" });
  });
});

describe("cost_budget_group resource", () => {
  it("is registered in the ccm toolset", () => {
    expect(budgetGroup).toBeDefined();
    expect(budgetGroup!.toolset).toBe("ccm");
    expect(budgetGroup!.scope).toBe("account");
    expect(budgetGroup!.identifierFields).toEqual(["budget_group_id"]);
  });

  it("exposes the full CRUD operation set", () => {
    expect(Object.keys(budgetGroup!.operations).sort()).toEqual(
      ["create", "delete", "get", "list", "update"].sort(),
    );
  });

  it("maps operations to the budgetGroups endpoints", () => {
    expect(budgetGroup!.operations.list).toMatchObject({ method: "GET", path: "/ccm/api/budgetGroups" });
    expect(budgetGroup!.operations.get).toMatchObject({ method: "GET", path: "/ccm/api/budgetGroups/{budgetGroupId}" });
    expect(budgetGroup!.operations.create).toMatchObject({ method: "POST", path: "/ccm/api/budgetGroups" });
    expect(budgetGroup!.operations.update).toMatchObject({ method: "PUT", path: "/ccm/api/budgetGroups/{budgetGroupId}" });
    expect(budgetGroup!.operations.delete).toMatchObject({ method: "DELETE", path: "/ccm/api/budgetGroups/{budgetGroupId}" });
  });

  it("classifies write risk and injects accountId on create", () => {
    expect(budgetGroup!.operations.create!.operationPolicy.risk).toBe("low_write");
    expect(budgetGroup!.operations.update!.operationPolicy.risk).toBe("low_write");
    expect(budgetGroup!.operations.delete!.operationPolicy.risk).toBe("destructive");
    expect(budgetGroup!.operations.create!.injectAccountInBody).toBe("accountId");
    const body = { name: "Eng Group", budgetGroupAmount: 5000 };
    expect(budgetGroup!.operations.create!.bodyBuilder!({ body })).toEqual(body);
  });
});
