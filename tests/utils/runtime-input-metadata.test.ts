import { describe, expect, it } from "vitest";
import {
  extractVariableInputMetadata,
  mergeTemplateYamlWithDefinitionVariables,
  parseRuntimeInputExpression,
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

describe("mergeTemplateYamlWithDefinitionVariables", () => {
  it("merges richer variable expressions from pipeline definition into template", () => {
    const template = `
pipeline:
  identifier: CD_Deploy_Pipeline
  variables:
    - name: test
      type: String
      value: <+input>
`;
    const definition = `
pipeline:
  identifier: CD_Deploy_Pipeline
  variables:
    - name: test
      type: String
      value: <+input>.default(shashank).selectOneFrom(shashank,dheeraj)
`;
    const merged = mergeTemplateYamlWithDefinitionVariables(template, definition);
    expect(merged).toContain(
      "value: <+input>.default(shashank).selectOneFrom(shashank,dheeraj)",
    );
  });
});

describe("runtimeInputExtract enrichment", () => {
  it("returns variableInputMetadata from pipeline definition yaml", () => {
    const result = runtimeInputExtract(
      {
        data: {
          inputSetTemplateYaml:
            "pipeline:\n  variables:\n    - name: test\n      type: String\n      value: <+input>\n",
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
    expect(String(result.inputSetTemplateYaml)).toContain("selectOneFrom(shashank,dheeraj)");
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
