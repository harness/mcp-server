/**
 * cost_category create/update: EQUALS conditions are sent as IN, and bodies without
 * EQUALS reach the API exactly as the caller sent them.
 */
import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { normalizeCostCategoryBody } from "../../src/registry/toolsets/ccm-cost-category.js";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

const costCategory = ccmToolset.resources.find((r) => r.resourceType === "cost_category");
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("cost_category operationPolicy", () => {
  it("classifies create/update as medium_write and delete as destructive", () => {
    expect(costCategory).toBeDefined();
    expect(costCategory!.operations.create!.operationPolicy.risk).toBe("medium_write");
    expect(costCategory!.operations.update!.operationPolicy.risk).toBe("medium_write");
    expect(costCategory!.operations.delete!.operationPolicy.risk).toBe("destructive");
    expect(costCategory!.operations.list!.operationPolicy.risk).toBe("read");
    expect(costCategory!.operations.get!.operationPolicy.risk).toBe("read");
  });
});

describe("cost category rules — EQUALS is sent as IN", () => {
  const viewField = { fieldId: "labels.value", fieldName: "env", identifier: "LABEL_V2", identifierName: "Label V2" };
  const condition = (viewOperator: string, values: string[]) => ({
    type: "VIEW_ID_CONDITION",
    viewField,
    viewOperator,
    values,
  });
  const bucket = (name: string, ...conditions: ReturnType<typeof condition>[]) => ({
    name,
    rules: [{ viewConditions: conditions }],
  });

  async function dispatchBody(operation: "create" | "update", body: Record<string, unknown>) {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    await registry.dispatch(makeClient(mockRequest), "cost_category", operation, { body });
    expect(mockRequest).toHaveBeenCalledOnce();
    return mockRequest.mock.calls[0][0].body;
  }

  it.each(["create", "update"] as const)("%s rewrites single- and multi-value EQUALS to IN, keeping values", async (operation) => {
    const sent = await dispatchBody(operation, {
      uuid: "category-1",
      name: "Environments",
      costTargets: [
        bucket("Single", condition("EQUALS", ["xyz"])),
        bucket("Multi", condition("EQUALS", ["xyz", "abc"])),
      ],
      sharedCosts: [{ ...bucket("Platform", condition("EQUALS", ["shared"])), strategy: "PROPORTIONAL" }],
      unallocatedCost: { strategy: "HIDE" },
    });

    expect(sent.costTargets[0].rules[0].viewConditions[0]).toEqual(condition("IN", ["xyz"]));
    expect(sent.costTargets[1].rules[0].viewConditions[0]).toEqual(condition("IN", ["xyz", "abc"]));
    expect(sent.sharedCosts[0].rules[0].viewConditions[0]).toEqual(condition("IN", ["shared"]));
    expect(sent.sharedCosts[0].strategy).toBe("PROPORTIONAL");
    expect(sent.unallocatedCost).toEqual({ strategy: "HIDE" });
  });

  it("leaves other operators unchanged and only rewrites EQUALS within a mixed rule", async () => {
    const sent = await dispatchBody("create", {
      name: "Mixed",
      costTargets: [
        bucket(
          "Prod",
          condition("IN", ["prod"]),
          condition("NOT_IN", ["sandbox"]),
          condition("LIKE", ["prod-"]),
          condition("NOT_NULL", [""]),
          condition("NULL", [""]),
          condition("EQUALS", ["xyz"]),
        ),
      ],
    });

    expect(sent.costTargets[0].rules[0].viewConditions.map((c: { viewOperator: string }) => c.viewOperator)).toEqual([
      "IN",
      "NOT_IN",
      "LIKE",
      "NOT_NULL",
      "NULL",
      "IN",
    ]);
  });

  it("passes bodies without rules through untouched", async () => {
    const sent = await dispatchBody("create", {
      name: "Engineering",
      costTargets: [{ name: "Development", rules: [] }],
    });

    expect(sent.costTargets).toEqual([{ name: "Development", rules: [] }]);
  });

  it("documents IN-only operators and the equals-to-IN mapping on the write schema", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const ops = registry.getResource("cost_category").operations;
    for (const op of [ops.create, ops.update]) {
      for (const field of op!.bodySchema!.fields.filter((f) => f.name === "costTargets" || f.name === "sharedCosts")) {
        expect(field.itemType).toContain("viewOperator: 'IN' | 'NOT_IN' | 'LIKE' | 'NOT_NULL' | 'NULL'");
        expect(field.itemType).not.toContain("EQUALS");
        expect(field.description).toContain("'equals xyz or abc' -> values ['xyz', 'abc']");
        expect(field.description).toContain("Never use EQUALS");
      }
    }
  });
});

