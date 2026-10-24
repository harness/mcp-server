import { describe, it, expect } from "vitest";
import * as z from "zod/v4";
import { compactOutputSchema, listOutputSchema } from "../../src/tools/output-schemas.js";

describe("compactOutputSchema", () => {
  it("returns the full schema when compact mode is off", () => {
    const wrapped = compactOutputSchema(listOutputSchema, false);
    expect(wrapped).toBe(listOutputSchema);
    const json = z.toJSONSchema(wrapped) as { properties?: Record<string, unknown> };
    expect(json.properties?.total).toBeDefined();
  });

  it("returns a permissive object schema in compact mode", () => {
    const wrapped = compactOutputSchema(listOutputSchema, true);
    expect(wrapped).not.toBe(listOutputSchema);
    const parsed = wrapped.safeParse({ items: [{ id: "x" }], extraField: 1 });
    expect(parsed.success).toBe(true);
    const json = z.toJSONSchema(wrapped) as { properties?: Record<string, unknown> };
    expect(json.properties?.total).toBeUndefined();
  });
});
