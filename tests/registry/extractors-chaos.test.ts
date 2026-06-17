import { describe, expect, it } from "vitest";
import { chaosDRTestListExtract } from "../../src/registry/extractors.js";

describe("chaosDRTestListExtract", () => {
  it("extracts items and total from the new {items, pagination.totalItems} envelope", () => {
    const raw = {
      items: [
        { id: "dr-1", name: "Region-A failover" },
        { id: "dr-2", name: "DB fence drill" },
      ],
      pagination: { totalItems: 27 },
    };

    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [
        { id: "dr-1", name: "Region-A failover" },
        { id: "dr-2", name: "DB fence drill" },
      ],
      total: 27,
    });
  });

  it("falls back to items.length when pagination.totalItems is missing", () => {
    const raw = {
      items: [{ id: "dr-only" }],
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ id: "dr-only" }],
      total: 1,
    });
  });

  it("returns empty items and total=0 when the envelope is empty", () => {
    expect(chaosDRTestListExtract({})).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ items: [] })).toEqual({ items: [], total: 0 });
    expect(chaosDRTestListExtract({ items: [], pagination: { totalItems: 0 } })).toEqual({
      items: [],
      total: 0,
    });
  });

  it("prefers pagination.totalItems over items.length when both are present", () => {
    const raw = {
      items: [{ id: "dr-1" }, { id: "dr-2" }],
      pagination: { totalItems: 50 },
    };
    expect(chaosDRTestListExtract(raw)).toEqual({
      items: [{ id: "dr-1" }, { id: "dr-2" }],
      total: 50,
    });
  });
});
