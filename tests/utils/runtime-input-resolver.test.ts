import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isFlatKeyValueInputs,
  substituteInputs,
  fetchRuntimeInputTemplate,
  resolveRuntimeInputs,
} from "../../src/utils/runtime-input-resolver.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import type { Config } from "../../src/config.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
  };
}

// A realistic runtime input template YAML from Harness
const SAMPLE_TEMPLATE_YAML = `pipeline:
  identifier: "my_pipeline"
  stages:
    - stage:
        identifier: "build"
        type: "CI"
        spec:
          execution:
            steps:
              - step:
                  identifier: "run_step"
                  type: "Run"
                  spec:
                    image: "<+input>"
  variables:
    - name: "branch"
      type: "String"
      value: "<+input>"
    - name: "environment"
      type: "String"
      value: "<+input>"
`;

const SIMPLE_TEMPLATE_YAML = `pipeline:
  identifier: "simple_pipe"
  variables:
    - name: "tag"
      type: "String"
      value: "<+input>"
`;

describe("isFlatKeyValueInputs", () => {
  it("returns true for string values", () => {
    expect(isFlatKeyValueInputs({ branch: "main", env: "prod" })).toBe(true);
  });

  it("returns true for mixed primitive values", () => {
    expect(isFlatKeyValueInputs({ count: 5, debug: true, name: "test" })).toBe(true);
  });

  it("returns false for string input", () => {
    expect(isFlatKeyValueInputs("pipeline:\n  identifier: foo")).toBe(false);
  });

  it("returns false for nested pipeline structure", () => {
    expect(isFlatKeyValueInputs({ pipeline: { identifier: "foo" } })).toBe(false);
  });

  it("returns false for objects with nested values", () => {
    expect(isFlatKeyValueInputs({ config: { nested: true } })).toBe(false);
  });

  it("returns false for arrays", () => {
    expect(isFlatKeyValueInputs(["a", "b"])).toBe(false);
  });

  it("returns false for null", () => {
    expect(isFlatKeyValueInputs(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFlatKeyValueInputs(undefined)).toBe(false);
  });

  it("returns true for empty object", () => {
    expect(isFlatKeyValueInputs({})).toBe(true);
  });
});

describe("substituteInputs", () => {
  it("substitutes matching leaf names", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {
      branch: "main",
      environment: "production",
    });

    expect(result.matched).toContain("branch");
    expect(result.matched).toContain("environment");
    expect(result.yaml).toContain("main");
    expect(result.yaml).toContain("production");
    // "image" placeholder was not matched — still has <+input>
    expect(result.unmatched).toContain("image");
    expect(result.matched).toHaveLength(2);
  });

  it("substitutes all placeholders when all values provided", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {
      branch: "develop",
      environment: "staging",
      image: "node:18",
    });

    expect(result.matched).toHaveLength(3);
    expect(result.unmatched).toHaveLength(0);
    expect(result.yaml).not.toContain("<+input>");
  });

  it("handles case-insensitive key matching", () => {
    const result = substituteInputs(SIMPLE_TEMPLATE_YAML, {
      TAG: "v1.0.0",
    });

    expect(result.matched).toContain("tag");
    expect(result.yaml).toContain("v1.0.0");
  });

  it("returns unmatched for missing user inputs", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {});

    expect(result.matched).toHaveLength(0);
    expect(result.unmatched.length).toBeGreaterThan(0);
  });

  it("preserves YAML structure", () => {
    const result = substituteInputs(SIMPLE_TEMPLATE_YAML, { tag: "latest" });

    expect(result.yaml).toContain("pipeline:");
    expect(result.yaml).toContain("identifier:");
    expect(result.yaml).toContain("variables:");
    expect(result.yaml).toContain("latest");
  });

  it("handles numeric values", () => {
    const template = `pipeline:
  variables:
    - name: "replicas"
      type: "Number"
      value: "<+input>"
`;
    const result = substituteInputs(template, { replicas: 3 });

    expect(result.matched).toContain("replicas");
    expect(result.yaml).toContain("3");
  });

  it("handles boolean values", () => {
    const template = `pipeline:
  variables:
    - name: "debug"
      type: "String"
      value: "<+input>"
`;
    const result = substituteInputs(template, { debug: true });

    expect(result.matched).toContain("debug");
    expect(result.yaml).toContain("true");
  });
});

describe("fetchRuntimeInputTemplate", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns template YAML when pipeline has runtime inputs", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          inputSetTemplateYaml: SIMPLE_TEMPLATE_YAML,
          hasInputSets: true,
          modules: ["ci"],
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await fetchRuntimeInputTemplate(client, {
      pipelineId: "my-pipeline",
      orgId: "default",
      projectId: "test-project",
    });

    expect(result).toBe(SIMPLE_TEMPLATE_YAML);

    const [url] = fetchSpy.mock.calls[0]!;
    const urlStr = String(url);
    expect(urlStr).toContain("/pipeline/api/inputSets/template");
    expect(urlStr).toContain("pipelineIdentifier=my-pipeline");
  });

  it("returns null when pipeline has no runtime inputs", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: {
          inputSetTemplateYaml: "",
          hasInputSets: false,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await fetchRuntimeInputTemplate(client, {
      pipelineId: "no-inputs-pipeline",
    });

    expect(result).toBeNull();
  });

  it("returns null when data has no template field", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: {},
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await fetchRuntimeInputTemplate(client, {
      pipelineId: "empty-pipeline",
    });

    expect(result).toBeNull();
  });
});

describe("resolveRuntimeInputs", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("resolves flat inputs against template", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: SIMPLE_TEMPLATE_YAML },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await resolveRuntimeInputs(
      client,
      { tag: "v2.0.0" },
      { pipelineId: "simple_pipe", orgId: "default", projectId: "test-project" },
    );

    expect(result.matched).toContain("tag");
    expect(result.unmatched).toHaveLength(0);
    expect(result.yaml).toContain("v2.0.0");
    expect(result.yaml).not.toContain("<+input>");
  });

  it("returns empty yaml when pipeline has no inputs", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: "" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await resolveRuntimeInputs(
      client,
      { someKey: "someValue" },
      { pipelineId: "no-inputs", orgId: "default", projectId: "test-project" },
    );

    expect(result.yaml).toBe("");
    expect(result.unmatched).toContain("someKey");
  });

  it("reports unmatched placeholders", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: SAMPLE_TEMPLATE_YAML },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await resolveRuntimeInputs(
      client,
      { branch: "main" },
      { pipelineId: "my_pipeline", orgId: "default", projectId: "test-project" },
    );

    expect(result.matched).toContain("branch");
    // "environment" and "image" are still unresolved
    expect(result.unmatched).toContain("environment");
    expect(result.unmatched).toContain("image");
  });
});
