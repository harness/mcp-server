import { describe, it, expect } from "vitest";
import { renderStatusSummarySvg } from "../../../src/utils/svg/status-summary.js";
import type { ProjectHealthData } from "../../../src/utils/svg/types.js";

function makeData(overrides?: Partial<ProjectHealthData>): ProjectHealthData {
  return {
    orgId: "default",
    projectId: "my-project",
    health: "degraded",
    counts: { failed: 3, running: 1, recent: 10 },
    recentExecutions: [
      { id: "e1", pipeline: "build", status: "Success" },
      { id: "e2", pipeline: "deploy", status: "Failed" },
      { id: "e3", pipeline: "test", status: "Running" },
    ],
    ...overrides,
  };
}

describe("renderStatusSummarySvg", () => {
  it("returns valid SVG", () => {
    const svg = renderStatusSummarySvg(makeData());
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("includes org and project", () => {
    const svg = renderStatusSummarySvg(makeData());
    expect(svg).toContain("default");
    expect(svg).toContain("my-project");
  });

  it("shows health label", () => {
    const svg = renderStatusSummarySvg(makeData());
    expect(svg).toContain("Degraded");
  });

  it("shows metric counts", () => {
    const svg = renderStatusSummarySvg(makeData());
    expect(svg).toContain(">3<");
    expect(svg).toContain(">1<");
    expect(svg).toContain(">10<");
  });

  it("renders recent execution segments", () => {
    const svg = renderStatusSummarySvg(makeData());
    // Should contain title tooltips (em dash separator)
    expect(svg).toContain("build");
    expect(svg).toContain("Success");
    expect(svg).toContain("deploy");
    expect(svg).toContain("Failed");
  });

  it("handles empty recent executions", () => {
    const svg = renderStatusSummarySvg(makeData({ recentExecutions: [] }));
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("Recent Executions");
  });

  it("respects custom width", () => {
    const svg = renderStatusSummarySvg(makeData(), { width: 900 });
    expect(svg).toContain('width="900"');
  });

  it("shows healthy status", () => {
    const svg = renderStatusSummarySvg(makeData({ health: "healthy" }));
    expect(svg).toContain("Healthy");
  });

  it("shows failing status", () => {
    const svg = renderStatusSummarySvg(makeData({ health: "failing" }));
    expect(svg).toContain("Critical");
  });
});