describe("cost category normalizer without EQUALS — bodies unchanged", () => {
  const labelField = { fieldId: "labels.value", fieldName: "team", identifier: "LABEL_V2", identifierName: "Label V2" };
  const awsAccountField = { fieldId: "awsUsageaccountid", fieldName: "Account", identifier: "AWS", identifierName: "AWS" };
  const clusterField = { fieldId: "clusterName", fieldName: "Cluster Name", identifier: "CLUSTER", identifierName: "Cluster" };
  const productField = { fieldId: "product", fieldName: "Product", identifier: "COMMON", identifierName: "Common" };
  const nestedCategoryField = { fieldId: "cc-1", fieldName: "Business Units", identifier: "BUSINESS_MAPPING", identifierName: "Cost Categories" };
  const condition = (viewField: Record<string, string>, viewOperator: string, values: string[]) => ({
    type: "VIEW_ID_CONDITION",
    viewField,
    viewOperator,
    values,
  });

  /** Shaped like a harness_get response that the agent edits and sends back on update. */
  const existingCategory = () => ({
    uuid: "category-1",
    accountId: "test-account",
    name: "Teams",
    costTargets: [
      {
        name: "Payments",
        rules: [
          { viewConditions: [condition(labelField, "IN", ["payments", "billing"])] },
          {
            viewConditions: [
              condition(awsAccountField, "IN", ["111111111111"]),
              condition(productField, "NOT_IN", ["Amazon CloudWatch"]),
            ],
          },
        ],
      },
      { name: "Platform", rules: [{ viewConditions: [condition(clusterField, "LIKE", ["platform-"])] }] },
      { name: "Untagged", rules: [{ viewConditions: [condition(labelField, "NULL", [""])] }] },
      { name: "Tagged", rules: [{ viewConditions: [condition(labelField, "NOT_NULL", [""])] }] },
      { name: "From parent category", rules: [{ viewConditions: [condition(nestedCategoryField, "IN", ["Engineering"])] }] },
    ],
    sharedCosts: [
      {
        name: "Shared infra",
        rules: [{ viewConditions: [condition(labelField, "IN", ["shared"])] }],
        strategy: "PROPORTIONAL",
        splits: [],
      },
      {
        name: "Support",
        rules: [{ viewConditions: [condition(productField, "IN", ["AWS Support (Business)"])] }],
        strategy: "FIXED",
        splits: [
          { costTargetName: "Payments", percentageContribution: 60 },
          { costTargetName: "Platform", percentageContribution: 40 },
        ],
      },
    ],
    unallocatedCost: { strategy: "DISPLAY_NAME", label: "Unattributed", sharingStrategy: null, splits: null },
    dataSources: ["AWS", "CLUSTER"],
    createdAt: 1760000000000,
    lastUpdatedAt: 1760500000000,
    createdBy: { uuid: "user-1", name: "FinOps", email: "finops@example.com" },
    lastUpdatedBy: { uuid: "user-1", name: "FinOps", email: "finops@example.com" },
  });

  const createBodyOf = () => (({ uuid, accountId, ...rest }) => rest)(existingCategory());

  /** Without EQUALS the normalizer must return a body identical to its input, key order included. */
  function expectUnchanged(body: unknown) {
    const input = structuredClone(body);
    const output = normalizeCostCategoryBody(input);
    expect(output).toEqual(body);
    expect(JSON.stringify(output)).toBe(JSON.stringify(body));
    expect(input).toEqual(body); // input not mutated
  }

  it.each([
    ["create body", createBodyOf()],
    ["update body", existingCategory()],
  ])("normalizer leaves a %s without EQUALS unchanged", (_label, body) => {
    expectUnchanged(body);
  });

  it.each([
    ["no sharedCosts or unallocatedCost", { name: "Minimal", costTargets: [{ name: "A", rules: [] }] }],
    ["null sharedCosts", { name: "Nulls", costTargets: [{ name: "A", rules: [] }], sharedCosts: null }],
    ["bucket without rules", { name: "No rules", costTargets: [{ name: "A" }] }],
    ["rule without viewConditions", { name: "Empty rule", costTargets: [{ name: "A", rules: [{}] }] }],
    ["null rule and condition entries", { name: "Sparse", costTargets: [{ name: "A", rules: [null, { viewConditions: [null] }] }] }],
    ["condition without viewOperator", { name: "Partial", costTargets: [{ name: "A", rules: [{ viewConditions: [{ type: "VIEW_ID_CONDITION", values: ["x"] }] }] }] }],
    ["lowercase equals (not the enum value)", { name: "Case", costTargets: [{ name: "A", rules: [{ viewConditions: [condition(labelField, "equals", ["x"])] }] }] }],
  ])("normalizer passes edge-case bodies through as before: %s", (_label, body) => {
    expectUnchanged(body);
  });

  it.each([undefined, null, "text", 42, [1, 2]])("normalizer returns non-object body %j as is", (body) => {
    expect(normalizeCostCategoryBody(body)).toBe(body);
  });

  it("normalizer rewrites EQUALS without mutating its input", () => {
    const input = { name: "X", costTargets: [{ name: "A", rules: [{ viewConditions: [condition(labelField, "EQUALS", ["x"])] }] }] };
    const snapshot = structuredClone(input);
    const output = normalizeCostCategoryBody(input) as typeof input;
    expect(output.costTargets[0].rules[0].viewConditions[0].viewOperator).toBe("IN");
    expect(input).toEqual(snapshot);
  });

  it.each(["create", "update"] as const)("%s dispatch wires the normalizer and injects accountId", async (operation) => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    const { accountId: _accountId, ...rest } = existingCategory();
    const body = { ...rest, costTargets: [{ name: "Eq", rules: [{ viewConditions: [condition(labelField, "EQUALS", ["x"])] }] }] };

    await registry.dispatch(makeClient(mockRequest), "cost_category", operation, { body });

    expect(mockRequest).toHaveBeenCalledOnce();
    const sent = mockRequest.mock.calls[0][0].body;
    expect(sent.costTargets[0].rules[0].viewConditions[0].viewOperator).toBe("IN");
    expect(sent.accountId).toBe("test-account");
  });

  it("update keeps an existing accountId", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    const body = { ...existingCategory(), accountId: "category-owner-account" };
    await registry.dispatch(makeClient(mockRequest), "cost_category", "update", { body });
    expect(mockRequest.mock.calls[0][0].body.accountId).toBe("category-owner-account");
  });

  it.each(["get", "list", "delete"] as const)("%s has no bodyBuilder (untouched by normalization)", (operation) => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    const spec = registry.getResource("cost_category").operations[operation];
    expect(spec).toBeDefined();
    expect(spec!.bodyBuilder).toBeUndefined();
  });
});
