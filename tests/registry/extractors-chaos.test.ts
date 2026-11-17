import { describe, expect, it } from "vitest";
import {
  chaosActionExtract,
  chaosDashboardListExtract,
  chaosDRTestListExtract,
  chaosExperimentListExtract,
  chaosHarConvertExtract,
  chaosGuardConditionListExtract,
  chaosGuardRuleListExtract,
  chaosInputSetListExtract,
  chaosOnboardingListExtract,
  chaosPipelineOnboardingListExtract,
} from "../../src/registry/extractors.js";

describe("chaosHarConvertExtract", () => {
  it("decodes scriptContent into a plain-text script and drops the base64 field", () => {
    const script = "print('héllo')\n";
    expect(
      chaosHarConvertExtract({
        toolType: "Locust",
        scriptContent: Buffer.from(script, "utf8").toString("base64"),
        fileName: "recorded-flow.py",
      }),
    ).toEqual({ toolType: "Locust", fileName: "recorded-flow.py", script });
  });

  it("passes through payloads without scriptContent (e.g. error bodies)", () => {
    const err = { error: "bad har" };
    expect(chaosHarConvertExtract(err)).toBe(err);
    expect(chaosHarConvertExtract(null)).toBeNull();
  });
});

describe("chaosInputSetListExtract", () => {
  it("injects experimentId from input into each item", () => {
    const raw = { data: [{ identity: "is-1", name: "Set A" }], pagination: { totalItems: 1 } };
    expect(chaosInputSetListExtract(raw, { experiment_id: "exp-uuid" })).toEqual({
      items: [{ identity: "is-1", name: "Set A", experimentId: "exp-uuid" }],
      total: 1,
    });
  });

  it("does not overwrite an existing experimentId", () => {
    const raw = { data: [{ identity: "is-1", experimentId: "kept" }] };
    expect(chaosInputSetListExtract(raw, { experiment_id: "exp-uuid" }).items[0]).toEqual({
      identity: "is-1",
      experimentId: "kept",
    });
  });

  it("returns the page unchanged when experiment_id is absent", () => {
    const raw = { data: [{ identity: "is-1" }], pagination: { totalItems: 1 } };
    expect(chaosInputSetListExtract(raw, {})).toEqual({ items: [{ identity: "is-1" }], total: 1 });
  });

  it("handles the empty envelope", () => {
    expect(chaosInputSetListExtract({}, { experiment_id: "exp-uuid" })).toEqual({ items: [], total: 0 });
  });
});

describe("chaosExperimentListExtract", () => {
  it("mirrors experimentID to experimentId and preserves other fields", () => {
    const raw = { data: [{ experimentID: "uuid-1", name: "exp-a" }], pagination: { totalItems: 5 } };
    expect(chaosExperimentListExtract(raw)).toEqual({
      items: [{ experimentID: "uuid-1", name: "exp-a", experimentId: "uuid-1" }],
      total: 5,
    });
  });

  it("does not overwrite an existing experimentId", () => {
    const raw = { data: [{ experimentID: "uuid-1", experimentId: "kept" }] };
    expect(chaosExperimentListExtract(raw).items[0]).toEqual({ experimentID: "uuid-1", experimentId: "kept" });
  });

  it("leaves items without experimentID untouched", () => {
    const raw = { data: [{ name: "no-id" }], pagination: { totalItems: 1 } };
    expect(chaosExperimentListExtract(raw)).toEqual({ items: [{ name: "no-id" }], total: 1 });
  });

  it("handles the empty envelope", () => {
    expect(chaosExperimentListExtract({})).toEqual({ items: [], total: 0 });
    expect(chaosExperimentListExtract({ data: [] })).toEqual({ items: [], total: 0 });
  });
});

