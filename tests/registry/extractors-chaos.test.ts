import { describe, expect, it } from "vitest";
import {
  chaosDRTestListExtract,
  chaosGuardConditionListExtract,
  chaosGuardRuleListExtract,
  chaosRecommendationListExtract,
} from "../../src/registry/extractors.js";

describe("chaosGuardConditionListExtract", () => {
  it("extracts conditions and total from the ChaosGuard conditions envelope", () => {
    const raw = {
      conditions: [
        { conditionId: "cond-1", name: "Block prod" },
        { conditionId: "cond-2", name: "Require probes" },
      ],
      pagination: { totalItems: 12 },
    };

    expect(chaosGuardConditionListExtract(raw)).toEqual({
      items: [
        { conditionId: "cond-1", name: "Block prod" },
        { conditionId: "cond-2", name: "Require probes" },
      ],
      total: 12,
    });
  });
});

describe("chaosGuardRuleListExtract", () => {
  it("extracts rules and total from the ChaosGuard rules envelope", () => {
    const raw = {
      rules: [
        { ruleId: "rule-1", name: "Business hours", isEnabled: true },
      ],
      pagination: { totalItems: 7 },
    };

    expect(chaosGuardRuleListExtract(raw)).toEqual({
      items: [{ ruleId: "rule-1", name: "Business hours", isEnabled: true }],
      total: 7,
    });
  });
});

describe("chaosRecommendationListExtract", () => {
  it("extracts recommendations and total from the recommendations envelope", () => {
    const raw = {
      recommendations: [
        { recommendationID: "rec-1", recommendationCategory: "FAULT" },
      ],
      pagination: { totalItems: 3 },
    };

    expect(chaosRecommendationListExtract(raw)).toEqual({
      items: [{ recommendationID: "rec-1", recommendationCategory: "FAULT" }],
      total: 3,
    });
  });
});

describe("chaosDRTestListExtract", () => {
  it("extracts drtests and total from the Chaos DR tests envelope", () => {
    const raw = {
      drtests: [
        { identity: "dr-1", name: "Region-A failover" },
        { identity: "dr-2", name: "DB fence drill" },
      ],
      pagination: { totalItems: 27 },
    };

    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [
        { identity: "dr-1", name: "Region-A failover" },
        { identity: "dr-2", name: "DB fence drill" },
      ],
      total: 27,
    });
  });

  it("falls back to items.length when pagination.totalItems is missing", () => {
    const raw = {
      drtests: [{ identity: "dr-only" }],
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ identity: "dr-only" }],
      total: 1,
    });
  });

  it("returns empty items and total=0 when the envelope is empty", () => {
    expect(chaosDRTestListExtract({})).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ drtests: [] })).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ drtests: [], pagination: { totalItems: 0 } })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("prefers pagination.totalItems over items.length when both are present", () => {
    const raw = {
      drtests: [{ identity: "dr-1" }, { identity: "dr-2" }],
      pagination: { totalItems: 50 },
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ identity: "dr-1" }, { identity: "dr-2" }],
      total: 50,
    });
  });
});
