import { describe, expect, it } from "vitest";
import {
  runbookExecutionGetExtract,
  runbookExecutionListExtract,
  runbookGetExtract,
  runbookListExtract,
  runbookRunExtract,
} from "../../src/registry/extractors.js";

describe("runbookListExtract", () => {
  it("maps runbookId to serviceId and sets truncated when total exceeds the cap", () => {
    const entities = Array.from({ length: 11 }, (_, i) => ({
      runbookId: `rb-${i}`,
      displayName: `R${i}`,
      description: "d",
    }));
    expect(runbookListExtract({ entities, totalCount: 11 })).toEqual({
      items: entities.slice(0, 10).map((r) => ({
        serviceId: r.runbookId,
        displayName: r.displayName,
        description: r.description,
      })),
      total: 11,
      truncated: true,
    });
  });

  it("does not set truncated when the page fits within the cap", () => {
    const entities = [{ runbookId: "a", displayName: "A", description: "d" }];
    expect(runbookListExtract({ entities, totalCount: 1 })).toEqual({
      items: [{ serviceId: "a", displayName: "A", description: "d" }],
      total: 1,
      truncated: false,
    });
  });

  it("handles an empty envelope", () => {
    expect(runbookListExtract({})).toEqual({ items: [], total: 0, truncated: false });
  });
});

describe("runbookGetExtract", () => {
  it("renames runbookId to serviceId and maps defaultValue to default", () => {
    expect(
      runbookGetExtract({
        runbookId: "tp::proj/rb:latest",
        displayName: "Restart",
        inputs: [
          { name: "host", type: "STRING", required: true },
          { name: "count", type: "INTEGER", required: false, defaultValue: "3" },
          { name: "flag", type: "BOOLEAN", required: false, defaultValue: null },
        ],
        outputs: [],
      }),
    ).toMatchObject({
      serviceId: "tp::proj/rb:latest",
      displayName: "Restart",
      inputs: [
        { name: "host", type: "STRING", required: true },
        { name: "count", type: "INTEGER", required: false, default: "3" },
        { name: "flag", type: "BOOLEAN", required: false },
      ],
    });
  });

  it("returns non-record payloads unchanged", () => {
    expect(runbookGetExtract(null)).toBe(null);
    expect(runbookGetExtract("raw")).toBe("raw");
  });
});

describe("runbookRunExtract", () => {
  it("returns scriptRunId and defaults status to PENDING", () => {
    expect(runbookRunExtract({ scriptRunId: "run-1" })).toEqual({
      scriptRunId: "run-1",
      status: "PENDING",
    });
  });

  it("preserves a non-pending status from the API", () => {
    expect(runbookRunExtract({ scriptRunId: "run-2", status: "RUNNING" })).toEqual({
      scriptRunId: "run-2",
      status: "RUNNING",
    });
  });

  it("throws when scriptRunId is missing", () => {
    expect(() => runbookRunExtract({ status: "PENDING" })).toThrow(
      "Runbook execution did not return a scriptRunId",
    );
    expect(() => runbookRunExtract(null)).toThrow("Runbook execution did not return a scriptRunId");
  });
});

describe("runbookExecutionListExtract", () => {
  it("echoes the request cursor and omits next_cursor when hasMoreResults is false", () => {
    expect(
      runbookExecutionListExtract(
        { results: [{ scriptRunId: "run-1" }], nextPageCursor: "stale", hasMoreResults: false },
        { cursor: "cur" },
      ),
    ).toEqual({
      items: [{ scriptRunId: "run-1" }],
      total: 1,
      pagination: { cursor: "cur", next_cursor: undefined, has_more: false },
    });
  });

  it("exposes next_cursor only when more pages remain", () => {
    expect(
      runbookExecutionListExtract({ results: [], nextPageCursor: "next", hasMoreResults: true }, {}),
    ).toEqual({
      items: [],
      total: 0,
      pagination: { cursor: undefined, next_cursor: "next", has_more: true },
    });
  });

  it("returns non-record payloads unchanged", () => {
    expect(runbookExecutionListExtract("bad")).toBe("bad");
  });
});

describe("runbookExecutionGetExtract", () => {
  it("passes the API payload through unchanged", () => {
    const raw = { scriptRunId: "run-1", status: "SUCCESS", outputs: { ok: true } };
    expect(runbookExecutionGetExtract(raw)).toBe(raw);
  });
});
