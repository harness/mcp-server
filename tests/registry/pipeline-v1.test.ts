/**
 * Contract tests for pipeline_v1 create/update bodyBuilder (buildV1PipelineBody).
 *
 * PR #439 fixed id-based v1 YAML: real v1 pipelines use `pipeline.id`, not
 * `pipeline.identifier`. These tests lock the extraction precedence, typeof
 * guards, and update-path behavior so regressions fail at the registry layer
 * without needing full harness_create integration setup.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { pipelinesToolset } from "../../src/registry/toolsets/pipelines.js";

const pipelineV1 = pipelinesToolset.resources.find((r) => r.resourceType === "pipeline_v1");
if (!pipelineV1) {
  throw new Error("pipeline_v1 resource missing from pipelinesToolset");
}
const createSpec = pipelineV1.operations.create;
const updateSpec = pipelineV1.operations.update;
if (!createSpec?.bodyBuilder || !updateSpec?.bodyBuilder) {
  throw new Error("pipeline_v1 create/update bodyBuilder missing");
}
const buildBody = createSpec.bodyBuilder;

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

describe("pipeline_v1 bodyBuilder — v1 id extraction", () => {
  it("extracts identifier from pipeline.id in raw YAML", () => {
    const yaml = [
      "pipeline:",
      "  id: simple_build",
      "  name: Simple Build",
      "  stages: []",
    ].join("\n");

    const body = buildBody({ body: yaml });
    expect(body).toMatchObject({
      pipeline_yaml: yaml,
      identifier: "simple_build",
      name: "Simple Build",
      version: "1",
    });
  });

  it("prefers pipeline.identifier over pipeline.id when both are present", () => {
    const yaml = [
      "pipeline:",
      "  identifier: legacy_id",
      "  id: v1_id",
      "  name: Dual Keys",
      "  stages: []",
    ].join("\n");

    const body = buildBody({ body: yaml });
    expect(body.identifier).toBe("legacy_id");
  });

  it("does not overwrite an explicit top-level identifier with YAML id", () => {
    const yaml = "pipeline:\n  id: from_yaml\n  name: Named\n  stages: []";

    const body = buildBody({
      body: {
        pipeline_yaml: yaml,
        identifier: "explicit_id",
        name: "Named",
      },
    });
    expect(body.identifier).toBe("explicit_id");
  });

  it("ignores non-string id values (typeof guard)", () => {
    const body = buildBody({
      body: {
        pipeline: {
          id: 42,
          name: "Numeric Id",
          stages: [],
        },
      },
    });
    expect(body.identifier).toBeUndefined();
    expect(body.name).toBe("Numeric Id");
  });

  it("serializes JSON pipeline objects with id into YAML (not identifier)", () => {
    const body = buildBody({
      body: {
        pipeline: {
          id: "json_build",
          name: "JSON Build",
          clone: { enabled: false },
          stages: [],
        },
      },
    });

    expect(body).toMatchObject({
      identifier: "json_build",
      name: "JSON Build",
      version: "1",
    });
    expect(body.pipeline_yaml).toContain("id: json_build");
    expect(body.pipeline_yaml).not.toContain("identifier:");
  });
});

describe("pipeline_v1 bodyBuilder — input shapes and metadata", () => {
  it("maps yamlPipeline alias to pipeline_yaml", () => {
    const yaml = "pipeline:\n  id: alias_pipe\n  name: Alias\n  stages: []";
    const body = buildBody({ body: { yamlPipeline: yaml } });
    expect(body.pipeline_yaml).toBe(yaml);
    expect(body.identifier).toBe("alias_pipe");
  });

  it("preserves explicit version, description, and tags", () => {
    const body = buildBody({
      body: {
        pipeline_yaml: "pipeline:\n  id: meta_pipe\n  name: Meta\n  stages: []",
        identifier: "meta_pipe",
        name: "Meta",
        version: "3",
        description: "desc",
        tags: { team: "platform" },
      },
    });

    expect(body).toMatchObject({
      identifier: "meta_pipe",
      name: "Meta",
      version: "3",
      description: "desc",
      tags: { team: "platform" },
    });
  });

  it("throws when body is missing", () => {
    expect(() => buildBody({})).toThrow(/body is required/i);
  });
});

describe("pipeline_v1 update dispatch — id extraction on wire", () => {
  it("extracts identifier from v1 YAML id on update", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "simple_build" });
    const client = makeClient(mockRequest);

    const yaml = [
      "pipeline:",
      "  id: simple_build",
      "  name: Simple Build",
      "  stages: []",
    ].join("\n");

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "simple_build",
      org_id: "default",
      project_id: "test-project",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        path: "/v1/orgs/default/projects/test-project/pipelines/simple_build",
        body: expect.objectContaining({
          pipeline_yaml: yaml,
          identifier: "simple_build",
          name: "Simple Build",
          version: "1",
        }),
      }),
    );
  });
});
