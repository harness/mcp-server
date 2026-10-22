import { describe, expect, it } from "vitest";
import {
  runbookListExtract,
  runbookGetExtract,
  runbookRunExtract,
  runbookExecutionListExtract,
  runbookExecutionGetExtract,
} from "../../src/registry/extractors.js";

describe("runbookListExtract", () => {
  const actions = (expose: boolean[]) =>
    ({ data: { scriptedActions: { actions: expose.map((e, i) => ({ serviceId: `rb-${i}`, exposeToAi: e })) } } });

  it("counts only AI-exposed runbooks and omits exposeToAi from items", () => {
    const result = runbookListExtract(actions([true, false, true])) as {
      items: Array<{ serviceId: string; exposeToAi?: boolean }>;
      total: number;
      truncated: boolean;
    };
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.every((i) => i.exposeToAi === undefined)).toBe(true);
    expect(result.truncated).toBe(false);
  });

  it("truncates at 10 exposed runbooks", () => {
    const result = runbookListExtract(actions(Array(12).fill(true))) as {
      items: unknown[];
      total: number;
      truncated: boolean;
    };
    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(12);
    expect(result.truncated).toBe(true);
  });

  it("throws when scriptedActions is missing from the envelope", () => {
    expect(() => runbookListExtract({ data: {} })).toThrow(/missing "scriptedActions"/);
  });
});

describe("runbookGetExtract", () => {
  it("returns the action when exposeToAi is true", () => {
    const action = { serviceId: "rb", exposeToAi: true, inputs: [] };
    expect(runbookGetExtract({ data: { scriptedAction: { action } } })).toEqual(action);
  });

  it("rejects null action and runbooks not exposed to AI", () => {
    expect(() => runbookGetExtract({ data: { scriptedAction: { action: null } } })).toThrow(
      /not exposed to AI/,
    );
    expect(() =>
      runbookGetExtract({ data: { scriptedAction: { action: { serviceId: "rb", exposeToAi: false } } } }),
    ).toThrow(/not exposed to AI/);
  });
});

describe("runbookRunExtract", () => {
  it("returns scriptRunId and PENDING status on success", () => {
    expect(
      runbookRunExtract({ data: { executeScriptedAction: { scriptRunId: "run-9", success: true, errors: [] } } }),
    ).toEqual({ scriptRunId: "run-9", status: "PENDING" });
  });

  it("surfaces GraphQL errors and execution rejection messages", () => {
    expect(() => runbookRunExtract({ errors: [{ message: "denied" }] })).toThrow("denied");
    expect(() =>
      runbookRunExtract({ data: { executeScriptedAction: { success: false, errors: [{ message: "bad input" }] } } }),
    ).toThrow("bad input");
    expect(() => runbookRunExtract({ data: { executeScriptedAction: { success: false, errors: [] } } })).toThrow(
      /rejected/,
    );
  });
});

describe("runbookExecutionListExtract", () => {
  it("maps pagination fields to list shape", () => {
    expect(
      runbookExecutionListExtract({
        data: {
          runbookExecutions: {
            executions: [{ scriptRunId: "a" }],
            hasMore: true,
            paginationToken: "tok",
          },
        },
      }),
    ).toEqual({
      items: [{ scriptRunId: "a" }],
      total: 1,
      pagination: { has_more: true, next_cursor: "tok" },
    });
  });

  it("omits next_cursor when paginationToken is null", () => {
    const result = runbookExecutionListExtract({
      data: { runbookExecutions: { executions: [], hasMore: false, paginationToken: null } },
    }) as { pagination: { next_cursor?: string } };
    expect(result.pagination.next_cursor).toBeUndefined();
  });
});

describe("runbookExecutionGetExtract", () => {
  const envelope = {
    data: {
      runbookExecutions: {
        executions: [{ scriptRunId: "run-1", status: "SUCCESS" }],
      },
    },
  };

  it("selects the run matching script_run_id from input", () => {
    expect(runbookExecutionGetExtract(envelope, { script_run_id: "run-1" })).toEqual({
      scriptRunId: "run-1",
      status: "SUCCESS",
    });
  });

  it("throws a actionable message when the run is not in the page", () => {
    expect(() => runbookExecutionGetExtract(envelope, { script_run_id: "missing" })).toThrow(
      /not found among the 1 most recent runs/,
    );
  });
});
