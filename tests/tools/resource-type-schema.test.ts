import { describe, it, expect } from "vitest";
import * as z from "zod/v4";
import { resourceTypeSchema } from "../../src/tools/input-schemas.js";

describe("resourceTypeSchema", () => {
  const types = ["pipeline", "service"];

  it("full mode emits an enum of supported types", () => {
    const json = z.toJSONSchema(resourceTypeSchema(types)) as { enum?: string[] };
    expect(json.enum).toEqual(types);
  });

  it("compact mode emits a plain string without the catalog", () => {
    const json = z.toJSONSchema(resourceTypeSchema(types, true)) as { type?: string; enum?: string[] };
    expect(json.type).toBe("string");
    expect(json.enum).toBeUndefined();
  });

  it("full mode rejects types outside the enum at parse time", () => {
    const schema = resourceTypeSchema(types, false);
    expect(schema.safeParse("pipeline").success).toBe(true);
    expect(schema.safeParse("connector").success).toBe(false);
  });

  it("compact mode accepts any non-empty string at parse time (validated at dispatch)", () => {
    const schema = resourceTypeSchema(types, true);
    expect(schema.safeParse("connector").success).toBe(true);
    expect(schema.safeParse("").success).toBe(false);
  });

  it("empty catalog fails for both modes", () => {
    const schema = resourceTypeSchema([], false);
    expect(schema.safeParse("pipeline").success).toBe(false);
  });
});
