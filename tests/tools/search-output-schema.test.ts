import { describe, it, expect } from "vitest";
import { searchOutputSchema } from "../../src/tools/output-schemas.js";

describe("searchOutputSchema", () => {
  const base = { query: "payments", total_matches: 0, searched_types: 2, results: [] };

  it("accepts the per-type errors map harness_search returns", () => {
    const parsed = searchOutputSchema.safeParse({ ...base, errors: { branch: "Missing required field repo_id" } });
    expect(parsed.success).toBe(true);
  });

  it("still accepts results without errors", () => {
    expect(searchOutputSchema.safeParse(base).success).toBe(true);
  });

  it("accepts the semantic routing fields", () => {
    const parsed = searchOutputSchema.safeParse({ ...base, semantic_routed: true, types_skipped: ["branch"] });
    expect(parsed.success).toBe(true);
  });
});
