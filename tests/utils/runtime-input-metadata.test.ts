import { describe, expect, it } from "vitest";
import {
  buildStageMetadataMap,
  extractVariableInputMetadata,
  parseRuntimeInputExpression,
  walkPipelineStageEntries,
} from "../../src/utils/runtime-input-metadata.js";
import { runtimeInputExtract } from "../../src/registry/extractors.js";

describe("parseRuntimeInputExpression", () => {
  it("parses default and selectOneFrom", () => {
    expect(
      parseRuntimeInputExpression("<+input>.default(shashank).selectOneFrom(shashank,dheeraj)"),
    ).toEqual({
      runtimeExpression: "<+input>.default(shashank).selectOneFrom(shashank,dheeraj)",
      default: "shashank",
      allowedValues: ["shashank", "dheeraj"],
    });
  });

  it("parses allowedValues", () => {
    expect(parseRuntimeInputExpression("<+input>.default(green).allowedValues(green,blue)")).toEqual({
      runtimeExpression: "<+input>.default(green).allowedValues(green,blue)",
      default: "green",
      allowedValues: ["green", "blue"],
    });
  });

  it("returns null for bare runtime input", () => {
    expect(parseRuntimeInputExpression("<+input>")).toBeNull();
  });

  it("strips quotes from default values", () => {
    expect(parseRuntimeInputExpression('<+input>.default("foo")')).toEqual({
      runtimeExpression: '<+input>.default("foo")',
      default: "foo",
    });
  });

  it("parses Harness expressions with nested parens in default", () => {
    expect(parseRuntimeInputExpression("<+input>.default(<+pipeline.name>)")).toEqual({
      runtimeExpression: "<+input>.default(<+pipeline.name>)",
      default: "<+pipeline.name>",
    });
  });

  it("parses quoted selectOneFrom values with commas inside quotes", () => {
    expect(
      parseRuntimeInputExpression('<+input>.selectOneFrom("us-east-1","us-west-2")'),
    ).toEqual({
      runtimeExpression: '<+input>.selectOneFrom("us-east-1","us-west-2")',
      allowedValues: ["us-east-1", "us-west-2"],
    });
  });

  it("parses selectOneFrom with nested parens in an allowed value", () => {
    expect(
      parseRuntimeInputExpression("<+input>.selectOneFrom(foo,bar(baz))"),
    ).toEqual({
      runtimeExpression: "<+input>.selectOneFrom(foo,bar(baz))",
      allowedValues: ["foo", "bar(baz)"],
    });
  });
});

describe("runtimeInputExtract enrichment", () => {
  it("returns variableInputMetadata from pipeline definition yaml without rewriting template", () => {
    const templateYaml =
      "pipeline:\n  variables:\n    - name: test\n      type: String\n      value: <+input>\n";
    const result = runtimeInputExtract(
      {
        data: {
          inputSetTemplateYaml: templateYaml,
        },
      },
      {
        _pipelineDefinitionYaml:
          "pipeline:\n  variables:\n    - name: test\n      type: String\n      value: <+input>.default(shashank).selectOneFrom(shashank,dheeraj)\n",
      },
    ) as Record<string, unknown>;

    expect(result.variableInputMetadata).toEqual({
      test: {
        runtimeExpression: "<+input>.default(shashank).selectOneFrom(shashank,dheeraj)",
        default: "shashank",
        allowedValues: ["shashank", "dheeraj"],
      },
    });
    expect(result.inputSetTemplateYaml).toBe(templateYaml);
    expect(String(result.inputSetTemplateYaml)).not.toContain("selectOneFrom");
  });
});

describe("extractVariableInputMetadata", () => {
  it("extracts metadata keyed by variable name", () => {
    const yaml = `
pipeline:
  variables:
    - name: env
      type: String
      value: <+input>.default(qa)
`;
    expect(extractVariableInputMetadata(yaml)).toEqual({
      env: {
        runtimeExpression: "<+input>.default(qa)",
        default: "qa",
      },
    });
  });
});

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

  it("walks parallel.stages and nested stage groups, omitting empty metadata", () => {
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
      DeployChild: { deploymentType: "NativeHelm", environmentRef: "childEnv" },
    });
  });

  it("omits stages with only deploymentType or only environmentRef", () => {
    const yaml = `
pipeline:
  stages:
    - stage:
        identifier: PartialType
        spec:
          deploymentType: Kubernetes
    - stage:
        identifier: PartialEnv
        spec:
          environment:
            environmentRef: prod
`;
    expect(buildStageMetadataMap(yaml)).toEqual({
      PartialType: { deploymentType: "Kubernetes", environmentRef: "" },
      PartialEnv: { deploymentType: "", environmentRef: "prod" },
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
