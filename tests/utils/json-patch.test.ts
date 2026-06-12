import { describe, it, expect } from "vitest";
import { applyJsonPatch, extractMutableBody, serializeBody, computeDiff, supportsJsonPatch, type PatchableResourceDefinition, type PatchOperation } from "../../src/utils/json-patch.js";

const patchableResource = (
  resourceType: string,
  bodyFields: readonly string[],
): PatchableResourceDefinition => ({
  resourceType,
  patchSupport: { kind: "yaml", bodyFields },
});

const pipelineResource = patchableResource("pipeline", ["yamlPipeline"]);
const pipelineV1Resource = patchableResource("pipeline_v1", ["pipeline_yaml", "yaml"]);
const templateResource = patchableResource("template", ["yaml"]);
const templateV1Resource = patchableResource("template_v1", ["template.yaml", "yaml", "template_yaml"]);
const inputSetResource = patchableResource("input_set", ["inputSetYaml"]);
const serviceResource: PatchableResourceDefinition = { resourceType: "service" };
const triggerResource: PatchableResourceDefinition = { resourceType: "trigger" };

describe("applyJsonPatch", () => {
  const baseDoc = {
    pipeline: {
      name: "My Pipeline",
      identifier: "my_pipeline",
      stages: [
        { stage: { name: "Build", identifier: "build", spec: { command: "npm build" } } },
        { stage: { name: "Deploy", identifier: "deploy", spec: { command: "npm deploy" } } },
      ],
      tags: ["ci"],
    },
  };

  it("applies a replace operation", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/name", value: "Renamed Pipeline" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect(result.pipeline).toHaveProperty("name", "Renamed Pipeline");
  });

  it("does not mutate the original document", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/name", value: "Changed" },
    ];
    applyJsonPatch(baseDoc, ops);
    expect((baseDoc.pipeline as any).name).toBe("My Pipeline");
  });

  it("applies an add operation", () => {
    const ops: PatchOperation[] = [
      { op: "add", path: "/pipeline/description", value: "A test pipeline" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect(result.pipeline).toHaveProperty("description", "A test pipeline");
  });

  it("appends to an array with /-", () => {
    const ops: PatchOperation[] = [
      { op: "add", path: "/pipeline/tags/-", value: "cd" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).tags).toEqual(["ci", "cd"]);
  });

  it("applies a remove operation", () => {
    const ops: PatchOperation[] = [
      { op: "remove", path: "/pipeline/tags" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect(result.pipeline).not.toHaveProperty("tags");
  });

  it("removes an array element by index", () => {
    const ops: PatchOperation[] = [
      { op: "remove", path: "/pipeline/stages/1" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).stages).toHaveLength(1);
    expect((result.pipeline as any).stages[0].stage.identifier).toBe("build");
  });

  it("applies a move operation", () => {
    const ops: PatchOperation[] = [
      { op: "move", from: "/pipeline/stages/0", path: "/pipeline/stages/1" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).stages[0].stage.identifier).toBe("deploy");
    expect((result.pipeline as any).stages[1].stage.identifier).toBe("build");
  });

  it("applies a copy operation", () => {
    const ops: PatchOperation[] = [
      { op: "copy", from: "/pipeline/stages/0", path: "/pipeline/stages/-" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).stages).toHaveLength(3);
    expect((result.pipeline as any).stages[2].stage.identifier).toBe("build");
  });

  it("applies a test operation (passes)", () => {
    const ops: PatchOperation[] = [
      { op: "test", path: "/pipeline/name", value: "My Pipeline" },
      { op: "replace", path: "/pipeline/name", value: "Updated" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect(result.pipeline).toHaveProperty("name", "Updated");
  });

  it("applies a test operation (fails)", () => {
    const ops: PatchOperation[] = [
      { op: "test", path: "/pipeline/name", value: "Wrong Name" },
      { op: "replace", path: "/pipeline/name", value: "Updated" },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow(/JSON Patch failed/);
  });

  it("applies multiple operations in sequence", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/name", value: "Updated Pipeline" },
      { op: "add", path: "/pipeline/tags/-", value: "prod" },
      { op: "replace", path: "/pipeline/stages/0/stage/spec/command", value: "npm run build:prod" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect(result.pipeline).toHaveProperty("name", "Updated Pipeline");
    expect((result.pipeline as any).tags).toEqual(["ci", "prod"]);
    expect((result.pipeline as any).stages[0].stage.spec.command).toBe("npm run build:prod");
  });

  it("throws on empty operations array", () => {
    expect(() => applyJsonPatch(baseDoc, [])).toThrow(/No patch operations provided/);
  });

  it("throws on invalid path", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/nonexistent/deep/path", value: "x" },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow(/JSON Patch failed/);
  });

  it("replaces a deeply nested value", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/stages/1/stage/spec/command", value: "kubectl apply" },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).stages[1].stage.spec.command).toBe("kubectl apply");
  });

  it("rejects __proto__ pollution attempts", () => {
    const ops: PatchOperation[] = [
      { op: "add", path: "/__proto__/polluted", value: true },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow();
  });

  it("rejects constructor.prototype pollution", () => {
    const ops: PatchOperation[] = [
      { op: "add", path: "/constructor/prototype/polluted", value: true },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow();
  });

  it("rejects root replacement with a scalar (path \"\")", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "", value: 1 },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow(/would replace the resource body with a number/);
  });

  it("rejects root replacement with an array (path \"\")", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "", value: [1, 2, 3] },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow(/would replace the resource body with an array/);
  });

  it("rejects root removal that empties the document (path \"\")", () => {
    const ops: PatchOperation[] = [
      { op: "remove", path: "" },
    ];
    expect(() => applyJsonPatch(baseDoc, ops)).toThrow(/would replace the resource body with a null/);
  });

  it("allows root replacement with an object (path \"\")", () => {
    const ops: PatchOperation[] = [
      { op: "replace", path: "", value: { pipeline: { name: "Fully Replaced" } } },
    ];
    const result = applyJsonPatch(baseDoc, ops);
    expect((result.pipeline as any).name).toBe("Fully Replaced");
  });
});

describe("extractMutableBody", () => {
  it("parses yamlPipeline string for pipeline resource type", () => {
    const getResult = {
      identifier: "my-pipe",
      name: "My Pipe",
      yamlPipeline: "pipeline:\n  name: My Pipeline\n  identifier: my_pipeline\n  stages: []",
    };
    const { document, yamlSource } = extractMutableBody(getResult, pipelineResource);
    expect(yamlSource).toBe(true);
    expect(document).toHaveProperty("pipeline");
    expect((document.pipeline as any).name).toBe("My Pipeline");
  });

  it("parses pipeline_yaml field for pipeline_v1", () => {
    const getResult = {
      identifier: "v1-pipe",
      pipeline_yaml: "pipeline:\n  name: V1 Pipeline\n  stages: []",
    };
    const { document, yamlSource } = extractMutableBody(getResult, pipelineV1Resource);
    expect(yamlSource).toBe(true);
    expect((document.pipeline as any).name).toBe("V1 Pipeline");
  });

  it("parses yaml field for templates", () => {
    const getResult = {
      identifier: "my-tmpl",
      yaml: "template:\n  name: My Template\n  type: Step",
    };
    const { document, yamlSource } = extractMutableBody(getResult, templateResource);
    expect(yamlSource).toBe(true);
    expect((document.template as any).name).toBe("My Template");
  });

  it("parses nested template.yaml for template_v1 GET shape", () => {
    const getResult = {
      template: {
        identifier: "my-tmpl",
        yaml: "version: 1\ntemplate:\n  name: My Template\n  type: Step",
      },
      inputs: { foo: "bar" },
      openInHarness: "https://app.harness.io/...",
    };
    const { document, yamlSource } = extractMutableBody(getResult, templateV1Resource);
    expect(yamlSource).toBe(true);
    expect((document.template as any).name).toBe("My Template");
  });

  it("falls back to top-level template_yaml for template_v1", () => {
    const getResult = {
      identifier: "my-tmpl",
      template_yaml: "version: 1\ntemplate:\n  name: My Template\n  type: Step",
    };
    const { document, yamlSource } = extractMutableBody(getResult, templateV1Resource);
    expect(yamlSource).toBe(true);
    expect((document.template as any).name).toBe("My Template");
  });

  it("parses inputSetYaml field for input_set", () => {
    const getResult = {
      identifier: "my-is",
      inputSetYaml: "inputSet:\n  name: My Input Set",
    };
    const { document, yamlSource } = extractMutableBody(getResult, inputSetResource);
    expect(yamlSource).toBe(true);
    expect((document.inputSet as any).name).toBe("My Input Set");
  });

  it("reports supported YAML-backed patch resources", () => {
    expect(supportsJsonPatch(pipelineResource)).toBe(true);
    expect(supportsJsonPatch(templateV1Resource)).toBe(true);
    expect(supportsJsonPatch({ resourceType: "pull_request" })).toBe(false);
  });

  it("rejects non-YAML resource types without a mutable-body projector", () => {
    const getResult = { identifier: "svc-1", name: "My Service", type: "K8s" };
    expect(() => extractMutableBody(getResult, serviceResource)).toThrow(/not configured/);
  });

  it("rejects trigger type because trigger update expects JSON, not YAML", () => {
    const getResult = { identifier: "trg-1", name: "My Trigger", enabled: true };
    expect(() => extractMutableBody(getResult, triggerResource)).toThrow(/not configured/);
  });

  it("throws for null GET response", () => {
    expect(() => extractMutableBody(null, pipelineResource)).toThrow(/not an object/);
  });

  it("throws for non-object GET response", () => {
    expect(() => extractMutableBody("just a string", pipelineResource)).toThrow(/not an object/);
  });

  it("throws when pipeline has no YAML field", () => {
    const getResult = { identifier: "pipe-1", name: "No YAML" };
    expect(() => extractMutableBody(getResult, pipelineResource)).toThrow(/does not contain a YAML body/);
  });
});

describe("serializeBody", () => {
  it("converts to YAML string when yamlSource is true", () => {
    const doc = { pipeline: { name: "Test", stages: [] } };
    const result = serializeBody(doc, true);
    expect(typeof result).toBe("string");
    expect(result).toContain("pipeline:");
    expect(result).toContain("name: Test");
  });

  it("returns JSON object when yamlSource is false", () => {
    const doc = { name: "My Service", identifier: "svc-1" };
    const result = serializeBody(doc, false);
    expect(typeof result).toBe("object");
    expect(result).toEqual(doc);
  });
});

describe("computeDiff", () => {
  it("returns operations describing the difference between two documents", () => {
    const original = { pipeline: { name: "Old", stages: [] } };
    const patched = { pipeline: { name: "New", stages: [], description: "added" } };
    const diff = computeDiff(original, patched);
    expect(diff.length).toBeGreaterThan(0);
    const paths = diff.map((op) => op.path);
    expect(paths).toContain("/pipeline/name");
    expect(paths).toContain("/pipeline/description");
  });

  it("returns empty array for identical documents", () => {
    const doc = { a: 1, b: "two" };
    expect(computeDiff(doc, doc)).toEqual([]);
  });
});

describe("YAML round-trip", () => {
  it("preserves structure through extract -> patch -> serialize", () => {
    const yaml = [
      "pipeline:",
      "  name: Original",
      "  identifier: my_pipeline",
      "  stages:",
      "    - stage:",
      "        name: Build",
      "        identifier: build",
      "        spec:",
      "          command: npm build",
    ].join("\n");

    const getResult = { yamlPipeline: yaml, identifier: "my_pipeline" };
    const { document, yamlSource } = extractMutableBody(getResult, pipelineResource);

    const ops: PatchOperation[] = [
      { op: "replace", path: "/pipeline/name", value: "Updated" },
      { op: "replace", path: "/pipeline/stages/0/stage/spec/command", value: "npm run build:ci" },
    ];
    const patched = applyJsonPatch(document, ops);
    const serialized = serializeBody(patched, yamlSource);

    expect(typeof serialized).toBe("string");
    const yamlStr = serialized as string;
    expect(yamlStr).toContain("name: Updated");
    expect(yamlStr).toContain("command: npm run build:ci");
    expect(yamlStr).toContain("identifier: my_pipeline");
    expect(yamlStr).toContain("identifier: build");
  });
});
