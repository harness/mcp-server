import { describe, expect, it } from "vitest";
import {
  runbookExecutionGetExtract,
  runbookExecutionListExtract,
  runbookGetExtract,
  runbookListExtract,
  runbookRunExtract,
} from "../../src/registry/extractors.js";

describe("runbookListExtract", () => {
  it("returns only exposeToAi runbooks with a compact shape and total of exposed count", () => {
    const raw = {
      data: {
        scriptedActions: {
          actions: [
            { serviceId: "a", displayName: "A", description: "d", exposeToAi: true },
            { serviceId: "b", displayName: "B", description: "hidden", exposeToAi: false },
          ],
        },
      },
    };
    expect(runbookListExtract(raw)).toEqual({
      items: [{ serviceId: "a", displayName: "A", description: "d" }],
      total: 1,
      truncated: false,
    });
  });

  it("caps items at 10 and sets truncated when more exposed runbooks exist", () => {
    const actions = Array.from({ length: 12 }, (_, i) => ({
      serviceId: `rb-${i}`,
      displayName: `R${i}`,
      description: "d",
      exposeToAi: true,
    }));
    const raw = { data: { scriptedActions: { actions } } };
    const result = runbookListExtract(raw) as { items: unknown[]; total: number; truncated: boolean };
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(12);
    expect(result.truncated).toBe(true);
  });

  it("throws when GraphQL returns errors", () => {
    expect(() => runbookListExtract({ errors: [{ message: "denied" }] })).toThrow("denied");
  });
});

describe("runbookGetExtract", () => {
  it("returns the action when exposeToAi is true", () => {
    const action = { serviceId: "rb", exposeToAi: true, inputs: [] };
    const raw = { data: { scriptedAction: { action } } };
    expect(runbookGetExtract(raw)).toEqual(action);
  });

  it("rejects null actions and runbooks not exposed to AI", () => {
    expect(() =>
      runbookGetExtract({ data: { scriptedAction: { action: null } } }),
    ).toThrow("Runbook not found or not exposed to AI");
    expect(() =>
      runbookGetExtract({ data: { scriptedAction: { action: { exposeToAi: false } } } }),
    ).toThrow("Runbook not found or not exposed to AI");
  });
});

describe("runbookRunExtract", () => {
  it("returns scriptRunId and PENDING status on success", () => {
    const raw = {
      data: { executeScriptedAction: { scriptRunId: "run-9", success: true, errors: [] } },
    };
    expect(runbookRunExtract(raw)).toEqual({ scriptRunId: "run-9", status: "PENDING" });
  });

  it("throws with API error messages when success is false", () => {
    const raw = {
      data: {
        executeScriptedAction: {
          scriptRunId: null,
          success: false,
          errors: [{ message: "quota" }, { message: "timeout" }],
        },
      },
    };
    expect(() => runbookRunExtract(raw)).toThrow("quota; timeout");
  });

  it("uses a fallback message when success is false with no error details", () => {
    const raw = { data: { executeScriptedAction: { success: false } } };
    expect(() => runbookRunExtract(raw)).toThrow("Runbook execution was rejected");
  });
});

describe("runbookExecutionListExtract", () => {
  it("maps executions to items and exposes pagination metadata", () => {
    const raw = {
      data: {
        runbookExecutions: {
          executions: [{ scriptRunId: "r1" }, { scriptRunId: "r2" }],
          hasMore: true,
          paginationToken: "next-page",
        },
      },
    };
    expect(runbookExecutionListExtract(raw)).toEqual({
      items: [{ scriptRunId: "r1" }, { scriptRunId: "r2" }],
      total: 2,
      pagination: { has_more: true, next_cursor: "next-page" },
    });
  });

  it("omits next_cursor when paginationToken is null", () => {
    const raw = {
      data: {
        runbookExecutions: {
          executions: [],
          hasMore: false,
          paginationToken: null,
        },
      },
    };
    expect(runbookExecutionListExtract(raw)).toEqual({
      items: [],
      total: 0,
      pagination: { has_more: false, next_cursor: undefined },
    });
  });
});

describe("runbookExecutionGetExtract", () => {
  it("returns the matching execution for script_run_id from input", () => {
    const raw = {
      data: {
        runbookExecutions: {
          executions: [
            { scriptRunId: "run-a", status: "RUNNING" },
            { scriptRunId: "run-b", status: "SUCCESS" },
          ],
        },
      },
    };
    expect(runbookExecutionGetExtract(raw, { script_run_id: "run-b" })).toEqual({
      scriptRunId: "run-b",
      status: "SUCCESS",
    });
  });

  it("throws a actionable error when the run id is not in the recent page", () => {
    const raw = {
      data: { runbookExecutions: { executions: [{ scriptRunId: "other" }] } },
    };
    expect(() => runbookExecutionGetExtract(raw, { script_run_id: "missing" })).toThrow(
      'Run "missing" not found among the 1 most recent runs',
    );
  });
});
