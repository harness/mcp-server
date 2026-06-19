import { describe, it, expect } from "vitest";
import { SCHEMAS } from "../../src/data/schemas/index.js";
import { navigateSchemaPath } from "../../src/utils/schema-path-navigation.js";

describe("navigateSchemaPath", () => {
  const pipelineV1 = SCHEMAS.pipeline_v1 as Record<string, unknown>;

  it("resolves top-level definition keys", () => {
    const node = navigateSchemaPath(pipelineV1, "pipeline_v1", "pipeline");
    expect(node).toBeDefined();
    expect(node).toMatchObject({ title: "pipeline" });
  });

  it("resolves dot-separated nested paths", () => {
    const node = navigateSchemaPath(pipelineV1, "pipeline_v1", "stages.unified.EnvironmentV1");
    expect(node).toBeDefined();
    expect(node).toMatchObject({ title: "EnvironmentV1" });
  });

  it("resolves nested type names by single-segment path lookup", () => {
    const node = navigateSchemaPath(pipelineV1, "pipeline_v1", "EnvironmentV1");
    expect(node).toBeDefined();
    expect(node).toMatchObject({
      title: "EnvironmentV1",
      description: "Environment configuration for CD stages.",
    });
  });

  it("returns undefined for unknown paths", () => {
    expect(navigateSchemaPath(pipelineV1, "pipeline_v1", "NotARealType")).toBeUndefined();
  });

  it("resolves nested types in template_v1 schema", () => {
    const templateV1 = SCHEMAS.template_v1 as Record<string, unknown>;
    const node = navigateSchemaPath(templateV1, "template_v1", "EnvironmentV1");
    expect(node).toBeDefined();
    expect(node).toMatchObject({ title: "EnvironmentV1" });
  });
});
