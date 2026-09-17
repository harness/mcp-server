/**
 * Unit tests for CCM AI Budget (Lightwing AI governance) resource registration.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import type { PathBuilderConfig } from "../../src/registry/types.js";
import {
  lwResponseExtract,
  lwPaginatedExtract,
  aiBudgetConsumptionExtract,
  aiBudgetOverrideRequestListExtract,
} from "../../src/registry/extractors.js";

const config: PathBuilderConfig = {
  HARNESS_ACCOUNT_ID: "acct-1",
  HARNESS_ORG: "default",
  HARNESS_PROJECT: "proj",
};

const aiBudget = ccmToolset.resources.find((r) => r.resourceType === "ai_budget");
const aiOverview = ccmToolset.resources.find((r) => r.resourceType === "ai_budget_overview");
const aiConsumption = ccmToolset.resources.find((r) => r.resourceType === "ai_budget_consumption");
const aiOverride = ccmToolset.resources.find((r) => r.resourceType === "ai_budget_override_request");

describe("ai_budget resource", () => {
  it("is registered in the ccm toolset", () => {
    expect(aiBudget).toBeDefined();
    expect(aiBudget!.toolset).toBe("ccm");
    expect(aiBudget!.scope).toBe("account");
    expect(aiBudget!.identifierFields).toEqual(["budget_id"]);
    expect(aiBudget!.deepLinkTemplate).toContain("user-budgets");
  });

  it("exposes full CRUD", () => {
    expect(Object.keys(aiBudget!.operations).sort()).toEqual(["create", "delete", "get", "list", "update"].sort());
  });

  it("pathBuilder resolves list and get paths under /lw/api", () => {
    const listPath = aiBudget!.operations.list!.pathBuilder!({}, config);
    expect(listPath).toBe("/lw/api/accounts/acct-1/ai-governance/policies/list");

    const getPath = aiBudget!.operations.get!.pathBuilder!({ budget_id: "bid-1" }, config);
    expect(getPath).toBe("/lw/api/accounts/acct-1/ai-governance/policies/bid-1");
  });

  it("list bodyBuilder maps search_term and folder_id", () => {
    const builder = aiBudget!.operations.list!.bodyBuilder!;
    expect(builder({ search_term: "prod", page: 0, size: 25 })).toMatchObject({
      query: "prod",
      page: 0,
      limit: 25,
    });
    expect(builder({ folder_id: "fld-1" }).filters).toEqual([
      { field: "folder_id", operator: "equals", values: ["fld-1"] },
    ]);
  });

  it("classifies write risks", () => {
    expect(aiBudget!.operations.create!.operationPolicy.risk).toBe("medium_write");
    expect(aiBudget!.operations.update!.operationPolicy.risk).toBe("medium_write");
    expect(aiBudget!.operations.delete!.operationPolicy.risk).toBe("destructive");
    expect(aiBudget!.operations.list!.operationPolicy.risk).toBe("read");
  });

  it("uses lw extractors", () => {
    expect(aiBudget!.operations.list!.responseExtractor).toBe(lwPaginatedExtract);
    expect(aiBudget!.operations.get!.responseExtractor).toBe(lwResponseExtract);
  });
});

describe("ai_budget_overview", () => {
  it("get path includes overview", () => {
    const path = aiOverview!.operations.get!.pathBuilder!({ budget_id: "x" }, config);
    expect(path).toBe("/lw/api/accounts/acct-1/ai-governance/policies/x/overview");
  });
});

describe("ai_budget_consumption", () => {
  it("lists me/budgets via GET", () => {
    expect(aiConsumption!.operations.list!.method).toBe("GET");
    const path = aiConsumption!.operations.list!.pathBuilder!({}, config);
    expect(path).toBe("/lw/api/accounts/acct-1/ai-governance/me/budgets");
    expect(aiConsumption!.operations.list!.responseExtractor).toBe(aiBudgetConsumptionExtract);
  });
});

describe("ai_budget_override_request", () => {
  it("list path switches on budget_id", () => {
    const myPath = aiOverride!.operations.list!.pathBuilder!({}, config);
    expect(myPath).toBe("/lw/api/accounts/acct-1/ai-governance/me/budgets/override/requests");

    const adminPath = aiOverride!.operations.list!.pathBuilder!({ budget_id: "p1" }, config);
    expect(adminPath).toBe("/lw/api/accounts/acct-1/ai-governance/policies/p1/override/requests");
  });

  it("create maps budget_id to policy_id", () => {
    const body = aiOverride!.operations.create!.bodyBuilder!({
      body: { budget_id: "p1", amount: 125, reason: "spike" },
    });
    expect(body).toEqual({ policy_id: "p1", amount: 125, reason: "spike" });
  });

  it("get path includes request id", () => {
    const path = aiOverride!.operations.get!.pathBuilder!(
      { budget_id: "p1", override_request_id: "req-1" },
      config,
    );
    expect(path).toBe("/lw/api/accounts/acct-1/ai-governance/policies/p1/override/requests/req-1");
  });

  it("approve and reject build review items", () => {
    const approve = aiOverride!.executeActions!.approve!.bodyBuilder!({
      budget_id: "p1",
      override_request_id: "r1",
      approved_amount: 900,
    });
    expect(approve).toEqual({
      items: [{ request_id: "r1", action: "approve", approved_amount: 900 }],
    });

    const reject = aiOverride!.executeActions!.reject!.bodyBuilder!({
      override_request_id: "r2",
    });
    expect(reject).toEqual({ items: [{ request_id: "r2", action: "reject" }] });

    const batch = aiOverride!.executeActions!.approve!.bodyBuilder!({
      body: { items: [{ request_id: "a", action: "approve" }] },
    });
    expect(batch).toEqual({ items: [{ request_id: "a", action: "approve" }] });
  });

  it("review actions use high_write and review path", () => {
    expect(aiOverride!.executeActions!.approve!.operationPolicy.risk).toBe("high_write");
    const path = aiOverride!.executeActions!.approve!.pathBuilder!({ budget_id: "p1" }, config);
    expect(path).toBe("/lw/api/accounts/acct-1/ai-governance/policies/p1/override/requests/review");
  });
});

describe("lw extractors", () => {
  it("lwResponseExtract unwraps response", () => {
    expect(lwResponseExtract({ success: true, response: { id: "1" } })).toEqual({ id: "1" });
  });

  it("lwPaginatedExtract reads items/total", () => {
    expect(lwPaginatedExtract({ response: { items: [1, 2], total: 2 } })).toEqual({
      items: [1, 2],
      total: 2,
    });
  });

  it("aiBudgetConsumptionExtract maps budgets to items", () => {
    expect(
      aiBudgetConsumptionExtract({ response: { subjectId: "u1", budgets: [{ policyId: "p" }] } }),
    ).toMatchObject({ items: [{ policyId: "p" }], total: 1, subjectId: "u1" });
  });

  it("aiBudgetOverrideRequestListExtract handles admin inbox shape", () => {
    expect(
      aiBudgetOverrideRequestListExtract({
        response: { requests: [{ id: "r" }], total: 1, pages: 1, history: [] },
      }),
    ).toMatchObject({ items: [{ id: "r" }], total: 1 });
  });
});
