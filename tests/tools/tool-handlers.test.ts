/**
 * Generic tool handler tests for all 10 MCP tools.
 *
 * Tests input validation and error handling paths with mocked registry/client.
 * Does not test actual API calls — that's covered by registry dispatch tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { HarnessApiError } from "../../src/utils/errors.js";

// Top-level mocks for execution_log tests — must be before any imports that pull these in
vi.mock("../../src/utils/log-resolver.js", () => ({
  resolveLogContent: vi.fn().mockResolvedValue("[2026-03-09T17:01:23Z] info: mvn clean install\n[2026-03-09T17:01:45Z] error: BUILD FAILURE"),
}));
vi.mock("../../src/utils/log-prefix.js", () => ({
  buildLogPrefixFromExecution: vi.fn().mockResolvedValue("acct1/pipeline/my-pipe/42/-exec-123"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

/** Minimal McpServer stub that captures registered tools. */
function makeMcpServer(elicitAction: "accept" | "decline" | "cancel" = "accept") {
  const tools = new Map<string, { schema: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
    _tools: tools,
    /** Invoke a registered tool handler by name. */
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
    },
    /** Return the registration schema for assertions about agent-facing metadata. */
    schema(name: string): unknown {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.schema;
    },
  } as any;
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("harness_list", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { content: [{ identifier: "p1" }], totalElements: 1 } });
    client = makeClient(mockRequest);
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, client);
  });

  it("returns error when resource_type is missing", async () => {
    const result = await server.call("harness_list", {});
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_type is required") });
  });

  it("returns error for unknown resource_type", async () => {
    const result = await server.call("harness_list", { resource_type: "nonexistent" });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("Unknown resource_type") });
  });

  it("returns results for valid resource_type", async () => {
    const result = await server.call("harness_list", { resource_type: "pipeline" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { items: unknown[]; total: number };
    expect(data.items).toBeDefined();
  });

  it("documents resource_scope in the registered input schema", () => {
    const schema = server.schema("harness_list") as {
      inputSchema: { resource_scope?: { description?: string | null } };
    };
    expect(schema.inputSchema.resource_scope?.description).toContain("Scope to query");
  });

  it("uses account scope from account-level connector URLs instead of config defaults", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });
    client = makeClient(mockRequest);
    const connectorServer = makeMcpServer();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(connectorServer, registry, client);

    const result = await connectorServer.call("harness_list", {
      url: "https://app.harness.io/ng/account/test-account/all/settings/connectors",
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("propagates user-fixable API errors as errorResult", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_list", { resource_type: "pipeline" });
    expect(result.isError).toBe(true);
  });

  it("throws for infrastructure API errors", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Server error", 500));
    await expect(server.call("harness_list", { resource_type: "pipeline" })).rejects.toThrow();
  });
});

describe("harness_get", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "my-pipeline" } });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("returns error when resource_type is missing", async () => {
    const result = await server.call("harness_get", {});
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_type is required") });
  });

  it("returns error for unknown resource_type", async () => {
    const result = await server.call("harness_get", { resource_type: "nonexistent" });
    expect(result.isError).toBe(true);
  });

  it("returns data for valid resource_type and id", async () => {
    const result = await server.call("harness_get", { resource_type: "pipeline", resource_id: "my-pipeline" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { identifier: string };
    expect(data.identifier).toBe("my-pipeline");
  });

  it("documents resource_scope in the registered input schema", () => {
    const schema = server.schema("harness_get") as {
      inputSchema: { resource_scope?: { description?: string | null } };
    };
    expect(schema.inputSchema.resource_scope?.description).toContain("Scope to query");
  });

  it("propagates 404 as errorResult", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_get", { resource_type: "pipeline", resource_id: "missing" });
    expect(result.isError).toBe(true);
  });

  it("maps global=true to global templates account for template get", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "helmDeployAction" } });
    client = makeClient(mockRequest);
    const templateServer = makeMcpServer();
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(templateServer, registry, client);

    const result = await templateServer.call("harness_get", {
      resource_type: "template",
      resource_id: "helmDeployAction",
      params: { version_label: "1.0.8", global: true },
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; path: string };
    expect(call.path).toBe("/template/api/templates/helmDeployAction");
    expect(call.params.accountIdentifier).toBe("__GLOBAL_TEMPLATES_ACCOUNT_ID__");
    expect(call.params.versionLabel).toBe("1.0.8");
  });

  it("does not infer resource_scope for account APIs with org/project UI URLs", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "feature-flags" }));
    mockRequest = vi.fn().mockResolvedValue({ id: "my_flag" });
    client = makeClient(mockRequest);
    const fmeServer = makeMcpServer();
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(fmeServer, registry, client);

    const result = await fmeServer.call("harness_get", {
      url: "https://app.harness.io/ng/account/abc123/cf/orgs/default/projects/myProject/feature-flags/my_flag",
      params: { workspace_id: "workspace-1" },
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(call.path).toBe("/internal/api/v2/splits/ws/workspace-1/my_flag");
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });
});

