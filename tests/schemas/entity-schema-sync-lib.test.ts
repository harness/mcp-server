import { describe, it, expect } from "vitest";
import { extractLiveSchema } from "../../scripts/entity-schema-sync-lib.mjs";

describe("entity-schema-sync-lib extractLiveSchema", () => {
  it("extracts schema from Harness data envelope", () => {
    const schema = { type: "object", properties: { x: { type: "string" } } };
    expect(extractLiveSchema({ data: schema })).toEqual(schema);
  });

  it("extracts stringified schema", () => {
    const schema = { definitions: { foo: { type: "object" } } };
    expect(extractLiveSchema({ data: JSON.stringify(schema) })).toEqual(schema);
  });

  it("extracts schema from yamlSchema envelope key", () => {
    const schema = { type: "object", properties: { x: { type: "string" } } };
    expect(extractLiveSchema({ yamlSchema: schema })).toEqual(schema);
  });

  it("extracts schema from jsonSchema envelope key", () => {
    const schema = { definitions: { foo: { type: "object" } } };
    expect(extractLiveSchema({ jsonSchema: schema })).toEqual(schema);
  });

  it("extracts schema from nested data.schema envelope", () => {
    const schema = { type: "object", properties: { y: { type: "number" } } };
    expect(extractLiveSchema({ data: { schema } })).toEqual(schema);
  });

  it("extracts top-level schema object", () => {
    const schema = { definitions: { connector: { type: "object" } } };
    expect(extractLiveSchema(schema)).toEqual(schema);
  });

  it("throws when response has no JSON Schema", () => {
    expect(() => extractLiveSchema({ status: "ERROR", message: "nope" })).toThrow(
      /did not contain a JSON Schema/,
    );
  });
});
