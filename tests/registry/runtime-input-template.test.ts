import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { runtimeInputTemplatePreflight } from "../../src/registry/extractors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
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

describe("runtimeInputTemplatePreflight", () => {
  it("is fail-open when pipeline GET fails", async () => {
    const request = vi.fn().mockRejectedValue(new Error("404 Not Found"));
    const client = makeClient(request);
    const registry = new Registry(makeConfig());
    const input: Record<string, unknown> = { pipeline_id: "my-pipe" };

    await expect(
      runtimeInputTemplatePreflight({ client, input, registry }),
    ).resolves.toBeUndefined();

    expect(input._pipelineDefinitionYaml).toBeUndefined();
  });

  it("uses config org/project and git params from input", async () => {
    const request = vi.fn().mockResolvedValue({
      data: { yamlPipeline: "pipeline:\n  identifier: my-pipe\n" },
    });
    const client = makeClient(request);
    const registry = new Registry(makeConfig());
    const input: Record<string, unknown> = {
      pipeline_id: "my-pipe",
      branch: "feature/x",
      store_type: "REMOTE",
      connector_ref: "account.git",
      repo_name: "my-repo",
    };

    await runtimeInputTemplatePreflight({ client, input, registry });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/pipelines/my-pipe",
        params: expect.objectContaining({
          orgIdentifier: "default-org",
          projectIdentifier: "default-project",
          branch: "feature/x",
          storeType: "REMOTE",
          connectorRef: "account.git",
          repoName: "my-repo",
        }),
      }),
    );
    expect(input._pipelineDefinitionYaml).toContain("identifier: my-pipe");
  });

  it("prefers explicit org_id/project_id over config defaults", async () => {
    const request = vi.fn().mockResolvedValue({ data: { yamlPipeline: "pipeline:\n" } });
    const client = makeClient(request);
    const registry = new Registry(makeConfig());
    const input: Record<string, unknown> = {
      pipeline_id: "p1",
      org_id: "explicit-org",
      project_id: "explicit-project",
    };

    await runtimeInputTemplatePreflight({ client, input, registry });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          orgIdentifier: "explicit-org",
          projectIdentifier: "explicit-project",
        }),
      }),
    );
  });
});

describe("runtime_input_template resource — request shape", () => {
  it("dispatches POST template call after preflight and forwards git params", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi
      .fn()
      .mockResolvedValueOnce({
        data: { yamlPipeline: "pipeline:\n  variables:\n    - name: env\n      value: <+input>.default(qa)\n" },
      })
      .mockResolvedValueOnce({
        data: {
          inputSetTemplateYaml: "pipeline:\n  variables:\n    - name: env\n      value: <+input>\n",
        },
      });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "runtime_input_template", "get", {
      pipeline_id: "my-pipe",
      branch: "main",
      store_type: "REMOTE",
      connector_ref: "account.git",
      repo_name: "repo",
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0]![0]).toMatchObject({
      method: "GET",
      path: "/pipeline/api/pipelines/my-pipe",
      params: expect.objectContaining({
        storeType: "REMOTE",
        connectorRef: "account.git",
        repoName: "repo",
        branch: "main",
      }),
    });
    expect(mockRequest.mock.calls[1]![0]).toMatchObject({
      method: "POST",
      path: "/pipeline/api/inputSets/template",
      params: expect.objectContaining({
        pipelineIdentifier: "my-pipe",
        branch: "main",
        storeType: "REMOTE",
        connectorRef: "account.git",
        repoName: "repo",
      }),
    });
  });

  it("succeeds when preflight GET fails (fail-open)", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({
        data: { inputSetTemplateYaml: "pipeline:\n  identifier: p\n" },
      });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "runtime_input_template", "get", {
      pipeline_id: "my-pipe",
    });

    expect(result).toMatchObject({
      inputSetTemplateYaml: expect.stringContaining("identifier: p"),
    });
  });
});

describe("pipeline_resolved_yaml resource — request shape", () => {
  it("dispatches GET with getTemplatesResolvedPipeline=true", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      data: { resolvedTemplatesPipelineYaml: "pipeline:\n  identifier: p\n" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_resolved_yaml", "get", {
      pipeline_id: "my-pipe",
      org_id: "myorg",
      project_id: "myproj",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/pipelines/my-pipe",
        params: expect.objectContaining({
          orgIdentifier: "myorg",
          projectIdentifier: "myproj",
          getTemplatesResolvedPipeline: "true",
        }),
      }),
    );
    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params).not.toHaveProperty("validateAsync");
  });
});