describe("harness_get — execution_log", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;
  let resolveLogContentMock: ReturnType<typeof vi.fn>;
  let buildLogPrefixMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const logResolver = await import("../../src/utils/log-resolver.js");
    const logPrefix = await import("../../src/utils/log-prefix.js");

    resolveLogContentMock = logResolver.resolveLogContent as ReturnType<typeof vi.fn>;
    buildLogPrefixMock = logPrefix.buildLogPrefixFromExecution as ReturnType<typeof vi.fn>;

    // Reset to default behavior each test
    resolveLogContentMock.mockReset().mockResolvedValue("[2026-03-09T17:01:23Z] info: mvn clean install\n[2026-03-09T17:01:45Z] error: BUILD FAILURE");
    buildLogPrefixMock.mockReset().mockResolvedValue("acct1/pipeline/my-pipe/42/-exec-123");

    server = makeMcpServer();
    // Include both pipelines (for execution) and logs (for execution_log)
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,logs" }));
    mockRequest = vi.fn().mockResolvedValue({ data: {} });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("resolves log content when prefix is provided explicitly via params", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      params: { prefix: "acct1/pipeline/my-pipe/42/-exec-123" },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { log_content: string };
    expect(data.log_content).toContain("mvn clean install");
    expect(data.log_content).toContain("BUILD FAILURE");
    expect(resolveLogContentMock).toHaveBeenCalledWith(client, "acct1/pipeline/my-pipe/42/-exec-123");
    expect(buildLogPrefixMock).not.toHaveBeenCalled();
  });

  it("maps resource_id to execution_id and auto-builds prefix", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      resource_id: "exec-123",
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { log_content: string };
    expect(data.log_content).toContain("BUILD FAILURE");
    expect(buildLogPrefixMock).toHaveBeenCalledWith(
      client,
      registry,
      "exec-123",
      expect.objectContaining({ execution_id: "exec-123" }),
    );
    expect(resolveLogContentMock).toHaveBeenCalledWith(client, "acct1/pipeline/my-pipe/42/-exec-123");
  });

  it("auto-builds prefix from execution_id when provided in params", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      params: { execution_id: "exec-123" },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { log_content: string };
    expect(data.log_content).toContain("BUILD FAILURE");
    expect(buildLogPrefixMock).toHaveBeenCalledWith(
      client,
      registry,
      "exec-123",
      expect.objectContaining({ resource_type: "execution_log" }),
    );
    expect(resolveLogContentMock).toHaveBeenCalledWith(client, "acct1/pipeline/my-pipe/42/-exec-123");
  });

  it("does not override explicit execution_id with resource_id", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      resource_id: "ignored-id",
      params: { execution_id: "exec-456" },
    });
    expect(result.isError).toBeUndefined();
    expect(buildLogPrefixMock).toHaveBeenCalledWith(
      client,
      registry,
      "exec-456",
      expect.objectContaining({ execution_id: "exec-456" }),
    );
  });

  it("passes step query params from the Harness URL into log prefix resolution", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      url: "https://app.harness.io/ng/account/acc123/module/ci/orgs/test_org/projects/test_project/pipelines/sample_pipeline/executions/exec_123/pipeline?step=step_uuid_123&stage=stage_uuid_456&stageExecId=stage_exec_456",
    });
    expect(result.isError).toBeUndefined();
    expect(buildLogPrefixMock).toHaveBeenCalledWith(
      client,
      registry,
      "exec_123",
      expect.objectContaining({
        step_id: "step_uuid_123",
        stage_id: "stage_uuid_456",
        stage_execution_id: "stage_exec_456",
      }),
    );
  });

  it("returns error when neither prefix nor execution_id provided", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("prefix or execution_id is required");
  });

  it("returns errorResult when resolveLogContent throws", async () => {
    resolveLogContentMock.mockRejectedValueOnce(new Error("Log blob not ready after 3 attempts (status: queued)"));
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      resource_id: "some-exec-id",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("not ready after 3 attempts");
    expect(data.error).toContain("harness_diagnose");
  });

  it("returns errorResult when buildLogPrefixFromExecution throws", async () => {
    buildLogPrefixMock.mockRejectedValueOnce(new Error("Could not extract pipelineIdentifier/runSequence"));
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      resource_id: "bad-exec-id",
    });
    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("pipelineIdentifier/runSequence");
  });

  it("prefers explicit prefix over resource_id when both are given", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      resource_id: "some-exec-id",
      params: { prefix: "explicit/log/prefix/key" },
    });
    expect(result.isError).toBeUndefined();
    // Should use the explicit prefix directly, not buildLogPrefix
    expect(resolveLogContentMock).toHaveBeenCalledWith(client, "explicit/log/prefix/key");
    expect(buildLogPrefixMock).not.toHaveBeenCalled();
  });

  it("does not map resource_id to prefix field for other resource types", async () => {
    // Regression: ensure execution_log special-casing doesn't affect pipeline gets
    mockRequest.mockResolvedValueOnce({ data: { identifier: "my-pipeline" } });
    const result = await server.call("harness_get", {
      resource_type: "pipeline",
      resource_id: "my-pipeline",
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { identifier: string };
    expect(data.identifier).toBe("my-pipeline");
  });

  it("forwards step_id and stage_id from URL to buildLogPrefixFromExecution", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      url: "https://app.harness.io/ng/account/acc1/module/ci/orgs/org1/projects/proj1/pipelines/pipe1/executions/exec-xyz/pipeline?step=nodeExec123&stageExecId=stageExec456",
    });
    expect(result.isError).toBeUndefined();
    expect(buildLogPrefixMock).toHaveBeenCalledWith(
      client,
      registry,
      "exec-xyz",
      expect.objectContaining({
        step_id: "nodeExec123",
        stage_execution_id: "stageExec456",
        execution_id: "exec-xyz",
      }),
    );
  });
});

