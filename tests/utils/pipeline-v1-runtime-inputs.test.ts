/**
 * Unit tests for pipeline_v1 runtime input normalization and body building.
 *
 * harness_execute integration tests in tool-handlers.test.ts cover the MCP
 * wiring; these pin the pure helpers introduced in #890 at the source.
 */
import { describe, it, expect } from "vitest";
import YAML from "yaml";
import {
  buildV1RuntimeInputsBody,
  normalizeV1PipelineRunInputs,
} from "../../src/utils/pipeline-v1-runtime-inputs.js";

describe("normalizeV1PipelineRunInputs", () => {
  it("returns undefined when no runtime input source is provided", () => {
    const input: Record<string, unknown> = {};
    expect(normalizeV1PipelineRunInputs(input)).toBeUndefined();
    expect(input).toEqual({});
  });

  it("copies body.inputs onto input.inputs as the canonical source", () => {
    const input: Record<string, unknown> = {
      body: { inputs: { branch: "main" } },
    };
    expect(normalizeV1PipelineRunInputs(input)).toBeUndefined();
    expect(input.inputs).toEqual({ branch: "main" });
  });

  it("copies body.inputs_yaml onto input.inputs as the canonical source", () => {
    const inputsYaml = "inputs:\n  branch: main\n";
    const input: Record<string, unknown> = {
      body: { inputs_yaml: inputsYaml },
    };
    expect(normalizeV1PipelineRunInputs(input)).toBeUndefined();
    expect(input.inputs).toBe(inputsYaml);
  });

  it("rejects conflicting runtime input sources before execution", () => {
    const input: Record<string, unknown> = {
      inputs: { branch: "a" },
      body: { inputs_yaml: "inputs:\n  branch: b\n" },
    };
    expect(normalizeV1PipelineRunInputs(input)).toMatch(
      /Conflicting pipeline_v1 runtime inputs/,
    );
  });

  it("rejects non-string body.inputs_yaml aliases", () => {
    const input: Record<string, unknown> = {
      body: { inputs_yaml: { inputs: { branch: "main" } } },
    };
    expect(normalizeV1PipelineRunInputs(input)).toBe(
      "body.inputs_yaml must be a YAML string for pipeline_v1 execution.",
    );
  });

  it("rejects array runtime inputs", () => {
    const input: Record<string, unknown> = {
      inputs: ["branch", "environment"],
    };
    expect(normalizeV1PipelineRunInputs(input)).toBe(
      "inputs must be a YAML string or key-value object for pipeline_v1 execution.",
    );
  });
});

describe("buildV1RuntimeInputsBody", () => {
  it("returns an empty body when runtime inputs are absent", () => {
    expect(buildV1RuntimeInputsBody({})).toEqual({});
    expect(buildV1RuntimeInputsBody({ inputs: null })).toEqual({});
    expect(buildV1RuntimeInputsBody({ inputs: undefined })).toEqual({});
  });

  it("wraps key-value runtime inputs under the API inputs_yaml document", () => {
    const body = buildV1RuntimeInputsBody({
      inputs: { branch: "feature/my-fix", environment: "qa" },
    });
    expect(YAML.parse(body.inputs_yaml as string)).toEqual({
      inputs: { branch: "feature/my-fix", environment: "qa" },
    });
  });

  it("wraps unrooted YAML strings under inputs", () => {
    const body = buildV1RuntimeInputsBody({
      inputs: "branch: feature/my-fix\n",
    });
    expect(YAML.parse(body.inputs_yaml as string)).toEqual({
      inputs: { branch: "feature/my-fix" },
    });
  });

  it("preserves YAML that already has only an inputs root", () => {
    const inputsYaml = "inputs:\n  branch: feature/my-fix\n";
    const body = buildV1RuntimeInputsBody({ inputs: inputsYaml });
    expect(body).toEqual({ inputs_yaml: inputsYaml });
  });

  it.each([
    ["scalar YAML", "just-a-string\n"],
    ["array YAML root", "- branch\n- environment\n"],
    ["non-mapping inputs root", "inputs:\n  - branch\n"],
    ["extra top-level keys", "inputs:\n  branch: main\nextra: value\n"],
  ])("rejects invalid pipeline_v1 %s", (_caseName, inputs) => {
    expect(() => buildV1RuntimeInputsBody({ inputs })).toThrow(/pipeline_v1 inputs/);
  });

  it("rejects non-object runtime input objects", () => {
    expect(() => buildV1RuntimeInputsBody({ inputs: ["branch"] })).toThrow(
      "pipeline_v1 inputs must be a YAML string or key-value object",
    );
  });
});