describe("chaosDRTestListExtract", () => {
  it("extracts items and total from the new {items, pagination.totalItems} envelope", () => {
    const raw = {
      items: [
        { id: "dr-1", name: "Region-A failover" },
        { id: "dr-2", name: "DB fence drill" },
      ],
      pagination: { totalItems: 27 },
    };

    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [
        { id: "dr-1", name: "Region-A failover" },
        { id: "dr-2", name: "DB fence drill" },
      ],
      total: 27,
    });
  });

  it("falls back to items.length when pagination.totalItems is missing", () => {
    const raw = {
      items: [{ id: "dr-only" }],
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ id: "dr-only" }],
      total: 1,
    });
  });

  it("returns empty items and total=0 when the envelope is empty", () => {
    expect(chaosDRTestListExtract({})).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ items: [] })).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ items: [], pagination: { totalItems: 0 } })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("prefers pagination.totalItems over items.length when both are present", () => {
    const raw = {
      items: [{ id: "dr-1" }, { id: "dr-2" }],
      pagination: { totalItems: 50 },
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ id: "dr-1" }, { id: "dr-2" }],
      total: 50,
    });
  });
});

describe("chaosGuard list extractors", () => {
  it("reads conditions and ignores a data array", () => {
    expect(chaosGuardConditionListExtract({
      data: [{ conditionId: "from-data" }],
      conditions: [{ conditionId: "c1" }],
      pagination: { totalItems: 4 },
    })).toEqual({ items: [{ conditionId: "c1" }], total: 4 });
  });

  it("reads rules", () => {
    expect(chaosGuardRuleListExtract({
      rules: [{ ruleId: "r1" }],
      pagination: { totalItems: 1 },
    })).toEqual({ items: [{ ruleId: "r1" }], total: 1 });
  });

  it("returns an empty list when the named array is missing", () => {
    expect(chaosGuardConditionListExtract({ pagination: { totalItems: 3 } })).toEqual({ items: [], total: 3 });
    expect(chaosGuardRuleListExtract({})).toEqual({ items: [], total: 0 });
  });
});

describe("chaos onboarding list extractors", () => {
  it("reads onboarding rows and total from data and page", () => {
    expect(chaosOnboardingListExtract({
      data: [{ onboardingID: "ob-1", environmentRef: "org.env" }],
      page: { totalItems: 3 },
    })).toEqual({
      items: [{ onboardingID: "ob-1", environmentRef: "org.env" }],
      total: 3,
    });
  });

  it("reads pipelineOnboardings without a data envelope", () => {
    expect(chaosPipelineOnboardingListExtract({
      data: [{ pipelineIdentity: "wrong" }],
      pipelineOnboardings: [{ pipelineIdentity: "pipe-1" }],
    })).toEqual({
      items: [{ pipelineIdentity: "pipe-1" }],
      total: 1,
    });
  });
});

describe("chaos v3 list extractors", () => {
  it("preserves dashboard counts outside the data array", () => {
    expect(chaosDashboardListExtract({
      data: [{ identity: "coverage" }],
      pagination: { totalItems: 4 },
      counts: { all: 4, favourites: 1 },
    })).toEqual({
      items: [{ identity: "coverage" }],
      total: 4,
      counts: { all: 4, favourites: 1 },
    });
  });
});

describe("chaosActionExtract", () => {
  it("projects documented fields, drops unknown envelope keys", () => {
    const out = chaosActionExtract({
      identity: "a1", name: "A1", type: "delay", infrastructureType: "Kubernetes",
      actionProperties: { delayAction: { duration: "5s" } }, variables: [], inputs: [],
      audit: { createdBy: "x" }, isRemoved: false, recentExecutions: [],
    }) as Record<string, unknown>;
    expect(out.identity).toBe("a1");
    expect(out.actionProperties).toEqual({ delayAction: { duration: "5s" } });
    expect(out).not.toHaveProperty("audit");
    expect(out).not.toHaveProperty("isRemoved");
    expect(out).not.toHaveProperty("recentExecutions");
  });
});
