/**
 * Tests for pipeline_v1 resource — body builder and execute action request shape.
 *
 * buildV1PipelineBody accepts flexible input shapes (raw YAML, pipeline_yaml,
 * yamlPipeline backwards compat, JSON pipeline object). The execute run action
 * serializes runtime inputs to inputs_yaml. These paths have no other focused
 * coverage and regressions would break v1 pipeline create/update/execute flows.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

const sampleV1Yaml = `version: 1
pipeline:
  id: my_pipeline
  name: My Pipeline
  stages:
    - id: build
      name: Build
      steps:
        - id: run
          name: Run
          run:
            script: echo hi
`;

describe("pipeline_v1 create/update — buildV1PipelineBody", () => {
  it("accepts raw YAML string body and extracts identifier/name when present in YAML", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ id: "extracted_id" });
    const client = makeClient(mockRequest);

    const yamlWithMeta = `version: 1
pipeline:
  identifier: extracted_id
  name: Extracted Name
  stages: []
`;

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "default",
      project_id: "test-project",
      body: yamlWithMeta,
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body.pipeline_yaml).toBe(yamlWithMeta);
    expect(call.body).toMatchObject({
      identifier: "extracted_id",
      name: "Extracted Name",
      version: "1",
    });
  });

  it("maps pipeline_yaml field from object body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ id: "explicit" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "default",
      project_id: "test-project",
      body: {
        pipeline_yaml: sampleV1Yaml,
        identifier: "explicit_id",
        name: "Explicit Name",
        description: "A test pipeline",
      },
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body).toMatchObject({
      pipeline_yaml: sampleV1Yaml,
      identifier: "explicit_id",
      name: "Explicit Name",
      description: "A test pipeline",
      version: "1",
    });
  });

  it("supports yamlPipeline backwards-compat alias", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ id: "legacy" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "legacy",
      body: { yamlPipeline: sampleV1Yaml, identifier: "legacy", name: "Legacy" },
    });

    const call = mockRequest.mock.calls[0][0] as { path: string; body: Record<string, unknown> };
    expect(call.body.pipeline_yaml).toBe(sampleV1Yaml);
    expect(call.path).toBe("/v1/orgs/default/projects/test-project/pipelines/legacy");
  });

  it("serializes pipeline JSON object to pipeline_yaml", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ id: "json_pipe" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "default",
      project_id: "test-project",
      body: {
        pipeline: {
          id: "json_pipe",
          name: "JSON Pipeline",
          stages: [],
        },
        identifier: "json_pipe",
        name: "JSON Pipeline",
      },
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(typeof call.body.pipeline_yaml).toBe("string");
    expect(call.body.pipeline_yaml).toContain("json_pipe");
  });

  it("rejects create when body is missing", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "pipeline_v1", "create", {
        org_id: "default",
        project_id: "test-project",
      }),
    ).rejects.toThrow(/body is required/);
  });
});

describe("pipeline_v1 execute run — inputs serialization", () => {
  it("serializes object inputs to inputs_yaml", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ execution_id: "exec-1" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_v1", "run", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "my_pipeline",
      inputs: { branch: "main", tag: "v1.0.0" },
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(typeof call.body.inputs_yaml).toBe("string");
    expect(call.body.inputs_yaml).toContain("branch: main");
    expect(call.body.inputs_yaml).toContain("tag: v1.0.0");
    expect(call.path).toBe("/v1/orgs/default/projects/test-project/pipelines/my_pipeline/execute");
  });

  it("passes string inputs directly as inputs_yaml", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ execution_id: "exec-2" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_v1", "run", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "my_pipeline",
      inputs: "branch: develop\n",
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ inputs_yaml: "branch: develop\n" });
  });

  it("sends empty body when inputs are omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ execution_id: "exec-3" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "pipeline_v1", "run", {
      org_id: "default",
      project_id: "test-project",
      pipeline_id: "my_pipeline",
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({});
  });
});
