import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isFlatKeyValueInputs,
  isResolvableInputs,
  flattenInputs,
  substituteInputs,
  fetchRuntimeInputTemplate,
  resolveRuntimeInputs,
  clearTemplateCache,
} from "../../src/utils/runtime-input-resolver.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import type { Config } from "../../src/config.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
  };
}

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

const MIXED_TEMPLATE_YAML = `pipeline:
  identifier: "mixed_pipe"
  properties:
    ci:
      codebase:
        repoName: "<+input>"
        build: "<+input>"
  variables:
    - name: "SERVICE_LIST"
      type: "String"
      value: "<+input>"
    - name: "DEPLOY"
      type: "String"
      value: "<+input>.default(true).allowedValues(true,false)"
    - name: "HAR_REGISTRY"
      type: "String"
      value: "<+input>.default(https://registry.example.com)"
`;

const DEFAULTS_ONLY_TEMPLATE_YAML = `pipeline:
  identifier: "defaults_pipe"
  variables:
    - name: "JAVA_BUILD"
      type: "String"
      value: "<+input>.default(true).allowedValues(true, false)"
    - name: "PYTHON_BUILD"
      type: "String"
      value: "<+input>.default(false).allowedValues(true, false)"
    - name: "NPM_BUILD"
      type: "String"
      value: "<+input>.default(false).selectOneFrom(true,false)"
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
    expect(result.unmatchedRequired).toContain("image");
    expect(result.matched).toHaveLength(2);
  });

  it("substitutes all placeholders when all values provided", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {
      branch: "develop",
      environment: "staging",
      image: "node:18",
    });

    expect(result.matched).toHaveLength(3);
    expect(result.unmatchedRequired).toHaveLength(0);
    expect(result.unmatchedOptional).toHaveLength(0);
    expect(result.yaml).not.toContain("<+input>");
  });

  it("handles case-insensitive key matching", () => {
    const result = substituteInputs(SIMPLE_TEMPLATE_YAML, {
      TAG: "v1.0.0",
    });

    expect(result.matched).toContain("tag");
    expect(result.yaml).toContain("v1.0.0");
  });

  it("returns unmatchedRequired for missing user inputs on required fields", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {});

    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedRequired.length).toBeGreaterThan(0);
    expect(result.unmatchedRequired).toContain("branch");
    expect(result.unmatchedRequired).toContain("environment");
    expect(result.unmatchedRequired).toContain("image");
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

  it("classifies <+input>.default(...) as optional", () => {
    const result = substituteInputs(MIXED_TEMPLATE_YAML, {});

    expect(result.unmatchedRequired).toContain("repoName");
    expect(result.unmatchedRequired).toContain("build");
    expect(result.unmatchedRequired).toContain("SERVICE_LIST");
    expect(result.unmatchedOptional).toContain("DEPLOY");
    expect(result.unmatchedOptional).toContain("HAR_REGISTRY");
    expect(result.unmatchedRequired).toHaveLength(3);
    expect(result.unmatchedOptional).toHaveLength(2);
  });

  it("classifies <+input>.allowedValues(...) without default as required", () => {
    const template = `pipeline:
  variables:
    - name: "region"
      type: "String"
      value: "<+input>.allowedValues(us-east-1,eu-west-1)"
