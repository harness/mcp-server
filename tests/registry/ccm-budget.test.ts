/**
 * Unit tests for the CCM cost_budget resource registration and bodyBuilders.
 * Guards the public contract of the budget CRUD + clone + bulk_delete tools.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import { ccmBudgetWriteExtract, ccmBudgetListCompactExtract, ccmBudgetDetailExtract } from "../../src/registry/extractors.js";

const budget = ccmToolset.resources.find((r) => r.resourceType === "cost_budget");
const variance = ccmToolset.resources.find((r) => r.resourceType === "cost_budget_variance");
const budgetGroup = ccmToolset.resources.find((r) => r.resourceType === "cost_budget_group");

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

  it("uses ccmBudgetDetailExtract to derive period-by-period variance from budgetHistory", () => {
    expect(variance!.operations.get!.responseExtractor).toBe(ccmBudgetDetailExtract);
  });
});

describe("cost_budget list extractor wiring", () => {
  it("uses ccmBudgetListCompactExtract to strip PII and noise from list responses", () => {
    expect(budget!.operations.list!.responseExtractor).toBe(ccmBudgetListCompactExtract);
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
