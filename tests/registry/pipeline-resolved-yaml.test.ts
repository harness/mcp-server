import { describe, expect, it } from "vitest";
import {
  pipelineResolvedYamlExtract,
  runtimeInputExtract,
} from "../../src/registry/extractors.js";

describe("runtimeInputExtract _hint", () => {
  it("keeps execute guidance when variableInputMetadata is present", () => {
    const result = runtimeInputExtract(
      {
        data: {
          inputSetTemplateYaml:
            "pipeline:\n  variables:\n    - name: env\n      value: <+input>\n",
        },
      },
      {
        _pipelineDefinitionYaml:
          "pipeline:\n  variables:\n    - name: env\n      value: <+input>.default(qa)\n",
      },
    ) as Record<string, unknown>;

    expect(String(result._hint)).toContain("harness_execute");
    expect(String(result._hint)).toContain("variableInputMetadata");
    expect(String(result._hint)).toContain("pipeline-level variables only");
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
