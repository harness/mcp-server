import { describe, expect, it } from "vitest";
import { triggerListExtract } from "../../src/registry/extractors.js";

describe("triggerListExtract", () => {
  it("injects pipeline_id from input into each item", () => {
    const raw = {
      data: {
        content: [{ identifier: "cron-trigger", name: "Cron", type: "Scheduled" }],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "parent-pipe" })).toEqual({
      items: [
        {
          identifier: "cron-trigger",
          name: "Cron",
          type: "Scheduled",
          pipeline_id: "parent-pipe",
        },
      ],
      total: 1,
    });
  });

  it("prefers item.pipelineIdentifier over input pipeline_id", () => {
    const raw = {
      data: {
        content: [
          {
            identifier: "cron-trigger",
            pipelineIdentifier: "from-item",
          },
        ],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "from-input" }).items[0]).toEqual({
      identifier: "cron-trigger",
      pipelineIdentifier: "from-item",
      pipeline_id: "from-item",
    });
  });

  it("re-injects when pipeline_id is a non-scalar placeholder", () => {
    const raw = {
      data: {
        content: [
          {
            identifier: "cron-trigger",
            pipeline_id: { nested: "ignored" },
            pipelineIdentifier: "from-item",
          },
        ],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "from-input" }).items[0]).toEqual({
      identifier: "cron-trigger",
      pipeline_id: "from-item",
      pipelineIdentifier: "from-item",
    });
  });

  it("does not overwrite an existing scalar pipeline_id", () => {
    const raw = {
      data: {
        content: [
          {
            identifier: "cron-trigger",
            pipeline_id: "kept",
            pipelineIdentifier: "ignored",
          },
        ],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "from-input" }).items[0]).toEqual({
      identifier: "cron-trigger",
      pipeline_id: "kept",
      pipelineIdentifier: "ignored",
    });
  });

  it("treats empty pipelineIdentifier as missing and falls back to input", () => {
    const raw = {
      data: {
        content: [{ identifier: "cron-trigger", pipelineIdentifier: "" }],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "parent-pipe" }).items[0]).toEqual({
      identifier: "cron-trigger",
      pipelineIdentifier: "",
      pipeline_id: "parent-pipe",
    });
  });

  it("treats empty input pipeline_id as missing", () => {
    const raw = {
      data: {
        content: [{ identifier: "cron-trigger" }],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "" })).toEqual({
      items: [{ identifier: "cron-trigger" }],
      total: 1,
    });
  });

  it("returns the page unchanged when no pipeline id source is available", () => {
    const raw = {
      data: {
        content: [{ identifier: "cron-trigger" }],
        totalElements: 1,
      },
    };
    expect(triggerListExtract(raw, {})).toEqual({
      items: [{ identifier: "cron-trigger" }],
      total: 1,
    });
  });

  it("handles the empty envelope", () => {
    expect(triggerListExtract({}, { pipeline_id: "parent-pipe" })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("passes through non-object items unchanged", () => {
    const raw = {
      data: {
        content: [null, "bad-row", 42],
        totalElements: 3,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "parent-pipe" })).toEqual({
      items: [null, "bad-row", 42],
      total: 3,
    });
  });

  it("injects pipeline_id for every item in a multi-item page", () => {
    const raw = {
      data: {
        content: [
          { identifier: "trigger-a" },
          { identifier: "trigger-b", pipelineIdentifier: "other-pipe" },
        ],
        totalElements: 2,
      },
    };
    expect(triggerListExtract(raw, { pipeline_id: "parent-pipe" }).items).toEqual([
      { identifier: "trigger-a", pipeline_id: "parent-pipe" },
      { identifier: "trigger-b", pipelineIdentifier: "other-pipe", pipeline_id: "other-pipe" },
    ]);
  });
});
