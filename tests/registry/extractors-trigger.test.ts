import { describe, expect, it } from "vitest";
import { triggerListExtract } from "../../src/registry/extractors.js";

describe("triggerListExtract", () => {
  const pageEnvelope = (items: unknown[]) => ({
    data: { content: items, totalElements: items.length },
  });

  it("injects pipeline_id from list filter input for deep links", () => {
    const raw = pageEnvelope([
      { identifier: "cron_trigger", name: "Daily", type: "Scheduled" },
    ]);
    expect(triggerListExtract(raw, { pipeline_id: "deploy_pipe" })).toEqual({
      items: [
        {
          identifier: "cron_trigger",
          name: "Daily",
          type: "Scheduled",
          pipeline_id: "deploy_pipe",
        },
      ],
      total: 1,
    });
  });

  it("prefers item.pipelineIdentifier over request pipeline_id", () => {
    const raw = pageEnvelope([
      {
        identifier: "cron_trigger",
        pipelineIdentifier: "from_item",
      },
    ]);
    const result = triggerListExtract(raw, { pipeline_id: "from_input" });
    expect(result.items[0]).toMatchObject({ pipeline_id: "from_item" });
  });

  it("does not overwrite an existing pipeline_id on the item", () => {
    const raw = pageEnvelope([
      {
        identifier: "cron_trigger",
        pipeline_id: "kept",
        pipelineIdentifier: "ignored",
      },
    ]);
    const result = triggerListExtract(raw, { pipeline_id: "from_input" });
    expect(result.items[0]).toMatchObject({ pipeline_id: "kept" });
  });

  it("does not confuse trigger identifier with pipeline_id", () => {
    const raw = pageEnvelope([{ identifier: "trigger_only_id", name: "Webhook" }]);
    const result = triggerListExtract(raw, { pipeline_id: "parent_pipeline" }).items[0] as Record<
      string,
      unknown
    >;
    expect(result.pipeline_id).toBe("parent_pipeline");
    expect(result.identifier).toBe("trigger_only_id");
  });

  it("skips injection when pipeline_id filter is empty", () => {
    const raw = pageEnvelope([{ identifier: "cron_trigger" }]);
    const result = triggerListExtract(raw, { pipeline_id: "" }).items[0] as Record<string, unknown>;
    expect(result).not.toHaveProperty("pipeline_id");
  });

  it("skips injection when pipelineIdentifier is empty and filter is absent", () => {
    const raw = pageEnvelope([{ identifier: "cron_trigger", pipelineIdentifier: "" }]);
    const result = triggerListExtract(raw, {}).items[0] as Record<string, unknown>;
    expect(result).not.toHaveProperty("pipeline_id");
  });

  it("handles the empty envelope", () => {
    expect(triggerListExtract({}, { pipeline_id: "pipe" })).toEqual({ items: [], total: 0 });
  });
});
