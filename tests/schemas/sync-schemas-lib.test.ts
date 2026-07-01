import { describe, it, expect } from "vitest";
import { rewriteDefinitionKeys, schemaKey } from "../../scripts/sync-schemas-lib.js";

describe("schemaKey", () => {
  it("returns bare name for v0 schemas", () => {
    expect(schemaKey("v0", "pipeline")).toBe("pipeline");
  });

  it("appends _v1 suffix for v1 schemas", () => {
    expect(schemaKey("v1", "pipeline")).toBe("pipeline_v1");
  });
});

describe("rewriteDefinitionKeys", () => {
  it("returns the input unchanged when namespaces match", () => {
    const input = {
      definitions: { pipeline_v1: { type: "object" } },
      $ref: "#/definitions/pipeline_v1/Foo",
    };
    expect(rewriteDefinitionKeys(input, "pipeline", "pipeline_v1")).toEqual(input);
  });

  it("returns the input unchanged when originalNamespace is null", () => {
    const input = { definitions: { inputSet: { type: "object" } } };
    expect(rewriteDefinitionKeys(input, null, "inputSet_v1")).toBe(input);
  });

  it("renames the definitions namespace and rewrites $ref pointers", () => {
    const input = {
      title: "pipeline",
      definitions: {
        pipeline: {
          Pipeline: {
            type: "object",
            properties: {
              stage: { $ref: "#/definitions/pipeline/Stage" },
            },
          },
          Stage: { type: "object" },
        },
      },
      $ref: "#/definitions/pipeline",
    };

    const result = rewriteDefinitionKeys(input, "pipeline", "pipeline_v1");

    expect(result.definitions).toHaveProperty("pipeline_v1");
    expect(result.definitions).not.toHaveProperty("pipeline");
    expect(result.definitions.pipeline_v1.Pipeline.properties.stage.$ref).toBe(
      "#/definitions/pipeline_v1/Stage",
    );
    expect(result.$ref).toBe("#/definitions/pipeline_v1");
  });
});
