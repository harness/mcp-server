/**
 * Unit tests for the CCM cost_budget resource registration and bodyBuilders.
 * Guards the public contract of the budget CRUD + clone + bulk_delete tools.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

const budget = ccmToolset.resources.find((r) => r.resourceType === "cost_budget");

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
    expect(budget!.operations.list).toMatchObject({ method: "GET", path: "/ccm/api/budgets" });
    expect(budget!.operations.get).toMatchObject({ method: "GET", path: "/ccm/api/budgets/{budgetId}" });
    expect(budget!.operations.create).toMatchObject({ method: "POST", path: "/ccm/api/budgets" });
    expect(budget!.operations.update).toMatchObject({ method: "PUT", path: "/ccm/api/budgets/{budgetId}" });
    expect(budget!.operations.delete).toMatchObject({ method: "DELETE", path: "/ccm/api/budgets/{budgetId}" });
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