`;
    const result = substituteInputs(template, {});

    expect(result.unmatchedRequired).toContain("region");
    expect(result.unmatchedOptional).toHaveLength(0);
  });

  it("classifies <+input>.default(...).allowedValues(...) as optional", () => {
    const result = substituteInputs(DEFAULTS_ONLY_TEMPLATE_YAML, {});

    expect(result.unmatchedRequired).toHaveLength(0);
    expect(result.unmatchedOptional).toHaveLength(3);
    expect(result.unmatchedOptional).toContain("JAVA_BUILD");
    expect(result.unmatchedOptional).toContain("PYTHON_BUILD");
    expect(result.unmatchedOptional).toContain("NPM_BUILD");
  });

  it("still substitutes optional fields when values provided", () => {
    const result = substituteInputs(DEFAULTS_ONLY_TEMPLATE_YAML, {
      JAVA_BUILD: "false",
    });

    expect(result.matched).toContain("java_build");
    expect(result.unmatchedOptional).toHaveLength(2);
    expect(result.yaml).toContain("false");
  });

  it("returns expectedKeys for all placeholders", () => {
    const result = substituteInputs(SAMPLE_TEMPLATE_YAML, {});

    expect(result.expectedKeys).toContain("branch");
    expect(result.expectedKeys).toContain("environment");
    expect(result.expectedKeys).toContain("image");
    expect(result.expectedKeys).toHaveLength(3);
  });

  it("returns expectedKeys for mixed required/optional templates", () => {
    const result = substituteInputs(MIXED_TEMPLATE_YAML, {});

    expect(result.expectedKeys).toContain("repoName");
    expect(result.expectedKeys).toContain("build");
    expect(result.expectedKeys).toContain("SERVICE_LIST");
    expect(result.expectedKeys).toContain("DEPLOY");
    expect(result.expectedKeys).toContain("HAR_REGISTRY");
    expect(result.expectedKeys).toHaveLength(5);
  });

  it("handles mixed match: some provided, rest split into required/optional", () => {
    const result = substituteInputs(MIXED_TEMPLATE_YAML, {
      SERVICE_LIST: "my-service",
    });

    expect(result.matched).toContain("service_list");
    expect(result.unmatchedRequired).toContain("repoName");
    expect(result.unmatchedRequired).toContain("build");
    expect(result.unmatchedOptional).toContain("DEPLOY");
    expect(result.unmatchedOptional).toContain("HAR_REGISTRY");
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
    expect(result.unmatchedRequired).toHaveLength(0);
    expect(result.unmatchedOptional).toHaveLength(0);
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
    expect(result.unmatchedRequired).toHaveLength(0);
    expect(result.unmatchedOptional).toHaveLength(0);
  });

  it("reports unmatched required placeholders", async () => {
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
    expect(result.unmatchedRequired).toContain("environment");
    expect(result.unmatchedRequired).toContain("image");
    expect(result.unmatchedOptional).toHaveLength(0);
  });

  it("separates required and optional unmatched for mixed templates", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: MIXED_TEMPLATE_YAML },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await resolveRuntimeInputs(
      client,
      { SERVICE_LIST: "my-svc" },
      { pipelineId: "mixed_pipe", orgId: "default", projectId: "test-project" },
    );

    expect(result.matched).toContain("service_list");
    expect(result.unmatchedRequired).toContain("repoName");
    expect(result.unmatchedRequired).toContain("build");
    expect(result.unmatchedOptional).toContain("DEPLOY");
    expect(result.unmatchedOptional).toContain("HAR_REGISTRY");
    expect(result.expectedKeys).toHaveLength(5);
  });

  it("returns all empty arrays when all defaults-only template has no user inputs", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: DEFAULTS_ONLY_TEMPLATE_YAML },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const result = await resolveRuntimeInputs(
      client,
      {},
      { pipelineId: "defaults_pipe", orgId: "default", projectId: "test-project" },
    );

    expect(result.unmatchedRequired).toHaveLength(0);
    expect(result.unmatchedOptional).toHaveLength(3);
    expect(result.yaml).toContain("<+input>.default");
  });
});

describe("fetchRuntimeInputTemplate — caching", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearTemplateCache();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    clearTemplateCache();
  });

  it("returns cached template on second call without hitting API", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: SIMPLE_TEMPLATE_YAML },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const opts = { pipelineId: "cached_pipe", orgId: "default", projectId: "test-project" };

    const first = await fetchRuntimeInputTemplate(client, opts);
    const second = await fetchRuntimeInputTemplate(client, opts);

    expect(first).toBe(second);
    expect(first).toBe(SIMPLE_TEMPLATE_YAML);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("uses separate cache entries for different pipelines", async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: "SUCCESS",
          data: { inputSetTemplateYaml: SIMPLE_TEMPLATE_YAML },
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          status: "SUCCESS",
          data: { inputSetTemplateYaml: SAMPLE_TEMPLATE_YAML },
        }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );

    const client = new HarnessClient(makeConfig());

    const first = await fetchRuntimeInputTemplate(client, { pipelineId: "pipe_a", orgId: "default", projectId: "proj" });
    const second = await fetchRuntimeInputTemplate(client, { pipelineId: "pipe_b", orgId: "default", projectId: "proj" });

    expect(first).toBe(SIMPLE_TEMPLATE_YAML);
    expect(second).toBe(SAMPLE_TEMPLATE_YAML);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("caches null result for pipelines with no runtime inputs", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({
        status: "SUCCESS",
        data: { inputSetTemplateYaml: "" },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = new HarnessClient(makeConfig());
    const opts = { pipelineId: "no_inputs_pipe", orgId: "default", projectId: "proj" };

    const first = await fetchRuntimeInputTemplate(client, opts);
    const second = await fetchRuntimeInputTemplate(client, opts);

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("isResolvableInputs", () => {
  it("returns true for flat key-value pairs", () => {
    expect(isResolvableInputs({ branch: "main" })).toBe(true);
  });

  it("returns true for structural/nested inputs", () => {
    expect(isResolvableInputs({ build: { type: "branch", spec: { branch: "main" } } })).toBe(true);
  });

  it("returns true for mixed flat and nested inputs", () => {
    expect(isResolvableInputs({ repoName: "my-repo", build: { type: "branch" } })).toBe(true);
  });

  it("returns false for full pipeline YAML structure", () => {
    expect(isResolvableInputs({ pipeline: { identifier: "foo" } })).toBe(false);
  });

  it("returns false for strings", () => {
    expect(isResolvableInputs("pipeline:\n  identifier: foo")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isResolvableInputs(null)).toBe(false);
    expect(isResolvableInputs(undefined)).toBe(false);
  });

  it("returns true for empty object", () => {
    expect(isResolvableInputs({})).toBe(true);
  });
});

describe("flattenInputs", () => {
  it("returns flat inputs unchanged", () => {
    const result = flattenInputs({ branch: "main", env: "prod" });
    expect(result).toEqual({ branch: "main", env: "prod" });
  });

  it("flattens nested objects into dot-separated keys", () => {
    const result = flattenInputs({
      build: { type: "branch", spec: { branch: "main" } },
    });
    expect(result["build"]).toEqual({ type: "branch", spec: { branch: "main" } });
    expect(result["build.type"]).toBe("branch");
    expect(result["build.spec"]).toEqual({ branch: "main" });
    expect(result["build.spec.branch"]).toBe("main");
  });

  it("preserves top-level primitives alongside nested objects", () => {
    const result = flattenInputs({
      repoName: "schema-service",
      build: { type: "branch", spec: { branch: "main" } },
    });
    expect(result["repoName"]).toBe("schema-service");
    expect(result["build.type"]).toBe("branch");
    expect(result["build.spec.branch"]).toBe("main");
  });

  it("treats arrays as leaf values", () => {
    const result = flattenInputs({ tags: ["a", "b"] });
    expect(result["tags"]).toEqual(["a", "b"]);
    expect(result["tags.0"]).toBeUndefined();
  });
});

describe("substituteInputs — structural inputs", () => {
  it("substitutes a whole-object <+input> placeholder with a structural value", () => {
    const result = substituteInputs(MIXED_TEMPLATE_YAML, {
      reponame: "schema-service",
      build: { type: "branch", spec: { branch: "main" } },
      service_list: "my-svc",
    });

    expect(result.matched).toContain("reponame");
    expect(result.matched).toContain("build");
    expect(result.matched).toContain("service_list");
    expect(result.unmatchedRequired).toHaveLength(0);
    // The YAML should contain the expanded build structure
    expect(result.yaml).toContain("schema-service");
    expect(result.yaml).toContain("branch");
    // Optional fields (DEPLOY, HAR_REGISTRY) still have <+input>.default(...) — that's expected
  });

  it("produces valid YAML when replacing scalar with object", () => {
    const template = `pipeline:
  properties:
    ci:
      codebase:
        build: "<+input>"
