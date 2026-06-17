/**
 * Unit tests for stripInternalMeta — the shared metadata-stripping helper used
 * by the Knowledge Graph / semantic-layer extractors.
 *
 * Contract guarded here:
 *  - Drops null/undefined/empty-string values and columnMappingMeta keys.
 *  - PRESERVES explicitly-empty collections (e.g. {relationship_types: []}) so
 *    callers can distinguish "no related types" from a missing field.
 *  - PRUNES metadata-only array rows that collapse to {} after stripping, so
 *    {fields: [{columnMappingMeta: {...}}]} becomes {fields: []}, not
 *    {fields: [{}]}.
 */
import { describe, it, expect } from "vitest";
import { stripInternalMeta } from "../../src/utils/strip-meta.js";

describe("stripInternalMeta", () => {
  it("drops null, undefined, and empty-string values", () => {
    const result = stripInternalMeta({ a: "keep", b: null, c: undefined, d: "" });
    expect(result).toEqual({ a: "keep" });
  });

  it("drops columnMappingMeta and column_mapping_meta keys", () => {
    const result = stripInternalMeta({
      name: "field",
      columnMappingMeta: { hidden: true },
      column_mapping_meta: { foo: "bar" },
    });
    expect(result).toEqual({ name: "field" });
  });

  it("preserves an explicitly empty collection on an object", () => {
    // Regression: an empty array must survive so kg_related_type can report
    // "no related types" distinctly from a missing/malformed field.
    const result = stripInternalMeta({ relationship_types: [], entity_types: [] });
    expect(result).toEqual({ relationship_types: [], entity_types: [] });
  });

  it("prunes a metadata-only row instead of leaving a {} placeholder", () => {
    // Regression: {fields: [{columnMappingMeta: {...}}]} must clean to
    // {fields: []}, not {fields: [{}]}.
    const result = stripInternalMeta({
      fields: [{ columnMappingMeta: { hidden: true } }],
    });
    expect(result).toEqual({ fields: [] });
  });

  it("keeps real rows while pruning metadata-only siblings", () => {
    const result = stripInternalMeta({
      fields: [
        { name: "id", type: "string" },
        { columnMappingMeta: { hidden: true } },
        { name: "count", type: "number" },
      ],
    });
    expect(result).toEqual({
      fields: [
        { name: "id", type: "string" },
        { name: "count", type: "number" },
      ],
    });
  });

  it("recurses into nested objects and strips internal keys at every level", () => {
    const result = stripInternalMeta({
      type: {
        id: "svc",
        description: "",
        columnMappingMeta: { internal: true },
        fields: [
          { name: "a", columnMappingMeta: { x: 1 } },
          { columnMappingMeta: { only: true } },
        ],
      },
    });
    expect(result).toEqual({
      type: {
        id: "svc",
        fields: [{ name: "a" }],
      },
    });
  });

  it("returns primitives and a top-level empty array unchanged", () => {
    expect(stripInternalMeta("hello")).toBe("hello");
    expect(stripInternalMeta(42)).toBe(42);
    expect(stripInternalMeta(null)).toBe(null);
    expect(stripInternalMeta([])).toEqual([]);
  });

  it("does not prune a top-level empty object", () => {
    // Top-level pruning only applies to array elements; a bare {} passes through.
    expect(stripInternalMeta({})).toEqual({});
  });
});
