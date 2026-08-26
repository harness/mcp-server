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

const yaml = "pipeline:\n  id: ci_build\n  name: CI Build\n  stages: []\n";

describe("pipeline_v1 Git Experience mapping", () => {
  it("maps get query params including repo_name and load_from_fallback_branch", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build", git_details: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "get", {
      pipeline_id: "CI_Build_and_Test",
      org_id: "PROD",
      project_id: "Traceable",
      branch: "main",
      repo_name: "Pipelines",
      load_from_fallback_branch: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/v1/orgs/PROD/projects/Traceable/pipelines/CI_Build_and_Test",
        params: expect.objectContaining({
          branch_name: "main",
          repo_name: "Pipelines",
          load_from_fallback_branch: true,
        }),
      }),
    );
  });

  it("puts create git params into body.git_details, not query params", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      connector_ref: "git_conn",
      repo_name: "Pipelines",
      branch: "main",
      file_path: ".harness/ci.yaml",
      commit_msg: "Add pipeline via MCP",
      body: { pipeline_yaml: yaml, identifier: "ci_build", name: "CI Build" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/v1/orgs/PROD/projects/Traceable/pipelines",
        body: expect.objectContaining({
          pipeline_yaml: yaml,
          git_details: {
            store_type: "REMOTE",
            connector_ref: "git_conn",
            repo_name: "Pipelines",
            branch_name: "main",
            file_path: ".harness/ci.yaml",
            commit_message: "Add pipeline via MCP",
          },
        }),
      }),
    );
    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params?.lastObjectId).toBeUndefined();
    expect(call.params?.storeType).toBeUndefined();
    expect(call.params?.repo_name).toBeUndefined();
  });

  it("puts update conflict ids into body.git_details from params", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "CI_Build_and_Test",
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      is_harness_code_repo: true,
      repo_name: "Pipelines",
      branch: "main",
      file_path: ".harness/ci.yaml",
      last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
      last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
      body: { pipeline_yaml: yaml, identifier: "CI_Build_and_Test", name: "CI Build" },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "PUT",
        path: "/v1/orgs/PROD/projects/Traceable/pipelines/CI_Build_and_Test",
        body: expect.objectContaining({
          git_details: expect.objectContaining({
            store_type: "REMOTE",
            is_harness_code_repo: true,
            repo_name: "Pipelines",
            branch_name: "main",
            file_path: ".harness/ci.yaml",
            last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
            last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
          }),
        }),
      }),
    );
  });

  it("remaps GET git_details.object_id/commit_id when copied into the update body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "CI_Build_and_Test",
      org_id: "PROD",
      project_id: "Traceable",
      body: {
        pipeline_yaml: yaml,
        identifier: "CI_Build_and_Test",
        name: "CI Build",
        git_details: {
          object_id: "blobsha",
          commit_id: "commitsha",
          branch_name: "main",
          repo_name: "Pipelines",
          file_path: ".harness/ci.yaml",
          store_type: "REMOTE",
        },
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { git_details: Record<string, string> } };
    expect(call.body.git_details).toEqual({
      branch_name: "main",
      file_path: ".harness/ci.yaml",
      store_type: "REMOTE",
      repo_name: "Pipelines",
      last_object_id: "blobsha",
      last_commit_id: "commitsha",
    });
    expect(call.body.git_details).not.toHaveProperty("object_id");
    expect(call.body.git_details).not.toHaveProperty("commit_id");
  });

  it("preflights a YAML-only remote update and injects Git location and lock ids", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        identifier: "ci_build",
        git_details: {
          branch_name: "main",
          repo_name: "Pipelines",
          file_path: ".harness/ci.yaml",
          object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
          commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
          is_harness_code_repo: true,
        },
      })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0]![0]).toEqual(expect.objectContaining({
      method: "GET",
      path: "/v1/orgs/PROD/projects/Traceable/pipelines/ci_build",
      params: expect.objectContaining({ load_from_fallback_branch: true }),
    }));
    expect(mockRequest.mock.calls[1]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      path: "/v1/orgs/PROD/projects/Traceable/pipelines/ci_build",
      body: expect.objectContaining({
        git_details: {
          branch_name: "main",
          file_path: ".harness/ci.yaml",
          store_type: "REMOTE",
          repo_name: "Pipelines",
          is_harness_code_repo: true,
          last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
          last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
        },
      }),
    }));
  });

  it("fills identifier and name from the preflight GET when the YAML omits them", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        identifier: "ci_build",
        name: "CI Build",
        git_details: {
          branch_name: "main",
          repo_name: "Pipelines",
          file_path: ".harness/ci.yaml",
          object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
          commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
        },
      })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: "pipeline:\n  stages: []\n",
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      body: expect.objectContaining({ identifier: "ci_build", name: "CI Build" }),
    }));
  });

  it("preflights a v0 YAML-only remote update and maps camelCase GET metadata to query params", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        data: {
          identifier: "ci_build",
          storeType: "REMOTE",
          gitDetails: {
            branch: "main",
            repoName: "Pipelines",
            filePath: ".harness/ci.yaml",
            objectId: "3576b403c93d5727a12d99fe055b29be41622a32",
            commitId: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
          },
        },
      })
      .mockResolvedValueOnce({ data: { identifier: "ci_build" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: "pipeline:\n  identifier: ci_build\n  name: CI Build\n",
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      path: "/pipeline/api/pipelines/v2/ci_build",
      params: expect.objectContaining({
        storeType: "REMOTE",
        branch: "main",
        repoName: "Pipelines",
        filePath: ".harness/ci.yaml",
        lastObjectId: "3576b403c93d5727a12d99fe055b29be41622a32",
        lastCommitId: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
      }),
    }));
  });

  it("skips update preflight GET when the caller explicitly selects INLINE storage", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "INLINE",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      body: expect.objectContaining({
        git_details: { store_type: "INLINE" },
      }),
    }));
  });

  it("does not inject Git details when preflight discovers an inline pipeline", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ identifier: "ci_build", store_type: "INLINE" })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0]![0]).toEqual(expect.objectContaining({ method: "GET" }));
    expect(mockRequest.mock.calls[1]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      body: expect.not.objectContaining({ git_details: expect.anything() }),
    }));
  });

  it("still sends the update when the preflight GET fails", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockRejectedValueOnce(new Error("Harness API error (500): internal error"))
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1]![0]).toEqual(expect.objectContaining({
      method: "PUT",
      path: "/v1/orgs/PROD/projects/Traceable/pipelines/ci_build",
    }));
  });

  it("accepts quoted booleans for is_harness_code_repo", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      is_harness_code_repo: "true",
      repo_name: "test-repo",
      branch: "main",
      file_path: ".harness/ci.yaml",
      last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
      last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const call = mockRequest.mock.calls[0]![0] as { body: { git_details: Record<string, unknown> } };
    expect(call.body.git_details.is_harness_code_repo).toBe(true);
  });

  it("throws when preflight finds REMOTE but git metadata is incomplete", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValueOnce({
      identifier: "ci_build",
      store_type: "REMOTE",
      git_details: { branch_name: "main" },
    });
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "pipeline_v1", "update", {
        pipeline_id: "ci_build",
        org_id: "PROD",
        project_id: "Traceable",
        body: yaml,
      }),
    ).rejects.toThrow(/Unable to resolve Git branch and current object\/commit IDs for remote pipeline_v1 update/);

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]![0]).toEqual(expect.objectContaining({ method: "GET" }));
  });

  it("hydrates connector_ref from preflight GET for v1 remote updates", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        identifier: "ci_build",
        git_details: {
          branch_name: "main",
          repo_name: "Pipelines",
          file_path: ".harness/ci.yaml",
          connector_ref: "account.git_conn",
          object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
          commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
        },
      })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const putCall = mockRequest.mock.calls[1]![0] as { body: { git_details: Record<string, string> } };
    expect(putCall.body.git_details.connector_ref).toBe("account.git_conn");
  });

  it("preflights v1 updates using camelCase gitDetails from the GET response", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        identifier: "ci_build",
        storeType: "REMOTE",
        gitDetails: {
          branchName: "main",
          repoName: "Pipelines",
          filePath: ".harness/ci.yaml",
          objectId: "3576b403c93d5727a12d99fe055b29be41622a32",
          commitId: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
        },
      })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      body: yaml,
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const putCall = mockRequest.mock.calls[1]![0] as { body: { git_details: Record<string, string> } };
    expect(putCall.body.git_details).toEqual({
      branch_name: "main",
      file_path: ".harness/ci.yaml",
      store_type: "REMOTE",
      repo_name: "Pipelines",
      last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
      last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
    });
  });

  it("maps base_branch into create body.git_details", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      repo_name: "Pipelines",
      branch: "feature/ci",
      base_branch: "main",
      file_path: ".harness/ci.yaml",
      body: { pipeline_yaml: yaml, identifier: "ci_build", name: "CI Build" },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { git_details: Record<string, string> } };
    expect(call.body.git_details.base_branch).toBe("main");
    expect(call.body.git_details.branch_name).toBe("feature/ci");
  });

  it("accepts quoted false for is_harness_code_repo", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      is_harness_code_repo: "false",
      repo_name: "ext-repo",
      branch: "main",
      file_path: ".harness/ci.yaml",
      last_object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
      last_commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
      body: yaml,
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { git_details: Record<string, unknown> } };
    expect(call.body.git_details.is_harness_code_repo).toBe(false);
  });

  it("forwards connector_ref from update input into the preflight GET", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        identifier: "ci_build",
        git_details: {
          branch_name: "main",
          repo_name: "Pipelines",
          file_path: ".harness/ci.yaml",
          object_id: "3576b403c93d5727a12d99fe055b29be41622a32",
          commit_id: "c25a833a358bfabcf56c6fedf93ff08718f45d90",
        },
      })
      .mockResolvedValueOnce({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      connector_ref: "account.explicit_conn",
      body: yaml,
    });

    const getCall = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(getCall.params?.connector_ref).toBe("account.explicit_conn");
  });

  it("does not echo the caller's store_type into the preflight GET", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ data: { identifier: "ci_build", storeType: "INLINE" } })
      .mockResolvedValueOnce({ data: { identifier: "ci_build" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline", "update", {
      pipeline_id: "ci_build",
      org_id: "PROD",
      project_id: "Traceable",
      store_type: "REMOTE",
      body: "pipeline:\n  identifier: ci_build\n  name: CI Build\n",
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    const getCall = mockRequest.mock.calls[0]![0] as { method: string; params?: Record<string, unknown> };
    expect(getCall.method).toBe("GET");
    expect(getCall.params?.storeType).toBeUndefined();
    // The stored INLINE wins over the caller's assertion, so no Git context is
    // hydrated and the update is not blocked.
    const putCall = mockRequest.mock.calls[1]![0] as { params?: Record<string, unknown> };
    expect(putCall.params?.lastObjectId).toBeUndefined();
    expect(putCall.params?.lastCommitId).toBeUndefined();
  });

  it("does not add git_details on inline create/update", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "ci_build" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "pipeline_v1", "create", {
      org_id: "PROD",
      project_id: "Traceable",
      body: { pipeline_yaml: yaml, identifier: "ci_build", name: "CI Build" },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(call.body.git_details).toBeUndefined();
  });

  it("documents git params on harness_describe via paramsSchema", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const def = registry.getResource("pipeline_v1");
    expect(def.operations.get!.paramsSchema!.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["branch", "repo_name", "connector_ref", "load_from_fallback_branch"]),
    );
    expect(def.operations.update!.paramsSchema!.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["last_object_id", "last_commit_id", "store_type", "repo_name", "branch"]),
    );
    expect(def.operations.get!.description).toMatch(/git_details\.object_id/);
    expect(def.operations.update!.description).toMatch(/body\.git_details/);

    const v0 = registry.getResource("pipeline");
    expect(v0.operations.get!.paramsSchema!.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["branch", "store_type", "connector_ref", "repo_name"]),
    );
    expect(v0.operations.update!.paramsSchema!.fields.map((f) => f.name)).toEqual(
      expect.arrayContaining(["branch", "repo_name", "file_path", "last_object_id", "last_commit_id"]),
    );
  });
});
