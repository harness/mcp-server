import { describe, it, expect } from "vitest";
import { jsonResult, errorResult, imageResult, mixedResult, normalizeHarnessListPayload } from "../../src/utils/response-formatter.js";

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

describe("imageResult", () => {
  it("returns base64-encoded PNG as image content", { timeout: 15_000 }, async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';
    const result = await imageResult(svg);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]!.type).toBe("image");
    const img = result.content[0] as { type: "image"; data: string; mimeType: string };
    expect(img.mimeType).toBe("image/png");
    // Verify it's valid base64 that decodes to a PNG (starts with PNG magic bytes)
    const buf = Buffer.from(img.data, "base64");
    expect(buf[0]).toBe(0x89); // PNG signature
    expect(buf[1]).toBe(0x50); // 'P'
    expect(buf[2]).toBe(0x4e); // 'N'
    expect(buf[3]).toBe(0x47); // 'G'
  });

  it("does not set isError", { timeout: 15_000 }, async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    const result = await imageResult(svg);
    expect(result.isError).toBeUndefined();
  });
});

describe("mixedResult", () => {
  it("returns text first, then PNG image, with structuredContent", { timeout: 15_000 }, async () => {
    const data = { count: 5 };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>';
    const result = await mixedResult(data, svg);
    expect(result.content).toHaveLength(2);
    expect(result.content[0]!.type).toBe("text");
    expect(result.content[1]!.type).toBe("image");
    const text = result.content[0] as { type: "text"; text: string };
    expect(JSON.parse(text.text)).toEqual({ count: 5 });
    const img = result.content[1] as { type: "image"; data: string; mimeType: string };
    expect(img.mimeType).toBe("image/png");
    const buf = Buffer.from(img.data, "base64");
    expect(buf[0]).toBe(0x89); // PNG signature
    expect(result.structuredContent).toEqual({ count: 5 });
  });
});
