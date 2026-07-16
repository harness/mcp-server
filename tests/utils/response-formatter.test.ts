import { describe, it, expect } from "vitest";
import { jsonResult, errorResult, normalizeHarnessListPayload } from "../../src/utils/response-formatter.js";

describe("normalizeHarnessListPayload", () => {
  it("wraps a top-level array into { items, total, page } for MCP structured output", () => {
    const activities = [{ id: 1 }, { id: 2 }];
    const normalized = normalizeHarnessListPayload(activities, { page: 0 });
    expect(normalized).toEqual({ items: activities, total: 2, page: 0 });
    const tool = jsonResult(normalized);
    expect(tool.structuredContent).toEqual({ items: activities, total: 2, page: 0 });
  });

  it("hoists a list array from body when items is absent", () => {
    const body = [{ x: 1 }];
    const normalized = normalizeHarnessListPayload({ body, meta: "keep" }, { page: 1 });
    expect(normalized).toEqual({ body, meta: "keep", items: body, total: 1, page: 1 });
  });

  it("fills total from items length when items exists but total is missing", () => {
    const items = [{ a: 1 }];
    expect(normalizeHarnessListPayload({ items })).toEqual({ items, total: 1 });
  });

  it("leaves already-shaped list objects unchanged", () => {
    const shaped = { items: [{ a: 1 }], total: 99, page: 0 };
    expect(normalizeHarnessListPayload(shaped)).toBe(shaped);
  });
});

describe("jsonResult", () => {
  it("wraps data as text content with structuredContent", () => {
    const result = jsonResult({ count: 42 });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ count: 42 }) }],
      structuredContent: { count: 42 },
    });
  });

  it("handles arrays without structuredContent", () => {
    const result = jsonResult([1, 2, 3]);
    expect(result.content[0].text).toBe(JSON.stringify([1, 2, 3]));
    expect(result.structuredContent).toBeUndefined();
  });

  it("handles null without structuredContent", () => {
    const result = jsonResult(null);
    expect(result.content[0].text).toBe("null");
    expect(result.structuredContent).toBeUndefined();
  });

  it("handles strings without structuredContent", () => {
    const result = jsonResult("hello");
    expect(result.content[0].text).toBe('"hello"');
    expect(result.structuredContent).toBeUndefined();
  });

  it("does not set isError", () => {
    const result = jsonResult({ ok: true });
    expect(result.isError).toBeUndefined();
  });
});

describe("errorResult", () => {
  it("wraps error message with isError flag", () => {
    const result = errorResult("something broke");
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ error: "something broke" }) }],
      isError: true,
    });
  });

  it("serializes error as JSON object", () => {
    const result = errorResult("not found");
    const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(parsed).toEqual({ error: "not found" });
  });
});
