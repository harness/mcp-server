import { describe, expect, it } from "vitest";
import {
  buildStageMetadataMap,
  pipelineResolvedYamlExtract,
  runtimeInputExtract,
  walkPipelineStageEntries,
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

  it("walks parallel stage arrays", () => {
    const yaml = `
pipeline:
  stages:
    - parallel:
        - stage:
            identifier: DeployEast
            spec:
              deploymentType: Kubernetes
              environment:
                environmentRef: east
        - stage:
            identifier: DeployWest
            spec:
              deploymentType: Kubernetes
              environment:
                environmentRef: west
`;
    expect(buildStageMetadataMap(yaml)).toEqual({
      DeployEast: { deploymentType: "Kubernetes", environmentRef: "east" },
      DeployWest: { deploymentType: "Kubernetes", environmentRef: "west" },
    });
  });

  it("walks parallel.stages and nested stage groups", () => {
    const yaml = `
pipeline:
  stages:
    - parallel:
        stages:
          - stage:
              identifier: DeployA
              spec:
                deploymentType: Kubernetes
                environment:
                  environmentRef: envA
    - stage:
        identifier: DeployGroup
        stages:
          - stage:
              identifier: DeployChild
              spec:
                deploymentType: NativeHelm
                environment:
                  environmentRef: childEnv
`;
    expect(buildStageMetadataMap(yaml)).toEqual({
      DeployA: { deploymentType: "Kubernetes", environmentRef: "envA" },
      DeployGroup: { deploymentType: "", environmentRef: "" },
      DeployChild: { deploymentType: "NativeHelm", environmentRef: "childEnv" },
    });
  });

  it("walkPipelineStageEntries is exported for direct use", () => {
    const stageMap: Record<string, { deploymentType: string; environmentRef: string }> = {};
    walkPipelineStageEntries(
      [{ parallel: { stages: [{ stage: { identifier: "x", spec: { deploymentType: "Ssh" } } }] } }],
      stageMap,
    );
    expect(stageMap).toEqual({ x: { deploymentType: "Ssh", environmentRef: "" } });
  });
});

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
