import { describe, expect, it } from "vitest";
import { pageExtract } from "../../src/registry/extractors.js";

describe("pageExtract", () => {
  it("prefers totalElements over totalItems when both are present", () => {
    expect(
      pageExtract({
        data: { content: [{ id: "a" }], totalElements: 10, totalItems: 99 },
      }),
    ).toEqual({ items: [{ id: "a" }], total: 10 });
  });

  it("falls back to totalItems when totalElements is missing", () => {
    expect(pageExtract({ data: { content: [], totalItems: 42 } })).toEqual({
      items: [],
      total: 42,
    });
  });

  it("defaults total to 0 when pagination counts are missing", () => {
    expect(pageExtract({ data: { content: [{ id: "only" }] } })).toEqual({
      items: [{ id: "only" }],
      total: 0,
    });
  });

  it("returns empty items when data.content is missing", () => {
    expect(pageExtract({ data: { totalElements: 5 } })).toEqual({ items: [], total: 5 });
  });
});
