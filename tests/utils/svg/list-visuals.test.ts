import { describe, it, expect } from "vitest";
import { renderListVisual } from "../../../src/utils/svg/list-visuals.js";

const sampleItems = [
  { planExecutionId: "e1", pipelineIdentifier: "build", status: "Success", startTs: Date.now() - 86400000 },
  { planExecutionId: "e2", pipelineIdentifier: "deploy", status: "Failed", startTs: Date.now() - 43200000 },
  { planExecutionId: "e3", pipelineIdentifier: "build", status: "Errored", startTs: Date.now() - 3600000 },
  { planExecutionId: "e4", pipelineIdentifier: "test", status: "Running", startTs: Date.now() },
  { planExecutionId: "e5", pipelineIdentifier: "legacy", status: "Aborted", startTs: Date.now() - 7200000 },
];

describe("renderListVisual", () => {
  it("returns null for non-execution resource types", () => {
    expect(renderListVisual("pipeline", sampleItems, "pie")).toBeNull();
  });

  it("returns null for empty execution items", () => {
    expect(renderListVisual("execution", [], "pie")).toBeNull();
  });

  it("pie chart aggregates Errored into Failed bucket in analysis", () => {
    const result = renderListVisual("execution", sampleItems, "pie");
    expect(result).not.toBeNull();
    expect(result!.svg).toContain("<svg");
    expect(result!.analysis).toContain("Executions by status");
    expect(result!.analysis).toContain("**Failed**");
    expect(result!.analysis).toContain("**Success**");
  });

  it("bar chart groups by pipelineIdentifier", () => {
    const result = renderListVisual("execution", sampleItems, "bar");
    expect(result).not.toBeNull();
    expect(result!.svg).toContain("<svg");
    expect(result!.analysis).toContain("Executions by pipeline");
    expect(result!.analysis).toContain("**build**");
    expect(result!.analysis).toContain("**deploy**");
  });

  it("timeseries chart includes status totals in analysis", () => {
    const result = renderListVisual("execution", sampleItems, "timeseries");
    expect(result).not.toBeNull();
    expect(result!.svg).toContain("<svg");
    expect(result!.analysis).toContain("Execution Timeseries");
    expect(result!.analysis).toMatch(/\*\*\d+\*\* success/);
    expect(result!.analysis).toMatch(/\*\*\d+\*\* failed/);
  });

  it("ignores executions outside the 30-day window", () => {
    const stale = [
      { planExecutionId: "old", status: "Success", startTs: Date.now() - 40 * 86400000 },
    ];
    const result = renderListVisual("execution", stale, "timeseries");
    expect(result).not.toBeNull();
    expect(result!.analysis).toContain("**0** success");
    expect(result!.analysis).toContain("Active days: 0");
  });

  it("falls back to name when pipelineIdentifier is missing", () => {
    const items = [{ name: "fallback-pipe", status: "Success" }];
    const result = renderListVisual("execution", items, "bar");
    expect(result!.analysis).toContain("**fallback-pipe**");
  });
});
