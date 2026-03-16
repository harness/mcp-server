import { describe, it, expect } from "vitest";
import { renderTimelineSvg } from "../../../src/utils/svg/timeline.js";
import type { ExecutionSummaryData, StageBar } from "../../../src/utils/svg/types.js";

function makeData(overrides?: Partial<ExecutionSummaryData>): ExecutionSummaryData {
  return {
    pipelineName: "Deploy Production",
    executionId: "exec-123",
    status: "Success",
    totalDurationMs: 60000,
    stages: [
      {
        name: "Build",
        status: "Success",
        startMs: 0,
        durationMs: 20000,
        steps: [
          { name: "Compile", status: "Success", durationMs: 15000 },
          { name: "Test", status: "Success", durationMs: 5000 },
        ],
      },
      {
        name: "Deploy",
        status: "Success",
        startMs: 20000,
        durationMs: 40000,
        steps: [
          { name: "Apply Manifests", status: "Success", durationMs: 30000 },
          { name: "Verify", status: "Success", durationMs: 10000 },
        ],
      },
    ],
    ...overrides,
  };
}

describe("renderTimelineSvg", () => {
  it("returns valid SVG string", () => {
    const svg = renderTimelineSvg(makeData());
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("includes pipeline name and execution ID", () => {
    const svg = renderTimelineSvg(makeData());
    expect(svg).toContain("Deploy Production");
    expect(svg).toContain("exec-123");
  });

  it("includes stage names", () => {
    const svg = renderTimelineSvg(makeData());
    expect(svg).toContain("Build");
    expect(svg).toContain("Deploy");
  });

  it("shows step names when showSteps is true", () => {
    const svg = renderTimelineSvg(makeData(), { showSteps: true });
    expect(svg).toContain("Compile");
    expect(svg).toContain("Verify");
  });

  it("hides step names when showSteps is false", () => {
    const svg = renderTimelineSvg(makeData(), { showSteps: false });
    expect(svg).not.toContain("Compile");
  });

  it("handles empty stages", () => {
    const svg = renderTimelineSvg(makeData({ stages: [] }));
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("truncates when stages exceed maxStages", () => {
    const stages: StageBar[] = Array.from({ length: 30 }, (_, i) => ({
      name: `Stage ${i}`,
      status: "Success" as const,
      startMs: i * 1000,
      durationMs: 1000,
      steps: [],
    }));
    const svg = renderTimelineSvg(makeData({ stages }), { maxStages: 5 });
    expect(svg).toContain("25 more stages");
  });

  it("uses failure indicator for failed stages", () => {
    const svg = renderTimelineSvg(makeData({
      status: "Failed",
      stages: [{
        name: "Build",
        status: "Failed",
        startMs: 0,
        durationMs: 10000,
        steps: [],
      }],
    }));
    expect(svg).toContain("\u2716");
  });

  it("respects custom width", () => {
    const svg = renderTimelineSvg(makeData(), { width: 1200 });
    expect(svg).toContain('width="1200"');
  });

  it("escapes XML special characters in names", () => {
    const svg = renderTimelineSvg(makeData({
      pipelineName: "deploy <prod> & staging",
    }));
    expect(svg).toContain("&lt;prod&gt;");
    expect(svg).toContain("&amp;");
  });
});