describe("harness_create", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "new-pipe" } });
    client = makeClient(mockRequest);
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(server, registry, client);
  });

  it("returns error for resource with no create operation", async () => {
    // execution only supports list/get, not create
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(fullServer, fullRegistry, client);

    const result = await fullServer.call("harness_create", {
      resource_type: "execution",
      body: { name: "test" },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not support") });
  });

  it("returns error when user declines confirmation", async () => {
    const declineServer = makeMcpServer("decline");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(declineServer, registry, client);

    const result = await declineServer.call("harness_create", {
      resource_type: "pipeline",
      body: { pipeline: { name: "Test", identifier: "test", stages: [] } },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("creates resource when user confirms", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Test" },
    });
    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();
  });

  it("passes git params as query parameters for remote pipeline create", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Remote Pipe\n  identifier: remote_pipe" },
      params: {
        store_type: "REMOTE",
        connector_ref: "my_github",
        repo_name: "my-repo",
        branch: "main",
        file_path: ".harness/remote-pipe.yaml",
        commit_msg: "Add pipeline via MCP",
      },
    });
    expect(result.isError).toBeUndefined();
    // Verify the request was made with git query params
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.storeType).toBe("REMOTE");
    expect(callArgs.params.connectorRef).toBe("my_github");
    expect(callArgs.params.repoName).toBe("my-repo");
    expect(callArgs.params.branch).toBe("main");
    expect(callArgs.params.filePath).toBe(".harness/remote-pipe.yaml");
    expect(callArgs.params.commitMsg).toBe("Add pipeline via MCP");
    // Verify storeType is propagated to the response (create API doesn't return it)
    const parsed = parseResult(result);
    expect(parsed.storeType).toBe("REMOTE");
    expect(parsed.openInHarness).toContain("storeType=REMOTE");
  });

  it("defaults storeType to INLINE for inline pipeline create", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Inline Pipe\n  identifier: inline_pipe" },
    });
    expect(result.isError).toBeUndefined();
    const parsed = parseResult(result);
    // No storeType in query params and API doesn't return one → should be absent
    expect(parsed.storeType).toBeUndefined();
    // Deep link should still work (without storeType query param)
    expect(parsed.openInHarness).toBeDefined();
    expect(parsed.openInHarness).not.toContain("storeType=");
  });

  it("coerces JSON-string bodies before dispatch", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    client = makeClient(mockRequest);
    const ccmServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(ccmServer, registry, client);

    const result = await ccmServer.call("harness_create", {
      resource_type: "cost_category",
      body: JSON.stringify({
        name: "Engineering",
        costTargets: [{ name: "Development", rules: [] }],
      }),
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toMatchObject({
      accountId: "test-account",
      name: "Engineering",
    });
  });

  it("does not let URL-derived resource_scope change create scoping", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "account_conn" } });
    client = makeClient(mockRequest);
    const connectorServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(connectorServer, registry, client);

    const result = await connectorServer.call("harness_create", {
      resource_type: "connector",
      url: "https://app.harness.io/ng/account/test-account/all/settings/connectors",
      body: {
        identifier: "account_conn",
        name: "Account Connector",
        type: "Bitbucket",
        spec: {},
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.orgIdentifier).toBe("default");
    expect(callArgs.params.projectIdentifier).toBe("test-project");
  });

  it("passes explicit resource_scope through create requests", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    mockRequest = vi.fn().mockResolvedValue({ identifier: "account_step" });
    client = makeClient(mockRequest);
    const templateServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(templateServer, registry, client);

    const result = await templateServer.call("harness_create", {
      resource_type: "template_v1",
      resource_scope: "account",
      body: {
        template_yaml: "version: 1\ntemplate:\n  identifier: account_step\n  name: Account Step\n  step:\n    run:\n      script: echo hi\n",
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/v1/templates");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });
});

describe("harness_update", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "my-pipe" } });
    client = makeClient(mockRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(server, registry, client);
  });

  it("returns error for resource with no update operation", async () => {
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fullServer, fullRegistry, client);

    const result = await fullServer.call("harness_update", {
      resource_type: "execution",
      resource_id: "exec-1",
      body: {},
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not support") });
  });

  it("returns error when user declines", async () => {
    const declineServer = makeMcpServer("decline");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(declineServer, registry, client);

    const result = await declineServer.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("updates resource when confirmed", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });
    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();
  });

  it("coerces JSON-string bodies before dispatch", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "platform" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "proj1" } });
    client = makeClient(mockRequest);
    const platformServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(platformServer, registry, client);

    const result = await platformServer.call("harness_update", {
      resource_type: "project",
      resource_id: "proj1",
      body: JSON.stringify({ name: "Project One", identifier: "proj1" }),
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: { project?: Record<string, unknown> } };
    expect(callArgs.body.project).toMatchObject({
      name: "Project One",
      identifier: "proj1",
    });
  });

  it("passes explicit resource_scope through update requests", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    mockRequest = vi.fn().mockResolvedValue({ identifier: "org_step" });
    client = makeClient(mockRequest);
    const templateServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(templateServer, registry, client);

    const result = await templateServer.call("harness_update", {
      resource_type: "template_v1",
      resource_id: "org_step",
      resource_scope: "org",
      org_id: "org-only",
      params: { version_label: "1.0.0" },
      body: {
        template_yaml: "version: 1\ntemplate:\n  identifier: org_step\n  name: Org Step\n  step:\n    run:\n      script: echo updated\n",
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/v1/orgs/org-only/templates/org_step/versions/1.0.0");
    expect(callArgs.params.orgIdentifier).toBe("org-only");
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });
});

