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
});
