import { describe, it, expect } from "vitest";
import { toExecutionSummaryData, toProjectHealthData } from "../../../src/utils/svg/mappers.js";

describe("toExecutionSummaryData", () => {
  it("maps a diagnose result with stages", () => {
    const input = {
      execution: {
        pipeline: { name: "My Pipeline", identifier: "my_pipeline" },
        execution: { id: "exec-1", status: "Success" },
        timing: { started_at: "2025-01-01T00:00:00Z", duration_ms: 120000 },
        stages: [
          {
            name: "Build",
            identifier: "build",
            status: "Success",
            started_at: "2025-01-01T00:00:00Z",
            duration_ms: 60000,
            steps: [
              { name: "Compile", status: "Success", duration_ms: 45000 },
            ],
          },
          {
            name: "Deploy",
            identifier: "deploy",
            status: "Success",
            started_at: "2025-01-01T00:01:00Z",
            duration_ms: 60000,
            steps: [],
          },
        ],
      },
    };

    const result = toExecutionSummaryData(input);
    expect(result).not.toBeNull();
    expect(result!.pipelineName).toBe("My Pipeline");
    expect(result!.executionId).toBe("exec-1");
    expect(result!.status).toBe("Success");
    expect(result!.totalDurationMs).toBe(120000);
    expect(result!.stages).toHaveLength(2);
    expect(result!.stages[0]!.name).toBe("Build");
    expect(result!.stages[0]!.steps).toHaveLength(1);
    expect(result!.stages[1]!.name).toBe("Deploy");
  });

  it("returns null when no execution block", () => {
    expect(toExecutionSummaryData({})).toBeNull();
  });

  it("returns null when execution has no id", () => {
    const input = {
      execution: {
        pipeline: { name: "P" },
        execution: { status: "Failed" },
        timing: {},
      },
    };
    expect(toExecutionSummaryData(input)).toBeNull();
  });

  it("handles missing stages gracefully", () => {
    const input = {
      execution: {
        pipeline: { name: "P" },
        execution: { id: "e1", status: "Running" },
        timing: { duration_ms: 5000 },
      },
    };
    const result = toExecutionSummaryData(input);
    expect(result).not.toBeNull();
    expect(result!.stages).toEqual([]);
  });

  it("uses identifier when name is missing", () => {
    const input = {
      execution: {
        pipeline: { identifier: "my_id" },
        execution: { id: "e1", status: "Success" },
        timing: {},
        stages: [{ identifier: "stage_id", status: "Success", duration_ms: 100, steps: [] }],
      },
    };
    const result = toExecutionSummaryData(input);
    expect(result!.pipelineName).toBe("my_id");
    expect(result!.stages[0]!.name).toBe("stage_id");
  });
});

describe("toProjectHealthData", () => {
  it("maps a status result", () => {
    const input = {
      summary: {
        total_failed: 2,
        total_running: 1,
        total_recent: 8,
        health: "degraded",
      },
      recent_activity: [
        { execution_id: "e1", pipeline: "build", status: "Success" },
        { execution_id: "e2", pipeline: "deploy", status: "Failed" },
      ],
    };

    const result = toProjectHealthData(input, "org1", "proj1");
    expect(result).not.toBeNull();
    expect(result!.orgId).toBe("org1");
    expect(result!.projectId).toBe("proj1");
    expect(result!.health).toBe("degraded");
    expect(result!.counts.failed).toBe(2);
    expect(result!.counts.running).toBe(1);
    expect(result!.counts.recent).toBe(8);
    expect(result!.recentExecutions).toHaveLength(2);
  });

  it("returns null when no summary", () => {
    expect(toProjectHealthData({}, "o", "p")).toBeNull();
  });

  it("defaults to healthy for unknown health values", () => {
    const input = { summary: { health: "unknown_value" } };
    const result = toProjectHealthData(input, "o", "p");
    expect(result!.health).toBe("healthy");
  });

  it("handles missing recent_activity", () => {
    const input = { summary: { total_failed: 0, total_running: 0, total_recent: 0, health: "healthy" } };
    const result = toProjectHealthData(input, "o", "p");
    expect(result!.recentExecutions).toEqual([]);
  });
});
