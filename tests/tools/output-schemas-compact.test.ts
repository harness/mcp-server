import { describe, it, expect } from "vitest";
import * as z from "zod/v4";
import {
  compactOutputSchema,
  listOutputSchema,
  searchOutputSchema,
} from "../../src/tools/output-schemas.js";

describe("compactOutputSchema", () => {
  it("returns the full schema when compact is false or undefined", () => {
    expect(compactOutputSchema(listOutputSchema, false)).toBe(listOutputSchema);
    expect(compactOutputSchema(listOutputSchema, undefined)).toBe(listOutputSchema);
  });

  it("returns a smaller JSON schema in compact mode", () => {
    const fullJson = JSON.stringify(z.toJSONSchema(listOutputSchema));
    const compactJson = JSON.stringify(z.toJSONSchema(compactOutputSchema(listOutputSchema, true)));
    expect(compactJson.length).toBeLessThan(fullJson.length * 0.5);
  });

  it("compact search output still accepts harness_search payloads", () => {
    const schema = compactOutputSchema(searchOutputSchema, true);
    const sample = {
      query: "payments",
      total_matches: 1,
      searched_types: 2,
      results: [{ resource_type: "service", match_count: 1, items: [{ identifier: "svc" }] }],
      errors: { branch: "Missing repo_id" },
      extra_field: "allowed",
    };
    expect(schema.safeParse(sample).success).toBe(true);
  });
});
