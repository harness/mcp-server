import { describe, expect, it } from "vitest";
import {
  chaosActionExtract,
  chaosDRTestListExtract,
  chaosExperimentListExtract,
  chaosInputSetListExtract,
  chaosLoadTestExtract,
  chaosLoadTestListExtract,
} from "../../src/registry/extractors.js";

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

describe("chaosLoadTestExtract", () => {
  it("mirrors identity into loadtestId and derives convenience scalars from inputs[]", () => {
    const out = chaosLoadTestExtract({
      identity: "lt-1",
      name: "load-one",
      toolType: "Locust",
      scriptContent: "BIG_BASE64_BLOB",
      createdByUserDetails: { name: "someone" },
      inputs: [
        { name: "targetUrl", value: "https://example.com" },
        { name: "targetUsers", value: 50 },
        { name: "durationSeconds", value: 300 },
        { name: "rampUpTimeSec", value: 60 },
        { name: "workerCount", value: 2 },
        { name: "scriptImage", value: "img:tag" },
        { name: "scriptEntrypoint", value: "/run.sh" },
        { name: "loadArgs", value: "--foo" },
      ],
      variables: [{ name: "env", value: "prod" }],
    }) as Record<string, unknown>;

    expect(out.loadtestId).toBe("lt-1");
    expect(out.identity).toBe("lt-1");
    expect(out.target_url).toBe("https://example.com");
    expect(out.users).toBe(50);
    expect(out.duration_sec).toBe(300);
    expect(out.ramp_up_sec).toBe(60);
    expect(out.worker_count).toBe(2);
    expect(out.script_image).toBe("img:tag");
    expect(out.script_entrypoint).toBe("/run.sh");
    expect(out.load_args).toBe("--foo");
    expect(out.inputs).toHaveLength(8);
    expect(out.variables).toEqual([{ name: "env", value: "prod" }]);
    expect(out).not.toHaveProperty("scriptContent");
    expect(out).not.toHaveProperty("createdByUserDetails");
  });

  it("returns raw unchanged for non-object values", () => {
    expect(chaosLoadTestExtract(null)).toBeNull();
    expect(chaosLoadTestExtract("bad")).toBe("bad");
    expect(chaosLoadTestExtract([])).toEqual([]);
  });

  it("leaves derived scalars undefined when inputs[] is absent", () => {
    const out = chaosLoadTestExtract({ identity: "lt-empty", name: "empty" }) as Record<string, unknown>;
    expect(out.loadtestId).toBe("lt-empty");
    expect(out.target_url).toBeUndefined();
    expect(out.users).toBeUndefined();
    expect(out.inputs).toBeUndefined();
    expect(out.variables).toBeUndefined();
  });
});

describe("chaosLoadTestListExtract", () => {
  it("projects each item and prefers pagination.totalItems", () => {
    const out = chaosLoadTestListExtract({
      items: [
        {
          identity: "lt-1",
          inputs: [{ name: "targetUsers", value: 10 }],
        },
      ],
      pagination: { totalItems: 42 },
    });

    expect(out.total).toBe(42);
    expect(out.items).toHaveLength(1);
    expect((out.items[0] as Record<string, unknown>).loadtestId).toBe("lt-1");
    expect((out.items[0] as Record<string, unknown>).users).toBe(10);
  });

  it("falls back to items.length when pagination is missing", () => {
    expect(chaosLoadTestListExtract({ items: [{ identity: "a" }, { identity: "b" }] })).toEqual({
      items: [
        expect.objectContaining({ loadtestId: "a" }),
        expect.objectContaining({ loadtestId: "b" }),
      ],
      total: 2,
    });
  });

  it("handles the empty envelope", () => {
    expect(chaosLoadTestListExtract({})).toEqual({ items: [], total: 0 });
  });
});
