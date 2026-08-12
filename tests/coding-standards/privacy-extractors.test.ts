/**
 * Privacy rules from docs/coding-standards.md §9 — list responses must not
 * expose notification contact details when compact extractors document stripping.
 */
import { describe, it, expect } from "vitest";
import { ccmBudgetListCompactExtract } from "../../src/registry/extractors.js";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

describe("Coding standards — privacy in list extractors", () => {
  it("ccmBudgetListCompactExtract strips alertThresholds and top-level emailAddresses", () => {
    const raw = {
      data: {
        summaries: [
          {
            uuid: "budget-1",
            name: "Q1 Budget",
            budgetAmount: 1000,
            actualCost: 500,
            alertThresholds: [{ percentage: 80, emailAddresses: ["user@example.com"] }],
            emailAddresses: ["notify@example.com"],
            slackWebhooks: ["https://hooks.slack.com/services/secret"],
          },
        ],
        totalCount: 1,
      },
    };

    const { items } = ccmBudgetListCompactExtract(raw);
    expect(items).toHaveLength(1);
    const item = items[0] as Record<string, unknown>;
    expect(item).not.toHaveProperty("alertThresholds");
    expect(item).not.toHaveProperty("emailAddresses");
    expect(item).not.toHaveProperty("slackWebhooks");
    expect(item.name).toBe("Q1 Budget");
  });

  it("cost_budget list operation uses ccmBudgetListCompactExtract (not raw ngExtract)", () => {
    const budget = ccmToolset.resources.find((r) => r.resourceType === "cost_budget");
    expect(budget?.operations.list?.responseExtractor).toBe(ccmBudgetListCompactExtract);
  });
});
