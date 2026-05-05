import { describe, it, expect } from "vitest";
import { getExample, searchExamples, getExamplesForResource } from "../../src/data/examples/index.js";

describe("example registry", () => {
  it("getExample returns undefined for non-existent example", () => {
    expect(getExample("nonexistent")).toBeUndefined();
  });

  it("searchExamples returns empty array for no matches", () => {
    expect(searchExamples("zzz_no_match_zzz")).toEqual([]);
  });

  it("getExamplesForResource returns empty array for unknown resource type", () => {
    expect(getExamplesForResource("unknown_type")).toEqual([]);
  });
});
