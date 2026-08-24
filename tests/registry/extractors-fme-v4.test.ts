import { describe, expect, it } from "vitest";
import { fmeV4PaginatedListExtract } from "../../src/registry/extractors.js";

describe("fmeV4PaginatedListExtract", () => {
  it("promotes data to items and totalCount to total", () => {
    const raw = {
      data: [{ id: "env1", name: "prod" }],
      limit: 100,
      offset: 0,
      totalCount: 3,
    };
    expect(fmeV4PaginatedListExtract(raw)).toMatchObject({
      items: [{ id: "env1", name: "prod" }],
      total: 3,
      totalCount: 3,
      data: [{ id: "env1", name: "prod" }],
    });
  });

  it("falls back total to data.length when totalCount is absent", () => {
    const raw = {
      data: [{ id: "a" }, { id: "b" }],
      limit: 100,
      offset: 0,
    };
    expect(fmeV4PaginatedListExtract(raw)).toMatchObject({
      items: [{ id: "a" }, { id: "b" }],
      total: 2,
    });
  });

  it("returns raw unchanged when data is not an array", () => {
    const raw = { data: "not-an-array", totalCount: 5 };
    expect(fmeV4PaginatedListExtract(raw)).toBe(raw);
  });

  it("returns raw unchanged for null, arrays, and primitives", () => {
    expect(fmeV4PaginatedListExtract(null)).toBeNull();
    expect(fmeV4PaginatedListExtract([])).toEqual([]);
    expect(fmeV4PaginatedListExtract("error")).toBe("error");
  });
});
