import { describe, it, expect } from "vitest";
import { renderStageFlowSvg } from "../../../src/utils/svg/stage-flow.js";
import type { ExecutionSummaryData, StageBar } from "../../../src/utils/svg/types.js";

function makeData(overrides?: Partial<ExecutionSummaryData>): ExecutionSummaryData {
  return {
    pipelineName: "CI Pipeline",
    executionId: "exec-456",
    status: "Failed",
    totalDurationMs: 90000,
    stages: [
      { name: "Checkout", status: "Success", startMs: 0, durationMs: 5000, steps: [] },
      { name: "Build", status: "Success", startMs: 5000, durationMs: 30000, steps: [{ name: "Compile", status: "Success", durationMs: 30000 }] },
      { name: "Test", status: "Failed", startMs: 35000, durationMs: 55000, steps: [] },
    ],
    ...overrides,
  };
}

describe("renderStageFlowSvg", () => {
  it("returns valid SVG", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("includes pipeline name", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain("CI Pipeline");
  });

  it("includes stage names", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain("Checkout");
    expect(svg).toContain("Build");
    expect(svg).toContain("Test");
  });

  it("shows step count for stages with steps", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain("1 step");
  });

  it("draws arrows between stages", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain("arrow");
    expect(svg).toContain("<line");
  });

  it("handles empty stages", () => {
    const svg = renderStageFlowSvg(makeData({ stages: [] }));
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("truncates excess stages", () => {
    const stages: StageBar[] = Array.from({ length: 25 }, (_, i) => ({
      name: `Stage ${i}`,
      status: "Success" as const,
      startMs: i * 1000,
      durationMs: 1000,
      steps: [],
    }));
    const svg = renderStageFlowSvg(makeData({ stages }), { maxStages: 10 });
    expect(svg).toContain("+15 more");
  });

  it("defines arrow marker", () => {
    const svg = renderStageFlowSvg(makeData());
    expect(svg).toContain('<marker id="arrow"');
  });
});