describe("harness_update — pull request", () => {
  it("updates a PR title from a Harness URL via harness_update", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, title: "New Title" });
    const prClient = makeClient(prRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_update", {
      resource_type: "pull_request",
      resource_id: "42",
      url: "https://app.harness.io/ng/account/test-account/module/code/orgs/default/projects/test-project/repos/my-repo/pull-requests/42",
      body: { title: "New Title" },
    });

    expect(result.isError).toBeUndefined();
    expect(prRequest).toHaveBeenCalledOnce();
    const call = prRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe("PATCH");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/42");
    expect(call.body).toEqual({ title: "New Title" });
  });

  it("closes a PR from a Harness URL via harness_update", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, state: "closed" });
    const prClient = makeClient(prRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_update", {
      resource_type: "pull_request",
      resource_id: "42",
      url: "https://app.harness.io/ng/account/test-account/module/code/orgs/default/projects/test-project/repos/my-repo/pull-requests/42",
      body: { state: "closed" },
    });

    expect(result.isError).toBeUndefined();
    const call = prRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/42/state");
    expect(call.body).toEqual({ state: "closed" });
  });

  it("rejects mixed state + metadata via harness_update", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({});
    const prClient = makeClient(prRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_update", {
      resource_type: "pull_request",
      resource_id: "42",
      params: { repo_id: "my-repo" },
      body: { state: "closed", title: "Nope" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({
      error: expect.stringContaining("Cannot combine state change"),
    });
    expect(prRequest).not.toHaveBeenCalled();
  });
});

