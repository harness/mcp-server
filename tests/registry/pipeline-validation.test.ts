/**
 * Tests for the pipeline_validation resource — validate_schema and dry_run
 * execute actions. Verifies body construction, response extraction, and
 * error handling at the registry dispatch layer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

// ---------------------------------------------------------------------------
// validate_schema
// ---------------------------------------------------------------------------

describe("pipeline_validation validate_schema", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("sends correct body with yaml and version", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { valid: true, errorMessage: null, schemaErrors: null },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
      body: { yaml: "pipeline:\n  name: Test\n  identifier: test\n  stages: []\n", version: "v0" },
      org_id: "default",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toContain("/pipeline/api/pipelines/validate-yaml-schema");
    expect(call.body).toMatchObject({
      yaml: "pipeline:\n  name: Test\n  identifier: test\n  stages: []\n",
      version: "v0",
    });
  });

  it("defaults version to v0 when not specified", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { valid: true, errorMessage: null, schemaErrors: null },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
      body: { yaml: "pipeline:\n  name: Test\n  identifier: test\n  stages:\n    - stage:\n        name: s1\n        identifier: s1\n        type: Custom\n        spec:\n          execution:\n            steps: []\n" },
      org_id: "default",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.version).toBe("v0");
  });

  it("extracts valid response correctly", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { valid: true, errorMessage: null, schemaErrors: null },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
      body: { yaml: "pipeline:\n  name: Test\n  identifier: test\n  stages:\n    - stage:\n        name: s\n        identifier: s\n        type: Custom\n        spec:\n          execution:\n            steps: []\n" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      valid: true,
      error_message: null,
      errors: [],
    });
  });

  it("extracts schema errors with FQN paths", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        valid: false,
        errorMessage: "$.pipeline.stages: there must be a minimum of 1 items in the array",
        schemaErrors: {
          type: "YamlSchemaErrorWrapperDTO",
          schemaErrors: [
            {
              message: "there must be a minimum of 1 items in the array",
              messageWithFQN: "$.pipeline.stages: there must be a minimum of 1 items in the array",
              fqn: "$.pipeline.stages",
              stageInfo: null,
              stepInfo: null,
              hintMessage: null,
            },
          ],
        },
      },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
      body: { yaml: "pipeline:\n  name: Test\n  identifier: test\n  stages: []\n", version: "v0" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      valid: false,
      error_message: "$.pipeline.stages: there must be a minimum of 1 items in the array",
      errors: [
        {
          message: "$.pipeline.stages: there must be a minimum of 1 items in the array",
          path: "$.pipeline.stages",
          hint: null,
        },
      ],
    });
  });

  it("throws when body.yaml is missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
        body: { version: "v0" },
        org_id: "default",
        project_id: "my-project",
      }),
    ).rejects.toThrow("body.yaml is required");
  });

  it("handles unparseable YAML response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        valid: false,
        errorMessage: "$: string found, object expected",
        schemaErrors: {
          type: "YamlSchemaErrorWrapperDTO",
          schemaErrors: [
            {
              message: "$: string found, object expected",
              messageWithFQN: "$: string found, object expected",
              fqn: "$",
              hintMessage: null,
            },
          ],
        },
      },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "validate_schema", {
      body: { yaml: "totally not yaml [[[", version: "v0" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      valid: false,
      error_message: "$: string found, object expected",
      errors: [
        {
          message: "$: string found, object expected",
          path: "$",
          hint: null,
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// dry_run
// ---------------------------------------------------------------------------

describe("pipeline_validation dry_run", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("sends correct body with pipeline_identifier only", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: true,
      validation: [],
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: { pipeline_identifier: "my_pipeline" },
      org_id: "default",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toContain("/dry-run");
    expect(call.body).toMatchObject({ pipeline_identifier: "my_pipeline" });
  });

  it("includes pipeline_yaml when provided", async () => {
    const yaml = "pipeline:\n  name: Test\n  identifier: my_pipeline\n  stages: []\n";
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: true,
      validation: [],
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: { pipeline_identifier: "my_pipeline", pipeline_yaml: yaml },
      org_id: "default",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toMatchObject({
      pipeline_identifier: "my_pipeline",
      pipeline_yaml: yaml,
    });
  });

  it("extracts valid dry_run response", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: true,
      validation: [],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: { pipeline_identifier: "my_pipeline" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      is_valid: true,
      validation: [],
    });
  });

  it("extracts validation errors with typed entries", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: false,
      validation: [
        {
          validation_type: "SCHEMA",
          entity_type: "PIPELINE",
          entity_identifier: "my_pipeline",
          error_message: "Failed to create execution plan: Codebase is mandatory with enabled cloneCodebase flag",
          hint: "Ensure your pipeline is properly configured.",
        },
        {
          validation_type: "POLICY",
          entity_type: "PIPELINE",
          entity_identifier: "my_pipeline",
          error_message: "Policy checks skipped: Resolved pipeline YAML is not available",
          hint: "Ensure the pipeline has valid YAML.",
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: { pipeline_identifier: "my_pipeline" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      is_valid: false,
      validation: [
        {
          type: "SCHEMA",
          entity: "my_pipeline",
          error: "Failed to create execution plan: Codebase is mandatory with enabled cloneCodebase flag",
          hint: "Ensure your pipeline is properly configured.",
        },
        {
          type: "POLICY",
          entity: "my_pipeline",
          error: "Policy checks skipped: Resolved pipeline YAML is not available",
          hint: "Ensure the pipeline has valid YAML.",
        },
      ],
    });
  });

  it("handles SYSTEM error for v1 pipelines", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: false,
      validation: [
        {
          validation_type: "SYSTEM",
          entity_type: null,
          entity_identifier: "my_v1_pipeline",
          error_message: "Unexpected error during dry run: Following yaml paths could not be parsed: pipeline/stages/[0]",
          hint: "Please contact support if this issue persists.",
        },
      ],
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: { pipeline_identifier: "my_v1_pipeline" },
      org_id: "default",
      project_id: "my-project",
    });

    expect(result).toEqual({
      is_valid: false,
      validation: [
        {
          type: "SYSTEM",
          entity: "my_v1_pipeline",
          error: "Unexpected error during dry run: Following yaml paths could not be parsed: pipeline/stages/[0]",
          hint: "Please contact support if this issue persists.",
        },
      ],
    });
  });

  it("throws when pipeline_identifier is missing", async () => {
    const client = makeClient();

    await expect(
      registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
        body: { pipeline_yaml: "pipeline:\n  name: x\n" },
        org_id: "default",
        project_id: "my-project",
      }),
    ).rejects.toThrow("body.pipeline_identifier is required");
  });

  it("includes branch and inputset_ref when provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      is_valid: true,
      validation: [],
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_validation", "dry_run", {
      body: {
        pipeline_identifier: "my_pipeline",
        branch: "feature/test",
        inputset_ref: "my_inputset",
      },
      org_id: "default",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toMatchObject({
      pipeline_identifier: "my_pipeline",
      branch: "feature/test",
      inputset_ref: "my_inputset",
    });
  });
});
