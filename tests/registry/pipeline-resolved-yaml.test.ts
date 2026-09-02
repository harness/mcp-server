import { describe, expect, it } from "vitest";
import {
  buildStageMetadataMap,
  pipelineResolvedYamlExtract,
} from "../../src/registry/extractors.js";

describe("buildStageMetadataMap", () => {
  it("returns empty map for missing YAML", () => {
    expect(buildStageMetadataMap(null)).toEqual({});
    expect(buildStageMetadataMap("")).toEqual({});
  });

  it("extracts deploymentType and environmentRef per stage", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        identifier: Deploy
        spec:
          deploymentType: Kubernetes
          environment:
            environmentRef: prodEnv
`;
    expect(buildStageMetadataMap(yaml)).toEqual({
      Deploy: {
        deploymentType: "Kubernetes",
        environmentRef: "prodEnv",
      },
    });
  });
});

describe("pipelineResolvedYamlExtract", () => {
  it("unwraps resolved YAML and computes stageMetadataMap", () => {
    const resolvedYaml = `
pipeline:
  stages:
    - stage:
        identifier: Deploy
        spec:
          deploymentType: Kubernetes
          environment:
            environmentRef: prodEnv
`;
    const result = pipelineResolvedYamlExtract({
      data: { resolvedTemplatesPipelineYaml: resolvedYaml },
    }) as Record<string, unknown>;

    expect(result.resolvedTemplatesPipelineYaml).toBe(resolvedYaml);
    expect(result.stageMetadataMap).toEqual({
      Deploy: {
        deploymentType: "Kubernetes",
        environmentRef: "prodEnv",
      },
    });
    expect(result._hint).toContain("stageMetadataMap");
  });

  it("handles missing data gracefully", () => {
    const result = pipelineResolvedYamlExtract({}) as Record<string, unknown>;
    expect(result.resolvedTemplatesPipelineYaml).toBeNull();
    expect(result.stageMetadataMap).toEqual({});
  });
});