describe("harness_delete", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: true });
    client = makeClient(mockRequest);
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(server, registry, client);
  });

  it("returns error for resource with no delete operation", async () => {
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(fullServer, fullRegistry, client);

    const result = await fullServer.call("harness_delete", {
      resource_type: "execution",
      resource_id: "exec-1",
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not support") });
  });

  it("returns error when user declines destructive operation", async () => {
    const declineServer = makeMcpServer("decline");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(declineServer, registry, client);

    const result = await declineServer.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("deletes resource when confirmed", async () => {
    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { deleted: boolean };
    expect(data.deleted).toBe(true);
  });

  it("passes explicit resource_scope through delete requests", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    mockRequest = vi.fn().mockResolvedValue({});
    client = makeClient(mockRequest);
    const templateServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(templateServer, registry, client);

    const result = await templateServer.call("harness_delete", {
      resource_type: "template_v1",
      resource_id: "account_step",
      resource_scope: "account",
      params: { version_label: "1.0.0" },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(callArgs.path).toBe("/v1/templates/account_step/versions/1.0.0");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });
});

describe("harness_execute", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer("accept");
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { planExecutionId: "exec-123" } });
    client = makeClient(mockRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(server, registry, client);
  });

  it("returns error when resource_type is missing", async () => {
    const result = await server.call("harness_execute", { action: "run" });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_type is required") });
  });

  it("returns error for invalid action", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "invalid_action",
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("no execute action") });
  });

  it("returns error when user declines", async () => {
    const declineServer = makeMcpServer("decline");
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(declineServer, registry, client);

    const result = await declineServer.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("declined") });
  });

  it("executes action when confirmed", async () => {
    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
    });
    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalled();
  });

  it("passes pipeline_branch from params as ?pipelineBranchName= query param", async () => {
    await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      params: { pipeline_branch: "feature/my-fix" },
    });
    expect(mockRequest).toHaveBeenCalled();
    // Find the POST execute call (pre-flight GET calls come first)
    const postCall = mockRequest.mock.calls.find((c) => c[0].method === "POST");
    expect(postCall).toBeDefined();
    expect(postCall![0].params).toMatchObject({ pipelineBranchName: "feature/my-fix" });
  });

  it("pipeline_branch coexists with other params without clobbering", async () => {
    await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      params: { pipeline_branch: "feature/my-fix", module: "ci" },
    });
    const postCall = mockRequest.mock.calls.find((c) => c[0].method === "POST");
    expect(postCall).toBeDefined();
    expect(postCall![0].params).toMatchObject({ pipelineBranchName: "feature/my-fix", module: "ci" });
  });

  it("closes a pull request from a Harness PR URL", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, state: "closed" });
    const prClient = makeClient(prRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_execute", {
      url: "https://app.harness.io/ng/account/test-account/module/code/orgs/default/projects/test-project/repos/my-repo/pull-requests/42",
      action: "close",
    });

    expect(result.isError).toBeUndefined();
    expect(prRequest).toHaveBeenCalledOnce();
    const call = prRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/42/state");
    expect(call.body).toEqual({ state: "closed" });
  });

  it("uses resource_id for the missing child identifier when parent params are provided", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, state: "closed" });
    const prClient = makeClient(prRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_execute", {
      resource_type: "pull_request",
      action: "close",
      resource_id: "42",
      params: { repo_id: "my-repo" },
    });

    expect(result.isError).toBeUndefined();
    const call = prRequest.mock.calls[0]![0] as { path?: string };
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/42/state");
  });

  it("explicit resource_id overrides URL-derived pr_number", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 43, state: "closed" });
    const prClient = makeClient(prRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(prServer, prRegistry, prClient);

    const result = await prServer.call("harness_execute", {
      url: "https://app.harness.io/ng/account/test-account/module/code/orgs/default/projects/test-project/repos/my-repo/pull-requests/42",
      resource_id: "43",
      action: "close",
    });

    expect(result.isError).toBeUndefined();
    const call = prRequest.mock.calls[0]![0] as { path?: string };
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/43/state");
  });

  it("does not remap resource_id to child field when primary matches (GitOps contract)", async () => {
    const gitopsServer = makeMcpServer("accept");
    const gitopsRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const gitopsRequest = vi.fn().mockResolvedValue({});
    const gitopsClient = makeClient(gitopsRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(gitopsServer, gitopsRegistry, gitopsClient);

    const result = await gitopsServer.call("harness_execute", {
      resource_type: "gitops_application",
      action: "cancel_operation",
      resource_id: "account.myagent",
      params: { agent_id: "account.myagent", app_name: "my-app" },
    });

    expect(result.isError).toBeUndefined();
    const call = gitopsRequest.mock.calls[0]![0] as { path?: string };
    expect(call.path).toContain("/agents/account.myagent/applications/my-app/operation");
  });

  it("materializes input_set_ids by GETting each input set then POSTing merged pipeline YAML", async () => {
    const inputSetYaml = `inputSet:\n  pipeline:\n    identifier: mat_pipe\n    variables:\n      - name: x\n        type: String\n        value: "1"\n`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } })
      .mockResolvedValueOnce({ status: "SUCCESS", data: { planExecutionId: "exec-mat" } });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "mat_pipe",
      input_set_ids: ["saved_set"],
    });
    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    const getCall = mockRequest.mock.calls[0]![0] as { method?: string; path?: string };
    expect(getCall.method).toBe("GET");
    expect(getCall.path).toContain("/pipeline/api/inputSets/");
    expect(getCall.path).toContain("saved_set");

    const runCall = mockRequest.mock.calls[1]![0] as { body?: string };
    expect(typeof runCall.body).toBe("string");
    expect(runCall.body).toContain("mat_pipe");
    expect(runCall.body).toContain("x");
  });

  it("falls back to fresh run when retry returns 405", async () => {
    // First call (retry) throws 405, second call (run) succeeds
    mockRequest
      .mockRejectedValueOnce(new HarnessApiError("Method not allowed", 405))
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-456" } }) // get execution
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-789" } }); // fresh run

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "retry",
      params: { execution_id: "exec-123", pipeline_id: "my-pipe" },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { _note: string };
    expect(data._note).toContain("fresh pipeline run");
  });

  // Single-poll wait tests verify the wiring (extract execution_id, poll once,
  // merge envelope fields). Multi-poll backoff and abort handling are covered
  // by the unit tests in tests/utils/poll-execution.test.ts.
  it("extracts execution_id from the live planExecution.uuid response shape", async () => {
    // Real Harness response wraps the ID inside { planExecution: { uuid, metadata: { executionUuid } } }
    mockRequest
      .mockResolvedValueOnce({
        data: {
          planExecution: {
            uuid: "exec-wait-uuid",
            status: "RUNNING",
            metadata: { executionUuid: "exec-wait-uuid", pipelineIdentifier: "wait_pipe" },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          pipelineExecutionSummary: {
            planExecutionId: "exec-wait-uuid",
            status: "Success",
            pipelineIdentifier: "wait_pipe",
            startTs: 1_700_000_000_000,
            endTs: 1_700_000_010_000,
          },
        },
      });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "wait_pipe",
      wait: true,
      wait_poll_interval_seconds: 2,
      wait_timeout_seconds: 10,
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.execution_status).toBe("Success");
    expect(data.execution_terminal).toBe(true);

    // Confirm the extracted ID was used to build the poll URL
    const pollCall = mockRequest.mock.calls[1]![0] as { path?: string };
    expect(pollCall.path).toBe("/pipeline/api/pipelines/execution/v2/exec-wait-uuid");
  });

  it("attaches a diagnose hint when the awaited execution fails", async () => {
    mockRequest
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-wait-fail" } })
      .mockResolvedValueOnce({
        data: {
          pipelineExecutionSummary: {
            planExecutionId: "exec-wait-fail",
            status: "Failed",
            name: "Failing Pipeline",
            pipelineIdentifier: "fail_pipe",
            startTs: 1_700_000_000_000,
            endTs: 1_700_000_005_000,
          },
        },
      });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "fail_pipe",
      wait: true,
      wait_poll_interval_seconds: 2,
      wait_timeout_seconds: 10,
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as Record<string, unknown>;
    expect(data.execution_status).toBe("Failed");
    expect(data._diagnose_hint).toEqual(expect.stringContaining("harness_diagnose"));
    expect(data._diagnose_hint).toEqual(expect.stringContaining("exec-wait-fail"));
  });

  it("blocks when flat inputs have unmatchedRequired and no input_set_ids", async () => {
    // Template fetch returns a template with required + optional fields
    const mixedTemplate = `pipeline:
  identifier: "test_pipe"
  properties:
    ci:
      codebase:
        build: "<+input>"
  variables:
    - name: "DEPLOY"
      type: "String"
      value: "<+input>.default(true)"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: mixedTemplate } }) // template fetch
      .mockResolvedValueOnce({ status: "SUCCESS", data: { content: [{ identifier: "my-set" }], totalElements: 1 } }); // input set list

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "test_pipe",
      inputs: { WRONG_KEY: "value" },
    });

    expect(result.isError).toBe(true);
    const errText = JSON.stringify(parseResult(result));
    expect(errText).toContain("required field");
    expect(errText).toContain("build");
    expect(errText).toContain("Expected keys");
  });

  it("allows execution when only unmatchedOptional remain", async () => {
    const optionalTemplate = `pipeline:
  identifier: "opt_pipe"
  variables:
    - name: "DEPLOY"
      type: "String"
      value: "<+input>.default(true)"
    - name: "BUILD"
      type: "String"
      value: "<+input>.default(false)"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: optionalTemplate } }) // template
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-opt" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "opt_pipe",
      inputs: {},
    });

    expect(result.isError).toBeUndefined();
  });

  it("skips pre-flight when input_set_ids are present", async () => {
    const templateWithRequired = `pipeline:
  identifier: "skip_pipe"
  variables:
    - name: "branch"
      type: "String"
      value: "<+input>"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: templateWithRequired } }) // template
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-skip" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "skip_pipe",
      inputs: {},
      input_set_ids: ["my-input-set"],
    });

    // Should NOT error even though "branch" is required and unmatched,
    // because input_set_ids are present to cover it
    expect(result.isError).toBeUndefined();
  });

  it("includes _inputResolution metadata on successful auto-resolved execution", async () => {
    const simpleTemplate = `pipeline:
  identifier: "meta_pipe"
  variables:
    - name: "tag"
      type: "String"
      value: "<+input>"
    - name: "REGISTRY"
      type: "String"
      value: "<+input>.default(docker.io)"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: simpleTemplate } }) // template
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-meta" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "meta_pipe",
      inputs: { tag: "v1.0" },
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { _inputResolution: { mode: string; matched: string[]; defaulted?: string[] } };
    expect(data._inputResolution).toBeDefined();
    expect(data._inputResolution.mode).toBe("auto_resolved");
    expect(data._inputResolution.matched).toContain("tag");
    expect(data._inputResolution.defaulted).toContain("REGISTRY");
  });

  it("includes structural field hints in pre-flight error", async () => {
    const structuralTemplate = `pipeline:
  identifier: "struct_pipe"
  properties:
    ci:
      codebase:
        build: "<+input>"
        repoName: "<+input>"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: structuralTemplate } }) // template
      .mockResolvedValueOnce({ status: "SUCCESS", data: { content: [], totalElements: 0 } }); // input set list (empty)

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "struct_pipe",
      inputs: { something: "wrong" },
    });

    expect(result.isError).toBe(true);
    const errText = JSON.stringify(parseResult(result));
    expect(errText).toContain("build");
    expect(errText).toContain("repoName");
  });

  it("imports pipeline from external Git repo via import action", async () => {
    mockRequest.mockResolvedValueOnce({ data: { identifier: "imported-pipe" } });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "import",
      params: {
        connector_ref: "my_github",
        repo_name: "my-repo",
        branch: "main",
        file_path: ".harness/my-pipe.yaml",
      },
      body: {
        pipeline_name: "My Imported Pipeline",
        pipeline_description: "Imported from GitHub",
      },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown>; body: unknown };
    expect(callArgs.method).toBe("POST");
    expect(callArgs.path).toContain("/pipeline/api/pipelines/import");
    expect(callArgs.params.connectorRef).toBe("my_github");
    expect(callArgs.params.repoName).toBe("my-repo");
    expect(callArgs.params.branch).toBe("main");
    expect(callArgs.params.filePath).toBe(".harness/my-pipe.yaml");
    expect(callArgs.body).toEqual({
      pipelineName: "My Imported Pipeline",
      pipelineDescription: "Imported from GitHub",
      orgIdentifier: "default",
      projectIdentifier: "test-project",
    });
  });

  it("imports pipeline from Harness Code repo via import action", async () => {
    mockRequest.mockResolvedValueOnce({ data: { identifier: "hc-imported" } });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "import",
      params: {
        is_harness_code_repo: true,
        repo_name: "product-management",
        branch: "main",
        file_path: ".harness/my-pipe.yaml",
      },
      body: {
        pipeline_name: "HC Pipeline",
      },
    });
    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(callArgs.params.isHarnessCodeRepo).toBe(true);
    expect(callArgs.params.repoName).toBe("product-management");
    // No connectorRef for Harness Code
    expect(callArgs.params.connectorRef).toBeUndefined();
  });
});

describe("harness_describe", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(server, registry);
  });

  it("returns compact summary when no args provided", async () => {
    const result = await server.call("harness_describe", {});
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { total_resource_types: number; hint: string };
    expect(data.total_resource_types).toBeGreaterThan(0);
    expect(data.hint).toContain("harness_describe");
  });

  it("returns details for a specific resource_type", async () => {
    const result = await server.call("harness_describe", { resource_type: "pipeline" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { resource_type: string; operations: unknown[] };
    expect(data.resource_type).toBe("pipeline");
    expect(data.operations.length).toBeGreaterThan(0);
  });

  it("describes account/org/project scope support for multi-scope resources", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    const connectorServer = makeMcpServer();
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(connectorServer, registry);

    const result = await connectorServer.call("harness_describe", { resource_type: "connector" });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { supportedScopes?: string[]; scopeHint?: string };
    expect(data.supportedScopes).toEqual(["account", "org", "project"]);
    expect(data.scopeHint).toContain("resource_scope='account'");
  });

  it("returns error hint for unknown resource_type", async () => {
    const result = await server.call("harness_describe", { resource_type: "nonexistent" });
    expect(result.isError).toBeUndefined(); // describe intentionally doesn't set isError
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Unknown resource_type");
  });

  it("filters by toolset", async () => {
    const result = await server.call("harness_describe", { toolset: "pipelines" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { toolset: string; displayName: string };
    expect(data.toolset).toBe("pipelines");
    expect(data.displayName).toBe("Pipelines");
  });

  it("returns error for unknown toolset", async () => {
    const result = await server.call("harness_describe", { toolset: "nonexistent" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { error: string };
    expect(data.error).toContain("Unknown toolset");
  });

  it("searches by keyword", async () => {
    const result = await server.call("harness_describe", { search_term: "pipeline" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { total_results: number; resource_types: unknown[] };
    expect(data.total_results).toBeGreaterThan(0);
  });
});

describe("harness_search", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { content: [{ identifier: "p1" }], totalElements: 1 } });
    client = makeClient(mockRequest);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client);
  });

  it("searches across all listable types by default", async () => {
    const result = await server.call("harness_search", { query: "deploy" });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { total_matches: number; searched_types: number };
    expect(data.searched_types).toBeGreaterThan(0);
  });

  it("limits to specified resource_types", async () => {
    const result = await server.call("harness_search", {
      query: "deploy",
      resource_types: ["pipeline"],
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { searched_types: number };
    expect(data.searched_types).toBe(1);
  });

  it("documents resource_scope in the registered input schema", () => {
    const schema = server.schema("harness_search") as {
      inputSchema: { resource_scope?: { description?: string | null } };
    };
    expect(schema.inputSchema.resource_scope?.description).toContain("Scope to search");
  });

  it("passes explicit account resource_scope through to searched resources", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "bitbucket" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
    const searchServer = makeMcpServer();
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(searchServer, registry, client);

    const result = await searchServer.call("harness_search", {
      query: "bitbucket",
      resource_types: ["connector"],
      resource_scope: "account",
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("filters broad scoped searches to resource types that support the requested scope", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "github" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
    const searchServer = makeMcpServer();
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(searchServer, registry, client);

    const result = await searchServer.call("harness_search", {
      query: "github",
      resource_scope: "account",
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { searched_types: number; errors?: Record<string, string> };
    expect(data.searched_types).toBeGreaterThan(0);
    expect(data.searched_types).toBeLessThan(registry.getTypesForOperation("list").length);
    expect(data.errors).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(data.searched_types);
    const paths = mockRequest.mock.calls.map((call) => (call[0] as { path: string }).path);
    expect(paths).toContain("/ng/api/connectors/listV2");
    expect(paths.some((path) => path.startsWith("/pipeline/api"))).toBe(false);
  });

  it("uses account resource_scope from account-level URLs during search", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "github" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
    const searchServer = makeMcpServer();
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(searchServer, registry, client);

    const result = await searchServer.call("harness_search", {
      query: "github",
      resource_types: ["connector"],
      url: "https://app.harness.io/ng/account/test-account/all/settings/connectors",
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("filters broad account-level URL searches to compatible resource types", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "github" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
    const searchServer = makeMcpServer();
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(searchServer, registry, client);

    const result = await searchServer.call("harness_search", {
      query: "github",
      url: "https://app.harness.io/ng/account/test-account/all/settings/connectors",
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { searched_types: number; errors?: Record<string, string> };
    expect(data.searched_types).toBeGreaterThan(0);
    expect(data.searched_types).toBeLessThan(registry.getTypesForOperation("list").length);
    expect(data.errors).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(data.searched_types);
    const paths = mockRequest.mock.calls.map((call) => (call[0] as { path: string }).path);
    expect(paths).toContain("/ng/api/connectors/listV2");
    expect(paths.some((path) => path.startsWith("/pipeline/api"))).toBe(false);
  });

  it("gracefully handles search failures for individual types", async () => {
    // First call fails, second succeeds
    mockRequest
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue({ data: { content: [], totalElements: 0 } });

    const result = await server.call("harness_search", { query: "test" });
    expect(result.isError).toBeUndefined();
    // Should still return partial results
    const data = parseResult(result) as { errors?: Record<string, string> };
    expect(data.errors).toBeDefined();
  });
});

describe("harness_status", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let config: Config;

  beforeEach(async () => {
    server = makeMcpServer();
    config = makeConfig();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const mockRequest = vi.fn().mockResolvedValue({
      data: {
        content: [
          { pipelineIdentifier: "p1", planExecutionId: "e1", status: "Failed", startTs: Date.now() },
        ],
        totalElements: 1,
      },
    });
    client = makeClient(mockRequest);
    const { registerStatusTool } = await import("../../src/tools/harness-status.js");
    registerStatusTool(server, registry, client, config);
  });

  it("returns health status with failed, running, and recent sections", async () => {
    const result = await server.call("harness_status", {});
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      summary: { health: string; total_failed: number };
      failed_executions: unknown[];
      running_executions: unknown[];
      recent_activity: unknown[];
    };
    expect(data.summary.health).toBeDefined();
    expect(["healthy", "degraded", "failing"]).toContain(data.summary.health);
    expect(data.failed_executions).toBeDefined();
    expect(data.running_executions).toBeDefined();
    expect(data.recent_activity).toBeDefined();
  });

  it("degrades gracefully when API calls fail", async () => {
    const failingRequest = vi.fn().mockRejectedValue(new Error("network error"));
    client = makeClient(failingRequest);
    const freshServer = makeMcpServer();
    const { registerStatusTool } = await import("../../src/tools/harness-status.js");
    registerStatusTool(freshServer, registry, client, config);

    const result = await freshServer.call("harness_status", {});
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { _errors?: Record<string, string> };
    // All 3 dispatches failed, should have _errors
    expect(data._errors).toBeDefined();
  });
});

describe("harness_diagnose", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let config: Config;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    config = makeConfig();
    registry = new Registry(makeConfig());
    mockRequest = vi.fn().mockResolvedValue({ data: { pipelineExecutionSummary: { status: "Failed" } } });
    client = makeClient(mockRequest);
    const { registerDiagnoseTool } = await import("../../src/tools/harness-diagnose.js");
    registerDiagnoseTool(server, registry, client, config);
  });

  it("returns error for unsupported resource_type", async () => {
    const result = await server.call("harness_diagnose", {
      resource_type: "secret",
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({
      error: expect.stringContaining("not supported"),
    });
  });

  it("defaults to pipeline when no resource_type given", async () => {
    // This tests that the default resource_type is "pipeline"
    // The handler will attempt pipeline diagnosis which calls registry.dispatch
    // We just verify it doesn't error with "unsupported resource_type"
    mockRequest.mockResolvedValue({
      data: {
        pipelineExecutionSummary: {
          status: "Failed",
          pipelineIdentifier: "test",
          planExecutionId: "e1",
          executionErrorInfo: { message: "test error" },
          layoutNodeMap: {},
        },
      },
    });

    const result = await server.call("harness_diagnose", {
      options: { execution_id: "e1" },
    });
    // Should not return "unsupported resource_type" error
    if (result.isError) {
      const data = parseResult(result) as { error: string };
      expect(data.error).not.toContain("not supported");
    }
  });

  it("resolves execution alias to pipeline", async () => {
    mockRequest.mockResolvedValue({
      data: {
        pipelineExecutionSummary: {
          status: "Failed",
          pipelineIdentifier: "test",
          planExecutionId: "e1",
          executionErrorInfo: { message: "test" },
          layoutNodeMap: {},
        },
      },
    });

    const result = await server.call("harness_diagnose", {
      resource_type: "execution",
      options: { execution_id: "e1" },
    });
    // Should not return unsupported error — "execution" is aliased to "pipeline"
    if (result.isError) {
      const data = parseResult(result) as { error: string };
      expect(data.error).not.toContain("not supported");
    }
  });
});