`;
    const result = substituteInputs(template, {
      build: { type: "branch", spec: { branch: "develop" } },
    });

    expect(result.matched).toContain("build");
    expect(result.unmatchedRequired).toHaveLength(0);
    // Parse the output to verify it's valid YAML with the correct structure
    const YAML = require("yaml");
    const parsed = YAML.parse(result.yaml);
    expect(parsed.pipeline.properties.ci.codebase.build).toEqual({
      type: "branch",
      spec: { branch: "develop" },
    });
  });

  it("handles suffix matching for flattened structural inputs", () => {
    // Template with individual <+input> placeholders nested under build
    const template = `pipeline:
  properties:
    ci:
      codebase:
        repoName: "<+input>"
        build:
          type: "<+input>"
          spec:
            branch: "<+input>"
`;
    // Flattened inputs (as produced by flattenInputs)
    const result = substituteInputs(template, {
      reponame: "my-repo",
      "build.type": "branch",
      "build.spec.branch": "main",
    });

    expect(result.matched).toContain("reponame");
    expect(result.matched).toContain("build.type");
    expect(result.matched).toContain("build.spec.branch");
    expect(result.unmatchedRequired).toHaveLength(0);

    const YAML = require("yaml");
    const parsed = YAML.parse(result.yaml);
    expect(parsed.pipeline.properties.ci.codebase.repoName).toBe("my-repo");
    expect(parsed.pipeline.properties.ci.codebase.build.type).toBe("branch");
    expect(parsed.pipeline.properties.ci.codebase.build.spec.branch).toBe("main");
  });

  it("end-to-end: flattenInputs + substituteInputs for codebase build", () => {
    // This simulates the actual user scenario: passing codebase inputs
    const userInputs = {
      repoName: "schema-service",
      build: { type: "branch", spec: { branch: "main" } },
    };

    // The MIXED_TEMPLATE_YAML has repoName: <+input> and build: <+input>
    const flattened = flattenInputs(userInputs);
    const result = substituteInputs(MIXED_TEMPLATE_YAML, {
      ...flattened,
      service_list: "my-svc",
    });

    expect(result.matched).toContain("reponame");
    expect(result.matched).toContain("build");
    expect(result.matched).toContain("service_list");
    expect(result.unmatchedRequired).toHaveLength(0);

    const YAML = require("yaml");
    const parsed = YAML.parse(result.yaml);
    expect(parsed.pipeline.properties.ci.codebase.repoName).toBe("schema-service");
    expect(parsed.pipeline.properties.ci.codebase.build).toEqual({
      type: "branch",
      spec: { branch: "main" },
    });
  });
});
