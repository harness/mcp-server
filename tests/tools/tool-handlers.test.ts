/**
 * Generic tool handler tests for all 11 MCP tools.
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
import { listOutputSchema } from "../../src/tools/output-schemas.js";

// Top-level mocks for execution_log tests — must be before any imports that pull these in
vi.mock("../../src/utils/log-resolver.js", () => ({
  resolveLogContent: vi.fn().mockResolvedValue("[2026-03-09T17:01:23Z] info: mvn clean install\n[2026-03-09T17:01:45Z] error: BUILD FAILURE"),
  resolveLogDownloadUrl: vi.fn().mockResolvedValue("https://storage.example.com/logs.zip?signed=1"),
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
      elicitInput: vi.fn().mockResolvedValue(
        elicitAction === "accept" ? { action: elicitAction, content: { confirm: true } } : { action: elicitAction },
      ),
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

  it("returns schema-valid structured content for passthrough list responses", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    mockRequest = vi.fn().mockResolvedValue({ content: [{ identifier: "repo-1" }], totalElements: 1 });
    client = makeClient(mockRequest);
    const repositoryServer = makeMcpServer();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(repositoryServer, registry, client);

    const result = await repositoryServer.call("harness_list", { resource_type: "repository" });

    expect(result.isError).toBeUndefined();
    expect(listOutputSchema.safeParse(result.structuredContent).success).toBe(true);
  });

  it("wraps top-level array list responses so output schema validation can run", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    mockRequest = vi.fn().mockResolvedValue([{ identifier: "repo-1" }]);
    client = makeClient(mockRequest);
    const repositoryServer = makeMcpServer();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(repositoryServer, registry, client);

    const result = await repositoryServer.call("harness_list", { resource_type: "repository" });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toMatchObject({ items: [{ identifier: "repo-1" }] });
    expect(listOutputSchema.safeParse(result.structuredContent).success).toBe(true);
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

describe("harness_get — execution_inputs", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {
        inputSetYaml: "yaml-1",
        inputSetTemplateYaml: "yaml-2",
        resolvedYaml: null,
        inputSetDetails: [{ identifier: "is1", name: "One" }],
        inputSetBranchName: "main",
      },
    });
    client = makeClient(mockRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, client);
  });

  it("maps resource_id to execution_id and returns the projected response shape", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_inputs",
      resource_id: "exec-abc123",
    });

    expect(result.isError).toBeUndefined();
    expect(parseResult(result)).toEqual({
      executionId: "exec-abc123",
      inputSetYaml: "yaml-1",
      inputSetTemplateYaml: "yaml-2",
      resolvedYaml: null,
      inputSetDetails: [{ identifier: "is1", name: "One" }],
      inputSetBranchName: "main",
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/pipeline/api/pipelines/execution/exec-abc123/inputsetV2",
      }),
    );
  });

  it("passes org/project scope and expression params through the public harness_get contract", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_inputs",
      resource_id: "exec-abc123",
      org_id: "AI_Devops",
      project_id: "Sanity",
      params: {
        resolve_expressions: true,
        resolve_expressions_type: "RESOLVE_ALL_EXPRESSIONS",
      },
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params).toEqual(
      expect.objectContaining({
        orgIdentifier: "AI_Devops",
        projectIdentifier: "Sanity",
        resolveExpressions: true,
        resolveExpressionsType: "RESOLVE_ALL_EXPRESSIONS",
      }),
    );
  });

  it("omits expression resolution params when not provided", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_inputs",
      resource_id: "exec-abc123",
    });

    expect(result.isError).toBeUndefined();
    const call = mockRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params).not.toHaveProperty("resolveExpressions");
    expect(call.params).not.toHaveProperty("resolveExpressionsType");
  });

  it("fails at registry dispatch when execution_id is missing", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_inputs",
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({
      error: expect.stringContaining('Missing required field "execution_id" for execution_inputs'),
    });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("is allowed in read-only mode because the get operation is read-risk", async () => {
    const roServer = makeMcpServer();
    const roRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines", HARNESS_READ_ONLY: true }));
    const roRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { inputSetYaml: "yaml-1", inputSetDetails: [] },
    });
    const roClient = makeClient(roRequest);
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(roServer, roRegistry, roClient);

    const result = await roServer.call("harness_get", {
      resource_type: "execution_inputs",
      resource_id: "exec-readonly",
    });

    expect(result.isError).toBeUndefined();
    expect(roRequest).toHaveBeenCalledOnce();
  });
});

describe("harness_get — execution_log", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;
  let resolveLogContentMock: ReturnType<typeof vi.fn>;
  let resolveLogDownloadUrlMock: ReturnType<typeof vi.fn>;
  let buildLogPrefixMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const logResolver = await import("../../src/utils/log-resolver.js");
    const logPrefix = await import("../../src/utils/log-prefix.js");

    resolveLogContentMock = logResolver.resolveLogContent as ReturnType<typeof vi.fn>;
    resolveLogDownloadUrlMock = logResolver.resolveLogDownloadUrl as ReturnType<typeof vi.fn>;
    buildLogPrefixMock = logPrefix.buildLogPrefixFromExecution as ReturnType<typeof vi.fn>;

    // Reset to default behavior each test
    resolveLogContentMock.mockReset().mockResolvedValue("[2026-03-09T17:01:23Z] info: mvn clean install\n[2026-03-09T17:01:45Z] error: BUILD FAILURE");
    resolveLogDownloadUrlMock.mockReset().mockResolvedValue("https://storage.example.com/logs.zip?signed=1");
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

  it("returns download URL when return_download_url is true", async () => {
    const result = await server.call("harness_get", {
      resource_type: "execution_log",
      params: {
        prefix: "acct1/pipeline/my-pipe/42/-exec-123",
        return_download_url: true,
      },
    });
    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { download_url: string };
    expect(data.download_url).toBe("https://storage.example.com/logs.zip?signed=1");
    expect(resolveLogDownloadUrlMock).toHaveBeenCalledWith(client, "acct1/pipeline/my-pipe/42/-exec-123");
    expect(resolveLogContentMock).not.toHaveBeenCalled();
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
    registerCreateTool(server, registry, client, makeConfig());
  });

  it("keeps optional input descriptions visible in the registered schema", () => {
    const schema = server.schema("harness_create") as {
      inputSchema: {
        url?: { description?: string | null };
        org_id?: { description?: string | null };
        project_id?: { description?: string | null };
        confirm?: { description?: string | null };
        params?: { description?: string | null };
      };
    };

    expect(schema.inputSchema.url?.description).toContain("supported resource_scope");
    expect(schema.inputSchema.org_id?.description).toContain("Organization identifier");
    expect(schema.inputSchema.project_id?.description).toContain("Project identifier");
    expect(schema.inputSchema.confirm?.description).toContain("Set to true");
    expect(schema.inputSchema.params?.description).toContain("Additional parameters");
  });

  it("returns error for resource with no create operation", async () => {
    // execution only supports list/get, not create
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(fullServer, fullRegistry, client, makeConfig());

    const result = await fullServer.call("harness_create", {
      resource_type: "execution",
      body: { name: "test" },
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not support") });
  });

  it("does not surface elicitation prompt for low_write create even when client declines", async () => {
    // pipeline.create is low_write — confirmation is gated on
    // requiresConfirmation(risk) which kicks in at medium_write. The
    // simulated decline below should be ignored entirely (elicitInput
    // is never called).
    const declineServer = makeMcpServer("decline");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(declineServer, registry, client, makeConfig());

    const result = await declineServer.call("harness_create", {
      resource_type: "pipeline",
      body: { pipeline: { name: "Test", identifier: "test", stages: [] } },
    });
    expect(result.isError).toBeUndefined();
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

  it("extracts v1 pipeline identifiers from raw YAML id fields", async () => {
    const yaml = [
      "pipeline:",
      "  id: simple_build",
      "  name: Simple Build",
      "  clone:",
      "    enabled: false",
      "  stages: []",
    ].join("\n");

    const result = await server.call("harness_create", {
      resource_type: "pipeline_v1",
      body: yaml,
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toMatchObject({
      pipeline_yaml: yaml,
      identifier: "simple_build",
      name: "Simple Build",
      version: "1",
    });
  });

  it("extracts v1 pipeline identifiers from JSON pipeline id fields", async () => {
    const result = await server.call("harness_create", {
      resource_type: "pipeline_v1",
      body: {
        pipeline: {
          id: "json_build",
          name: "JSON Build",
          clone: { enabled: false },
          stages: [],
        },
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toMatchObject({
      identifier: "json_build",
      name: "JSON Build",
      version: "1",
    });
    expect(callArgs.body.pipeline_yaml).toContain("id: json_build");
    expect(callArgs.body.pipeline_yaml).not.toContain("identifier:");
  });

  it("coerces JSON-string bodies before dispatch", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ccm" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { uuid: "category-1" } });
    client = makeClient(mockRequest);
    const ccmServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(ccmServer, registry, client, makeConfig());

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

  it("uses account scope from account-level connector URLs during create", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "account_conn" } });
    client = makeClient(mockRequest);
    const connectorServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(connectorServer, registry, client, makeConfig());

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
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });

  it("uses account scope from account-level File Store URLs during create", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "scripts" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(fileStoreServer, registry, client, makeConfig());

    const result = await fileStoreServer.call("harness_create", {
      resource_type: "file_store",
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store",
      body: {
        name: "scripts",
        type: "FOLDER",
        parent_identifier: "Root",
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; body: FormData };
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
    expect(callArgs.body).toBeInstanceOf(FormData);
  });

  it("redacts File Store upload content from create confirmation prompts", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "script-file" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(fileStoreServer, registry, client, makeConfig());
    const contentBase64 = Buffer.from("sensitive file payload").toString("base64");

    const result = await fileStoreServer.call("harness_create", {
      resource_type: "file_store",
      body: {
        name: "script.sh",
        type: "FILE",
        parent_identifier: "Root",
        content_base64: contentBase64,
      },
    });

    expect(result.isError).toBeUndefined();
    const elicitationCall = fileStoreServer.server.elicitInput.mock.calls[0]![0] as { message: string };
    expect(elicitationCall.message).toContain("[redacted");
    expect(elicitationCall.message).not.toContain(contentBase64);
  });

  it("redacts File Store upload content from JSON-string create confirmation prompts", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "script-file" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerCreateTool } = await import("../../src/tools/harness-create.js");
    registerCreateTool(fileStoreServer, registry, client, makeConfig());
    const contentBase64 = Buffer.from("sensitive json body payload").toString("base64");

    const result = await fileStoreServer.call("harness_create", {
      resource_type: "file_store",
      body: JSON.stringify({
        name: "script.sh",
        type: "FILE",
        parent_identifier: "Root",
        content_base64: contentBase64,
      }),
    });

    expect(result.isError).toBeUndefined();
    const elicitationCall = fileStoreServer.server.elicitInput.mock.calls[0]![0] as { message: string };
    expect(elicitationCall.message).toContain("[redacted");
    expect(elicitationCall.message).not.toContain(contentBase64);
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
    registerUpdateTool(server, registry, client, makeConfig());
  });

  it("returns error for resource with no update operation", async () => {
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fullServer, fullRegistry, client, makeConfig());

    const result = await fullServer.call("harness_update", {
      resource_type: "execution",
      resource_id: "exec-1",
      body: {},
    });
    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("does not support") });
  });

  it("does not surface elicitation prompt for low_write update even when client declines", async () => {
    // pipeline.update is low_write — confirmation is gated on
    // requiresConfirmation(risk) which kicks in at medium_write.
    const declineServer = makeMcpServer("decline");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(declineServer, registry, client, makeConfig());

    const result = await declineServer.call("harness_update", {
      resource_type: "pipeline",
      resource_id: "my-pipe",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });
    expect(result.isError).toBeUndefined();
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
    registerUpdateTool(platformServer, registry, client, makeConfig());

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

  it("updates IDP entities at the configured project scope when only resource_id and kind are provided", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "idp" }));
    mockRequest = vi.fn().mockResolvedValue({ identifier: "boutique-service" });
    client = makeClient(mockRequest);
    const idpServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(idpServer, registry, client, makeConfig());

    const result = await idpServer.call("harness_update", {
      resource_type: "idp_entity",
      resource_id: "boutique-service",
      params: { kind: "component" },
      body: { yaml: "apiVersion: harness.io/v1\nkind: component\nmetadata:\n  name: boutique-service\nspec: {}" },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as {
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    };
    expect(callArgs.path).toBe("/v1/entities/account.default.test-project/component/boutique-service");
    expect(callArgs.params.orgIdentifier).toBe("default");
    expect(callArgs.params.projectIdentifier).toBe("test-project");
    expect(callArgs.body).toEqual({
      yaml: "apiVersion: harness.io/v1\nkind: component\nmetadata:\n  name: boutique-service\nspec: {}",
    });
  });

  it("rejects raw YAML update bodies whose identifier conflicts with resource_id", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "prod_connector" } });
    client = makeClient(mockRequest);
    const connectorServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(connectorServer, registry, client, makeConfig());

    const result = await connectorServer.call("harness_update", {
      resource_type: "connector",
      resource_id: "dev_connector",
      body: `
connector:
  identifier: prod_connector
  name: Prod Connector
  type: K8sCluster
  spec:
    credential:
      type: InheritFromDelegate
`,
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("Conflicting identifiers") });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("injects connector identifier into wrapped YAML update bodies when missing", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "connectors" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { connector: { identifier: "dev_connector" } } });
    client = makeClient(mockRequest);
    const connectorServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(connectorServer, registry, client, makeConfig());

    const result = await connectorServer.call("harness_update", {
      resource_type: "connector",
      resource_id: "dev_connector",
      body: `
connector:
  name: Dev Connector
  type: K8sCluster
  spec:
    credential:
      type: InheritFromDelegate
`,
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: { connector?: Record<string, unknown> } };
    expect(callArgs.body.connector).toMatchObject({
      identifier: "dev_connector",
      name: "Dev Connector",
    });
  });

  it("injects environment identifier into unwrapped YAML update bodies when missing", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "environments" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { environment: { identifier: "prod_env" } } });
    client = makeClient(mockRequest);
    const environmentServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(environmentServer, registry, client, makeConfig());

    const result = await environmentServer.call("harness_update", {
      resource_type: "environment",
      resource_id: "prod_env",
      org_id: "default",
      project_id: "project",
      body: `
environment:
  name: Production
  type: Production
`,
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(callArgs.body).toMatchObject({
      identifier: "prod_env",
      name: "Production",
      type: "Production",
    });
    expect(callArgs.body).not.toHaveProperty("environment");
  });

  it("uses account scope from account-level File Store URLs during update", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "scripts" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fileStoreServer, registry, client, makeConfig());

    const result = await fileStoreServer.call("harness_update", {
      resource_type: "file_store",
      resource_id: "scripts",
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store/scripts",
      body: {
        name: "scripts",
        type: "FOLDER",
        parent_identifier: "Root",
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; path: string; body: FormData };
    expect(callArgs.path).toBe("/ng/api/file-store/scripts");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
    expect(callArgs.body).toBeInstanceOf(FormData);
  });

  it("uses resource id from account-level File Store URLs during update", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "scripts" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fileStoreServer, registry, client, makeConfig());

    const result = await fileStoreServer.call("harness_update", {
      resource_type: "file_store",
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store/scripts",
      body: {
        name: "scripts",
        type: "FOLDER",
        parent_identifier: "Root",
      },
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; path: string; body: FormData };
    expect(callArgs.path).toBe("/ng/api/file-store/scripts");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
    expect(callArgs.body).toBeInstanceOf(FormData);
  });

  it("redacts File Store upload content from update confirmation prompts", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "script-file" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fileStoreServer, registry, client, makeConfig());
    const content = "sensitive replacement file payload";

    const result = await fileStoreServer.call("harness_update", {
      resource_type: "file_store",
      resource_id: "script-file",
      body: {
        name: "script.sh",
        type: "FILE",
        parent_identifier: "Root",
        content,
      },
    });

    expect(result.isError).toBeUndefined();
    const elicitationCall = fileStoreServer.server.elicitInput.mock.calls[0]![0] as { message: string };
    expect(elicitationCall.message).toContain("[redacted");
    expect(elicitationCall.message).not.toContain(content);
  });

  it("redacts File Store upload content from JSON-string update confirmation prompts", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "script-file" } });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(fileStoreServer, registry, client, makeConfig());
    const content = "sensitive json replacement file payload";

    const result = await fileStoreServer.call("harness_update", {
      resource_type: "file_store",
      resource_id: "script-file",
      body: JSON.stringify({
        name: "script.sh",
        type: "FILE",
        parent_identifier: "Root",
        content,
      }),
    });

    expect(result.isError).toBeUndefined();
    const elicitationCall = fileStoreServer.server.elicitInput.mock.calls[0]![0] as { message: string };
    expect(elicitationCall.message).toContain("[redacted");
    expect(elicitationCall.message).not.toContain(content);
  });

  it("fails loudly when update has neither resource_id nor URL id", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      body: { yamlPipeline: "pipeline:\n  name: Updated" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_id is required") });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("keeps optional input descriptions visible in the registered update schema", () => {
    const schema = server.schema("harness_update") as {
      inputSchema: {
        resource_id?: { description?: string | null };
        url?: { description?: string | null };
        org_id?: { description?: string | null };
        project_id?: { description?: string | null };
        confirm?: { description?: string | null };
        params?: { description?: string | null };
      };
    };

    expect(schema.inputSchema.resource_id?.description).toContain("Optional when url contains");
    expect(schema.inputSchema.url?.description).toContain("supported resource_scope");
    expect(schema.inputSchema.org_id?.description).toContain("Organization identifier");
    expect(schema.inputSchema.project_id?.description).toContain("Project identifier");
    expect(schema.inputSchema.confirm?.description).toContain("Set to true");
    expect(schema.inputSchema.params?.description).toContain("Additional identifiers");
  });

  it("rejects conflicting resource_id from URL vs params", async () => {
    const result = await server.call("harness_update", {
      resource_type: "pipeline",
      url: "https://app.harness.io/ng/account/acc/module/ci/orgs/default/projects/proj/pipelines/pipe-from-url",
      params: { pipeline_id: "pipe-from-params" },
      body: { name: "test" },
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("Conflicting identifiers") });
  });
});

describe("harness_update — pull request", () => {
  it("updates a PR title from a Harness URL via harness_update", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, title: "New Title" });
    const prClient = makeClient(prRequest);
    const { registerUpdateTool } = await import("../../src/tools/harness-update.js");
    registerUpdateTool(prServer, prRegistry, prClient, makeConfig());

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
    registerUpdateTool(prServer, prRegistry, prClient, makeConfig());

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
    registerUpdateTool(prServer, prRegistry, prClient, makeConfig());

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
    registerDeleteTool(server, registry, client, makeConfig());
  });

  it("returns error for resource with no delete operation", async () => {
    const fullRegistry = new Registry(makeConfig());
    const fullServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(fullServer, fullRegistry, client, makeConfig());

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
    registerDeleteTool(declineServer, registry, client, makeConfig());

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

  it("returns structured delete payload without spreading API fields at top level", async () => {
    const templateRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "templates" }));
    const templateServer = makeMcpServer("accept");
    mockRequest.mockResolvedValue({
      identifier: "my_tpl",
      account: "acct",
      scope: "project",
      version_label: "1.0.0",
    });
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(templateServer, templateRegistry, client, makeConfig());

    const result = await templateServer.call("harness_delete", {
      resource_type: "template_v1",
      resource_id: "my_tpl",
      org_id: "default",
      project_id: "proj",
      params: { version_label: "1.0.0" },
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      deleted: true,
      resource_type: "template_v1",
      resource_id: "my_tpl",
      version_label: "1.0.0",
      details: {
        identifier: "my_tpl",
        account: "acct",
        scope: "project",
        version_label: "1.0.0",
      },
    });
    expect(result.structuredContent).not.toHaveProperty("account");
    expect(result.structuredContent).not.toHaveProperty("scope");
  });

  it("uses account scope from account-level File Store URLs during delete", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: true });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(fileStoreServer, registry, client, makeConfig());

    const result = await fileStoreServer.call("harness_delete", {
      resource_type: "file_store",
      resource_id: "scripts",
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store/scripts",
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; path: string };
    expect(callArgs.path).toBe("/ng/api/file-store/scripts");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });

  it("uses resource id from account-level File Store URLs during delete", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    mockRequest = vi.fn().mockResolvedValue({ data: true });
    client = makeClient(mockRequest);
    const fileStoreServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(fileStoreServer, registry, client, makeConfig());

    const result = await fileStoreServer.call("harness_delete", {
      resource_type: "file_store",
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store/scripts",
    });

    expect(result.isError).toBeUndefined();
    const callArgs = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown>; path: string };
    expect(callArgs.path).toBe("/ng/api/file-store/scripts");
    expect(callArgs.params.orgIdentifier).toBeUndefined();
    expect(callArgs.params.projectIdentifier).toBeUndefined();
  });

  it("fails loudly when delete has neither resource_id nor URL id", async () => {
    const result = await server.call("harness_delete", {
      resource_type: "pipeline",
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("resource_id is required") });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("keeps optional input descriptions visible in the registered delete schema", () => {
    const schema = server.schema("harness_delete") as {
      inputSchema: {
        resource_id?: { description?: string | null };
        url?: { description?: string | null };
        org_id?: { description?: string | null };
        project_id?: { description?: string | null };
        confirm?: { description?: string | null };
        params?: { description?: string | null };
      };
    };

    expect(schema.inputSchema.resource_id?.description).toContain("Optional when url contains");
    expect(schema.inputSchema.url?.description).toContain("supported resource_scope");
    expect(schema.inputSchema.org_id?.description).toContain("Organization identifier");
    expect(schema.inputSchema.project_id?.description).toContain("Project identifier");
    expect(schema.inputSchema.confirm?.description).toContain("Set to true");
    expect(schema.inputSchema.params?.description).toContain("Additional identifiers");
  });

  it("rejects conflicting resource_id from URL vs params", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const conflictServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(conflictServer, registry, client, makeConfig());

    const result = await conflictServer.call("harness_delete", {
      resource_type: "pipeline",
      url: "https://app.harness.io/ng/account/acc/module/ci/orgs/default/projects/proj/pipelines/pipe-from-url",
      params: { pipeline_id: "pipe-from-params" },
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("Conflicting identifiers") });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("gitops_agent delete maps resource_id to agent_id and forwards account scope", async () => {
    const gitopsRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const gitopsServer = makeMcpServer("accept");
    const { registerDeleteTool } = await import("../../src/tools/harness-delete.js");
    registerDeleteTool(gitopsServer, gitopsRegistry, client, makeConfig());

    const result = await gitopsServer.call("harness_delete", {
      resource_type: "gitops_agent",
      resource_id: "myagent",
      resource_scope: "account",
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "DELETE",
      path: "/gitops/api/v1/agents/myagent",
      params: expect.not.objectContaining({
        orgIdentifier: expect.anything(),
        projectIdentifier: expect.anything(),
      }),
    }));
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
    registerExecuteTool(server, registry, client, makeConfig());
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

  it("documents resource_scope in the registered input schema", () => {
    const schema = server.schema("harness_execute") as {
      inputSchema: { resource_scope?: { description?: string | null } };
    };
    expect(schema.inputSchema.resource_scope?.description).toContain("Scope for the operation");
  });

  it("exposes a description on every documented input field (Zod 4 chaining order regression)", () => {
    // Regression for Cursor PR #351 finding: in Zod 4, `.optional()` /
    // `.default()` / `.min()` / `.max()` each return a fresh wrapper schema
    // whose `.description` getter does NOT walk into the inner schema. The
    // MCP SDK reads `schema.description` directly via getSchemaDescription,
    // so any chain that calls `.describe(...)` BEFORE `.optional()` would
    // strip the description from the public tool surface. This test asserts
    // every documented field has a non-empty description after registration.
    const schema = server.schema("harness_execute") as {
      inputSchema: Record<string, { description?: string | null } | undefined>;
    };
    const documented = [
      "resource_type", "url", "action", "resource_id", "org_id", "project_id",
      "resource_scope", "inputs", "input_set_ids", "body", "params", "confirm",
      "wait", "wait_timeout_seconds", "wait_poll_interval_seconds", "queries",
    ];
    for (const field of documented) {
      const desc = schema.inputSchema[field]?.description;
      expect(desc, `field "${field}" must expose a description on the registered schema`).toBeTruthy();
      expect(desc!.length, `field "${field}" description must be non-empty`).toBeGreaterThan(5);
    }
  });

  it("returns error when user declines", async () => {
    const declineServer = makeMcpServer("decline");
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(declineServer, registry, client, makeConfig());

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
    // Find the POST execute call.
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

  it("defaults remote pipeline_branch from branch and runs without read-cache preflight", async () => {
    mockRequest.mockImplementation((request: { method?: string }) => {
      if (request.method === "GET") {
        throw new Error("pipeline.get read-cache preflight should not run");
      }
      return Promise.resolve({ data: { planExecutionId: "exec-remote" } });
    });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      params: {
        storeType: "REMOTE",
        connectorRef: "account.github",
        repoName: "testdataserv",
        branch: "feature/my-fix",
      },
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();

    const postCall = mockRequest.mock.calls[0]![0] as { method?: string; params?: Record<string, unknown> };
    expect(postCall.method).toBe("POST");
    expect(postCall.params).toMatchObject({
      branch: "feature/my-fix",
      pipelineBranchName: "feature/my-fix",
      storeType: "REMOTE",
      connectorRef: "account.github",
      repoName: "testdataserv",
    });
  });

  it("defaults remote pipeline branch from full runtime YAML codebase branch", async () => {
    mockRequest.mockImplementation((request: { method?: string }) => {
      if (request.method === "GET") {
        throw new Error("pipeline.get read-cache preflight should not run");
      }
      return Promise.resolve({ data: { planExecutionId: "exec-yaml" } });
    });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "my-pipe",
      inputs: `
pipeline:
  identifier: my-pipe
  properties:
    ci:
      codebase:
        repoName: testdataserv
        build:
          type: branch
          spec:
            branch: feature/from-yaml
`,
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledOnce();

    const postCall = mockRequest.mock.calls[0]![0] as { method?: string; params?: Record<string, unknown> };
    expect(postCall.method).toBe("POST");
    expect(postCall.params).toMatchObject({
      branch: "feature/from-yaml",
      pipelineBranchName: "feature/from-yaml",
      storeType: "REMOTE",
      repoName: "testdataserv",
    });
  });

  it("closes a pull request from a Harness PR URL", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ number: 42, state: "closed" });
    const prClient = makeClient(prRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(prServer, prRegistry, prClient, makeConfig());

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
    registerExecuteTool(prServer, prRegistry, prClient, makeConfig());

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
    registerExecuteTool(prServer, prRegistry, prClient, makeConfig());

    const result = await prServer.call("harness_execute", {
      url: "https://app.harness.io/ng/account/test-account/module/code/orgs/default/projects/test-project/repos/my-repo/pull-requests/42",
      resource_id: "43",
      action: "close",
    });

    expect(result.isError).toBeUndefined();
    const call = prRequest.mock.calls[0]![0] as { path?: string };
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/43/state");
  });

  it("passes pull request merge delete_source_branch=false from params to the API body", async () => {
    const prServer = makeMcpServer("accept");
    const prRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const prRequest = vi.fn().mockResolvedValue({ branch_deleted: false });
    const prClient = makeClient(prRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(prServer, prRegistry, prClient, makeConfig());

    const result = await prServer.call("harness_execute", {
      resource_type: "pull_request",
      action: "merge",
      resource_id: "42",
      params: {
        repo_id: "my-repo",
        method: "squash",
        delete_source_branch: false,
        dry_run: false,
      },
      org_id: "default",
      project_id: "test-project",
    });

    expect(result.isError).toBeUndefined();
    const call = prRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/code/api/v1/repos/my-repo/pullreq/42/merge");
    expect(call.body).toEqual({
      method: "squash",
      delete_source_branch: false,
      dry_run: false,
    });
  });

  it("does not remap resource_id to child field when primary matches (GitOps contract)", async () => {
    const gitopsServer = makeMcpServer("accept");
    const gitopsRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const gitopsRequest = vi.fn().mockResolvedValue({});
    const gitopsClient = makeClient(gitopsRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(gitopsServer, gitopsRegistry, gitopsClient, makeConfig());

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

  it("maps resource_id to file_store_id for File Store list_children", async () => {
    const fileStoreServer = makeMcpServer("accept");
    const fileStoreRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    const fileStoreRequest = vi.fn().mockResolvedValue({ data: { nodes: [] } });
    const fileStoreClient = makeClient(fileStoreRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fileStoreServer, fileStoreRegistry, fileStoreClient, makeConfig());

    const result = await fileStoreServer.call("harness_execute", {
      resource_type: "file_store",
      action: "list_children",
      resource_id: "folder123",
      params: { folder_name: "scripts" },
    });

    expect(result.isError).toBeUndefined();
    expect(fileStoreRequest).toHaveBeenCalledOnce();
    const call = fileStoreRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/file-store/folder");
    expect(call.body).toEqual({ identifier: "folder123", name: "scripts", type: "FOLDER" });
  });

  it("passes resource_scope through for File Store list_children", async () => {
    const fileStoreServer = makeMcpServer("accept");
    const fileStoreRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    const fileStoreRequest = vi.fn().mockResolvedValue({ data: { nodes: [] } });
    const fileStoreClient = makeClient(fileStoreRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fileStoreServer, fileStoreRegistry, fileStoreClient, makeConfig());

    const result = await fileStoreServer.call("harness_execute", {
      resource_type: "file_store",
      action: "list_children",
      resource_id: "folder123",
      resource_scope: "account",
      params: { folder_name: "scripts" },
    });

    expect(result.isError).toBeUndefined();
    const call = fileStoreRequest.mock.calls[0]![0] as { params?: Record<string, unknown> };
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
  });

  it("uses URL-derived account scope for File Store list_children", async () => {
    const fileStoreServer = makeMcpServer("accept");
    const fileStoreRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    const fileStoreRequest = vi.fn().mockResolvedValue({ data: { nodes: [] } });
    const fileStoreClient = makeClient(fileStoreRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fileStoreServer, fileStoreRegistry, fileStoreClient, makeConfig());

    const result = await fileStoreServer.call("harness_execute", {
      url: "https://app.harness.io/ng/account/test-account/all/settings/file-store/folder123",
      action: "list_children",
      params: { folder_name: "scripts" },
    });

    expect(result.isError).toBeUndefined();
    const call = fileStoreRequest.mock.calls[0]![0] as { params?: Record<string, unknown>; body?: unknown };
    expect(call.params?.orgIdentifier).toBeUndefined();
    expect(call.params?.projectIdentifier).toBeUndefined();
    expect(call.body).toEqual({ identifier: "folder123", name: "scripts", type: "FOLDER" });
  });

  it("rejects File Store list_children shorthand fields inside body before dispatch", async () => {
    const fileStoreServer = makeMcpServer("accept");
    const fileStoreRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    const fileStoreRequest = vi.fn().mockResolvedValue({ data: { nodes: [] } });
    const fileStoreClient = makeClient(fileStoreRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fileStoreServer, fileStoreRegistry, fileStoreClient, makeConfig());

    const result = await fileStoreServer.call("harness_execute", {
      resource_type: "file_store",
      action: "list_children",
      body: { file_store_id: "folder123", folder_name: "scripts" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("body.identifier as a string") });
    expect(fileStoreRequest).not.toHaveBeenCalled();
  });

  it.each([
    { action: "enable", method: "POST", expectedBody: {} },
    { action: "disable", method: "DELETE", expectedBody: undefined },
  ])("maps resource_id to segment_name for FME rule-based segment $action", async ({ action, method, expectedBody }) => {
    const fmeServer = makeMcpServer("accept");
    const fmeRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "feature-flags" }));
    const fmeRequest = vi.fn().mockResolvedValue({});
    const fmeClient = makeClient(fmeRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fmeServer, fmeRegistry, fmeClient, makeConfig());

    const result = await fmeServer.call("harness_execute", {
      resource_type: "fme_rule_based_segment_definition",
      action,
      resource_id: "beta_users",
      params: { environment_id: "env-prod" },
    });

    expect(result.isError).toBeUndefined();
    expect(fmeRequest).toHaveBeenCalledOnce();
    const call = fmeRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: unknown };
    expect(call.method).toBe(method);
    expect(call.path).toBe("/internal/api/v2/rule-based-segments/env-prod/beta_users");
    expect(call.body).toEqual(expectedBody);
  });

  it("maps resource_id to exemption_id for successful security_exemption approve", async () => {
    const stoServer = makeMcpServer("accept");
    const stoRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
    const stoRequest = vi.fn().mockResolvedValue({ status: "APPROVED" });
    const stoClient = {
      request: stoRequest,
      account: "test-account",
      getCurrentUserId: vi.fn().mockResolvedValue("user-uuid-1"),
    } as unknown as HarnessClient;
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(stoServer, stoRegistry, stoClient, makeConfig());

    const result = await stoServer.call("harness_execute", {
      resource_type: "security_exemption",
      action: "approve",
      resource_id: "ex-1",
      body: { scope: "CURRENT" },
    });

    expect(result.isError).toBeUndefined();
    expect(stoRequest).toHaveBeenCalledOnce();
    const call = stoRequest.mock.calls[0]![0] as { method?: string; path?: string; body?: Record<string, unknown> };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/sto/api/v2/exemptions/ex-1/approve");
    expect(call.body).toMatchObject({ approverId: "user-uuid-1" });
    expect(call.body).not.toHaveProperty("scope");
  });

  it("maps resource_id to feature_flag_name for successful FME kill and wraps primitive response", async () => {
    const fmeServer = makeMcpServer("accept");
    const fmeRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "feature-flags" }));
    const fmeRequest = vi.fn().mockResolvedValue(true);
    const fmeClient = makeClient(fmeRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(fmeServer, fmeRegistry, fmeClient, makeConfig());

    const result = await fmeServer.call("harness_execute", {
      resource_type: "fme_feature_flag",
      action: "kill",
      resource_id: "my-flag",
      params: { workspace_id: "ws-1", environment_id: "env-prod" },
    });

    expect(result.isError).toBeUndefined();
    expect(fmeRequest).toHaveBeenCalledOnce();
    const call = fmeRequest.mock.calls[0]![0] as { method?: string; path?: string };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/internal/api/v2/splits/ws/ws-1/my-flag/environments/env-prod/kill");

    const data = parseResult(result) as Record<string, unknown>;
    expect(data).toMatchObject({ success: true, result: true });
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

  it("does not suggest diagnose when wait times out before a terminal status", async () => {
    vi.useFakeTimers();
    try {
      mockRequest
        .mockResolvedValueOnce({ data: { planExecutionId: "exec-wait-running", status: "RUNNING" } })
        .mockResolvedValue({
          data: {
            pipelineExecutionSummary: {
              planExecutionId: "exec-wait-running",
              status: "Running",
              name: "Running Pipeline",
              pipelineIdentifier: "running_pipe",
              startTs: 1_700_000_000_000,
            },
          },
        });

      const pending = server.call("harness_execute", {
        resource_type: "pipeline",
        action: "run",
        resource_id: "running_pipe",
        wait: true,
        wait_poll_interval_seconds: 2,
        wait_timeout_seconds: 10,
      });

      for (let i = 0; i < 50; i++) {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await pending;
      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { _wait?: { hint?: string }; execution_timed_out?: boolean };
      expect(data.execution_timed_out).toBe(true);
      expect(data._wait?.hint).toContain("wait for a terminal status");
      expect(data._wait?.hint).not.toContain("harness_diagnose");
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves trigger response and surfaces wait error when execution polling fails persistently", async () => {
    vi.useFakeTimers();
    try {
      mockRequest
        .mockResolvedValueOnce({ data: { planExecutionId: "exec-wait-error", status: "RUNNING" } })
        .mockRejectedValue(new Error("503 Service Unavailable"));

      const pending = server.call("harness_execute", {
        resource_type: "pipeline",
        action: "run",
        resource_id: "error_pipe",
        wait: true,
        wait_poll_interval_seconds: 2,
        wait_timeout_seconds: 60,
      });

      for (let i = 0; i < 100; i++) {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(1000);
      }

      const result = await pending;
      expect(result.isError).toBeUndefined();

      const data = parseResult(result) as Record<string, unknown>;
      expect(data.planExecutionId).toBe("exec-wait-error");
      expect(data.execution_id).toBe("exec-wait-error");
      expect(data.execution_timed_out).toBeUndefined();
      expect(data._wait).toEqual(expect.objectContaining({
        error: expect.stringContaining("Polling execution exec-wait-error failed after 5 consecutive attempts"),
      }));
    } finally {
      vi.useRealTimers();
    }
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

  it("fails closed when input set materialization returns ERROR", async () => {
    mockRequest.mockResolvedValueOnce({
      status: "ERROR",
      message: "Input set not found",
      code: "INPUT_SET_NOT_FOUND",
    });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "mat_pipe",
      input_set_ids: ["missing-set"],
    });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("Could not load input set(s) for execution");
    expect(text).toContain("Input set not found");
    expect(mockRequest).toHaveBeenCalledOnce();
  });

  it("materializes input_set_ids when inputs is an empty object", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "skip_pipe"
    variables:
      - name: "branch"
        type: "String"
        value: "main"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } })
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-skip" } });

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "skip_pipe",
      inputs: {},
      input_set_ids: ["my-input-set"],
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    const getCall = mockRequest.mock.calls[0]![0] as { method?: string; path?: string };
    expect(getCall.method).toBe("GET");
    expect(getCall.path).toContain("/pipeline/api/inputSets/");
    expect(getCall.path).toContain("my-input-set");

    const runCall = mockRequest.mock.calls[1]![0] as { method?: string; body?: string };
    expect(runCall.method).toBe("POST");
    expect(runCall.body).toContain("skip_pipe");
    expect(runCall.body).toContain("branch");
    expect(runCall.body).toContain("main");
    expect(runCall.body).not.toContain("<+input>");
  });

  it("forwards git branch/repo to the input set GET for a remote pipeline run", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "remote_pipe"
    variables:
      - name: "env"
        type: "String"
        value: "prod"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } }) // input set GET
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-remote" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "remote_pipe",
      input_set_ids: ["remote-set"],
      params: {
        store_type: "REMOTE",
        connector_ref: "gh_conn",
        repo_name: "my-repo",
        branch: "feature/x",
      },
    });

    expect(result.isError).toBeUndefined();
    const getCall = mockRequest.mock.calls[0]![0] as {
      method?: string;
      path?: string;
      params?: Record<string, string | undefined>;
    };
    expect(getCall.method).toBe("GET");
    expect(getCall.path).toContain("/pipeline/api/inputSets/remote-set");
    // Git context must reach the input-set GET, else a remote set silently
    // resolves from the repo's default branch (wrong values, no error).
    expect(getCall.params?.branch).toBe("feature/x");
    expect(getCall.params?.repoName).toBe("my-repo");
    expect(getCall.params?.connectorRef).toBe("gh_conn");
    expect(getCall.params?.storeType).toBe("REMOTE");
  });

  it("materializes input_set_ids before applying inline input overrides", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "skip_pipe"
    variables:
      - name: "environment"
        type: "String"
        value: "prod"
      - name: "branch"
        type: "String"
        value: "main"
`;
    const templateWithRequired = `pipeline:
  identifier: "skip_pipe"
  variables:
    - name: "branch"
      type: "String"
      value: "<+input>"
    - name: "environment"
      type: "String"
      value: "<+input>"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } }) // input set
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: templateWithRequired } }) // template
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-skip" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "skip_pipe",
      inputs: { branch: "feature" },
      input_set_ids: ["my-input-set"],
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(3);

    const getCall = mockRequest.mock.calls[0]![0] as { method?: string; path?: string };
    expect(getCall.method).toBe("GET");
    expect(getCall.path).toContain("/pipeline/api/inputSets/");
    expect(getCall.path).toContain("my-input-set");

    const templateCall = mockRequest.mock.calls[1]![0] as { method?: string; path?: string };
    expect(templateCall.method).toBe("POST");
    expect(templateCall.path).toBe("/pipeline/api/inputSets/template");

    const runCall = mockRequest.mock.calls[2]![0] as {
      method?: string;
      body?: string;
      params?: Record<string, string | string[] | undefined>;
    };
    expect(runCall.method).toBe("POST");
    expect(runCall.body).toContain("branch");
    expect(runCall.body).toContain("feature");
    expect(runCall.body).toContain("environment");
    expect(runCall.body).toContain("prod");
    expect(runCall.body).not.toContain("<+input>");
    expect(runCall.params?.inputSetIdentifiers).toBeUndefined();
  });

  it("uses pipeline_branch for both remote input-set materialization and runtime template resolution", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "remote_override_pipe"
    variables:
      - name: "environment"
        type: "String"
        value: "prod"
      - name: "branch"
        type: "String"
        value: "main"
`;
    const templateWithRequired = `pipeline:
  identifier: "remote_override_pipe"
  variables:
    - name: "branch"
      type: "String"
      value: "<+input>"
    - name: "environment"
      type: "String"
      value: "<+input>"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } }) // input set
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetTemplateYaml: templateWithRequired } }) // template
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-remote-override" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "remote_override_pipe",
      inputs: { environment: "staging" },
      input_set_ids: ["remote-set"],
      params: {
        store_type: "REMOTE",
        connector_ref: "gh_conn",
        repo_name: "my-repo",
        pipeline_branch: "feature/x",
      },
    });

    expect(result.isError).toBeUndefined();
    expect(mockRequest).toHaveBeenCalledTimes(3);

    const getCall = mockRequest.mock.calls[0]![0] as {
      method?: string;
      params?: Record<string, string | undefined>;
    };
    expect(getCall.method).toBe("GET");
    expect(getCall.params?.branch).toBe("feature/x");
    expect(getCall.params?.repoName).toBe("my-repo");
    expect(getCall.params?.connectorRef).toBe("gh_conn");
    expect(getCall.params?.storeType).toBe("REMOTE");

    const templateCall = mockRequest.mock.calls[1]![0] as {
      method?: string;
      path?: string;
      params?: Record<string, string | undefined>;
    };
    expect(templateCall.method).toBe("POST");
    expect(templateCall.path).toBe("/pipeline/api/inputSets/template");
    expect(templateCall.params?.branch).toBe("feature/x");

    const runCall = mockRequest.mock.calls[2]![0] as {
      method?: string;
      body?: string;
      params?: Record<string, string | string[] | undefined>;
    };
    expect(runCall.method).toBe("POST");
    expect(runCall.body).toContain("environment");
    expect(runCall.body).toContain("staging");
    expect(runCall.body).toContain("branch");
    expect(runCall.body).toContain("main");
    expect(runCall.params?.pipelineBranchName).toBe("feature/x");
    expect(runCall.params?.inputSetIdentifiers).toBeUndefined();
  });

  it("merges input_set_ids into a full pipeline YAML STRING passed as inputs", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "str_pipe"
    variables:
      - name: "environment"
        type: "String"
        value: "prod"
      - name: "branch"
        type: "String"
        value: "main"
`;
    // Caller passes a full pipeline document as a YAML string alongside an
    // input set. Previously this skipped materialization and dropped the set.
    const inlineYaml = `pipeline:
  identifier: "str_pipe"
  variables:
    - name: "branch"
      type: "String"
      value: "feature"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } }) // input set GET
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-str" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "str_pipe",
      inputs: inlineYaml,
      input_set_ids: ["my-input-set"],
    });

    expect(result.isError).toBeUndefined();
    // Only the input set GET + the execute POST — no template fetch needed.
    expect(mockRequest).toHaveBeenCalledTimes(2);

    const getCall = mockRequest.mock.calls[0]![0] as { method?: string; path?: string };
    expect(getCall.method).toBe("GET");
    expect(getCall.path).toContain("/pipeline/api/inputSets/");
    expect(getCall.path).toContain("my-input-set");

    const runCall = mockRequest.mock.calls[1]![0] as {
      method?: string;
      body?: string;
      params?: Record<string, string | string[] | undefined>;
    };
    expect(runCall.method).toBe("POST");
    // Input set base value present...
    expect(runCall.body).toContain("environment");
    expect(runCall.body).toContain("prod");
    // ...and the caller's inline override wins for branch.
    expect(runCall.body).toContain("feature");
    expect(runCall.body).not.toContain("main");
    // Input set applied via body, not the ignored query param.
    expect(runCall.params?.inputSetIdentifiers).toBeUndefined();
  });

  it("merges input_set_ids into a full pipeline OBJECT passed as inputs", async () => {
    const inputSetYaml = `inputSet:
  pipeline:
    identifier: "obj_pipe"
    variables:
      - name: "environment"
        type: "String"
        value: "prod"
`;
    mockRequest
      .mockResolvedValueOnce({ status: "SUCCESS", data: { inputSetYaml } }) // input set GET
      .mockResolvedValueOnce({ data: { planExecutionId: "exec-obj" } }); // execute

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "obj_pipe",
      inputs: {
        pipeline: {
          identifier: "obj_pipe",
          variables: [{ name: "branch", type: "String", value: "feature" }],
        },
      },
      input_set_ids: ["my-input-set"],
    });

    expect(result.isError).toBeUndefined();
    const runCall = mockRequest.mock.calls[mockRequest.mock.calls.length - 1]![0] as {
      body?: string;
      params?: Record<string, string | string[] | undefined>;
    };
    // Input set base + caller override both present in the merged body.
    expect(runCall.body).toContain("environment");
    expect(runCall.body).toContain("prod");
    expect(runCall.body).toContain("feature");
    expect(runCall.params?.inputSetIdentifiers).toBeUndefined();
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

  it("fails closed when auto-resolving pipeline runtime inputs fails", async () => {
    mockRequest.mockRejectedValueOnce(new Error("template service unavailable"));

    const result = await server.call("harness_execute", {
      resource_type: "pipeline",
      action: "run",
      resource_id: "fail_closed_pipe",
      inputs: { branch: "main" },
    });

    expect(result.isError).toBe(true);
    expect(parseResult(result)).toMatchObject({
      error: expect.stringContaining("Could not auto-resolve runtime inputs"),
    });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]![0]).toMatchObject({
      method: "POST",
      path: "/pipeline/api/inputSets/template",
    });
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

  it("batch HQL validate is allowed in read-only mode (read-risk action), matching the single-query contract", async () => {
    // Regression: the batch read-only gate must be risk-based — mirroring
    // registry.dispatchExecute() — so a read-safe action (hql validate, which
    // is risk:"read") still fans out in read-only mode instead of being blocked
    // by a tool-family check. Write-risk actions are gated by the same `risk`
    // comparison before any query is dispatched.
    const roServer = makeMcpServer("accept");
    const roRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "knowledge-graph", HARNESS_READ_ONLY: true }));
    const roRequest = vi.fn().mockResolvedValue({ is_valid: true, errors: [] });
    const roClient = makeClient(roRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(roServer, roRegistry, roClient, makeConfig({ HARNESS_READ_ONLY: true }));

    const result = await roServer.call("harness_execute", {
      resource_type: "hql_query",
      action: "validate",
      queries: [{ query_string: "find view \"x\"" }],
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { summary: { total: number; succeeded: number } };
    expect(data.summary).toMatchObject({ total: 1, succeeded: 1 });
    expect(roRequest).toHaveBeenCalledTimes(1);
  });

  it("batch HQL validate fans out and returns a per-query summary when allowed", async () => {
    const kgServer = makeMcpServer("accept");
    const kgRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "knowledge-graph" }));
    const kgRequest = vi.fn().mockResolvedValue({ is_valid: true, errors: [] });
    const kgClient = makeClient(kgRequest);
    const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
    registerExecuteTool(kgServer, kgRegistry, kgClient, makeConfig());

    const result = await kgServer.call("harness_execute", {
      resource_type: "hql_query",
      action: "validate",
      queries: [
        { query_string: "find view \"a\"" },
        { query_string: "find view \"b\"" },
      ],
      confirm: true,
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      results: { query_string: string; success: boolean }[];
      summary: { total: number; succeeded: number; failed: number };
    };
    expect(data.summary).toEqual({ total: 2, succeeded: 2, failed: 0 });
    expect(data.results.map((r) => r.query_string)).toEqual(["find view \"a\"", "find view \"b\""]);
    expect(data.results.every((r) => r.success)).toBe(true);
    expect(kgRequest).toHaveBeenCalledTimes(2);
  });

  describe("pipeline_dynamic_execution.run — public tool contract", () => {
    it("validates body must be an object — strict clients sending a string body are rejected", async () => {
      const schema = server.schema("harness_execute") as { inputSchema: Record<string, { safeParse: (v: unknown) => { success: boolean } }> };
      const bodySchema = schema.inputSchema.body!;
      // The shared harness_execute tool types `body` as a record. Strict MCP
      // clients enforce this — a raw YAML string fails Zod parsing before the
      // registry/bodyBuilder ever runs. The describe surface must not advertise
      // a shape strict clients cannot use.
      expect(bodySchema.safeParse("pipeline:\n  identifier: x").success).toBe(false);
      expect(bodySchema.safeParse({ yaml: "pipeline: {}" }).success).toBe(true);
      expect(bodySchema.safeParse({ yaml: { pipeline: { identifier: "x" } } }).success).toBe(true);
    });

    it("end-to-end: harness_execute(action='run') sends body.yaml as the API body", async () => {
      mockRequest.mockResolvedValueOnce({
        execution_details: { execution_id: "exec-tool-1", status: "RUNNING" },
      });

      const result = await server.call("harness_execute", {
        resource_type: "pipeline_dynamic_execution",
        action: "run",
        resource_id: "Deploy_Web_Application",
        org_id: "myorg",
        project_id: "myproj",
        body: { yaml: "pipeline:\n  identifier: dynamic\n" },
      });

      expect(result.isError).toBeUndefined();
      const data = parseResult(result) as { execution_id: string; status: string; openInHarness?: string };
      expect(data.execution_id).toBe("exec-tool-1");
      expect(data.status).toBe("RUNNING");
      expect(data.openInHarness).toContain("/orgs/myorg/projects/myproj/pipelines/Deploy_Web_Application/");
      expect(data.openInHarness).toContain("/deployments/exec-tool-1/pipeline");

      const postCall = mockRequest.mock.calls.find((c) => (c[0] as { method?: string }).method === "POST" && (c[0] as { path?: string }).path?.includes("/execute/dynamic"));
      expect(postCall, "expected a POST to /execute/dynamic").toBeDefined();
      const req = postCall![0] as { path: string; body: unknown; params?: Record<string, unknown> };
      expect(req.path).toBe("/v1/orgs/myorg/projects/myproj/pipelines/Deploy_Web_Application/execute/dynamic");
      expect(req.body).toEqual({ yaml: "pipeline:\n  identifier: dynamic\n" });
    });

    it("end-to-end: passes module_type / notes / notify_only_user via params", async () => {
      mockRequest.mockResolvedValueOnce({
        execution_details: { execution_id: "exec-tool-2", status: "RUNNING" },
      });

      const result = await server.call("harness_execute", {
        resource_type: "pipeline_dynamic_execution",
        action: "run",
        resource_id: "p1",
        body: { yaml: "pipeline: {}\n" },
        params: { module_type: "CI", notes: "agent run", notify_only_user: true },
      });

      expect(result.isError).toBeUndefined();
      const postCall = mockRequest.mock.calls.find((c) => (c[0] as { method?: string }).method === "POST" && (c[0] as { path?: string }).path?.includes("/execute/dynamic"));
      expect(postCall).toBeDefined();
      const req = postCall![0] as { params?: Record<string, unknown> };
      expect(req.params).toMatchObject({
        moduleType: "CI",
        notes: "agent run",
        notify_only_user: true,
      });
    });

    it("returns a clear error when body.yaml is missing", async () => {
      const result = await server.call("harness_execute", {
        resource_type: "pipeline_dynamic_execution",
        action: "run",
        resource_id: "p1",
        body: { somethingElse: "wrong" },
      });

      expect(result.isError).toBe(true);
      expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("body.yaml") });
    });

    it("is blocked in read-only mode because run is risk:'high_write' (and does NOT prompt the user)", async () => {
      // Mirrors registry.dispatchExecute()'s risk-based gate: a high_write
      // action must NOT execute under HARNESS_READ_ONLY=true. This guards the
      // policy contract documented in TC-pdyn-005.
      //
      // Regression for Cursor PR #351 finding: the read-only gate must fire
      // BEFORE elicitation, otherwise users get prompted to approve writes
      // that can never run, AND the rejection escapes the new
      // outcome:"blocked" audit surface.
      const roServer = makeMcpServer("accept");
      const roRegistry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines", HARNESS_READ_ONLY: true }));
      const roRequest = vi.fn();
      const roClient = makeClient(roRequest);
      const { registerExecuteTool } = await import("../../src/tools/harness-execute.js");
      registerExecuteTool(roServer, roRegistry, roClient, makeConfig({ HARNESS_READ_ONLY: true }));

      const result = await roServer.call("harness_execute", {
        resource_type: "pipeline_dynamic_execution",
        action: "run",
        resource_id: "p1",
        body: { yaml: "pipeline: {}\n" },
      });

      expect(result.isError).toBe(true);
      expect(parseResult(result)).toMatchObject({ error: expect.stringContaining("Read-only mode") });
      expect(roRequest).not.toHaveBeenCalled();
      expect(roServer.server.elicitInput).not.toHaveBeenCalled();
    });
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

  it("exposes paramsSchema for pull request operations and execute actions", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pull-requests" }));
    const pullRequestServer = makeMcpServer();
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(pullRequestServer, registry);

    const result = await pullRequestServer.call("harness_describe", { resource_type: "pull_request" });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      operations: Array<{ operation: string; paramsSchema?: { fields: Array<{ name: string; required: boolean }> } }>;
      executeActions: Array<{ action: string; paramsSchema?: { fields: Array<{ name: string; required: boolean }> } }>;
    };
    const create = data.operations.find((op) => op.operation === "create");
    expect(create?.paramsSchema?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "repo_id", required: true }),
      ]),
    );

    const merge = data.executeActions.find((action) => action.action === "merge");
    expect(merge?.paramsSchema?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "repo_id", required: true }),
        expect.objectContaining({ name: "pr_number", required: true }),
      ]),
    );
  });

  it("exposes File Store list_children shorthands as paramsSchema and only FileStoreNode fields as bodySchema", async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file_store" }));
    const fileStoreServer = makeMcpServer();
    const { registerDescribeTool } = await import("../../src/tools/harness-describe.js");
    registerDescribeTool(fileStoreServer, registry);

    const result = await fileStoreServer.call("harness_describe", { resource_type: "file_store" });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as {
      executeActions: Array<{
        action: string;
        paramsSchema?: { fields: Array<{ name: string; required: boolean; description?: string }> };
        bodySchema?: { fields: Array<{ name: string; required: boolean; description?: string }> };
      }>;
    };
    const listChildren = data.executeActions.find((action) => action.action === "list_children");
    expect(listChildren?.paramsSchema?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "file_store_id" }),
        expect.objectContaining({ name: "folder_identifier" }),
        expect.objectContaining({ name: "folder_name" }),
        expect.objectContaining({ name: "node_type", description: expect.stringContaining("FOLDER only") }),
      ]),
    );
    expect(listChildren?.bodySchema?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "identifier", required: true }),
        expect.objectContaining({ name: "name", required: true }),
        expect.objectContaining({ name: "type", required: true, description: expect.stringContaining("FOLDER only") }),
      ]),
    );
    const bodyFieldNames = listChildren?.bodySchema?.fields.map((field) => field.name) ?? [];
    expect(bodyFieldNames).not.toContain("file_store_id");
    expect(bodyFieldNames).not.toContain("folder_identifier");
    expect(bodyFieldNames).not.toContain("folder_name");
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

  it("rejects in-progress pipeline executions", async () => {
    const inProgressStatuses = [
      "Running",
      "AsyncWaiting",
      "TaskWaiting",
      "TimedWaiting",
      "NotStarted",
      "Queued",
      "Paused",
      "ResourceWaiting",
      "InterventionWaiting",
      "ApprovalWaiting",
      "WaitStepRunning",
      "QueuedLicenseLimitReached",
      "QueuedExecutionConcurrencyReached",
      "Pausing",
      "InputWaiting",
      "UploadWaiting",
      "QueuedGlobalInfraCapacityReached",
      "Discontinuing",
    ];

    for (const status of inProgressStatuses) {
      mockRequest.mockResolvedValueOnce({
        data: {
          pipelineExecutionSummary: {
            status,
            pipelineIdentifier: "test",
            planExecutionId: "e1",
            layoutNodeMap: {},
          },
        },
      });

      const result = await server.call("harness_diagnose", {
        options: { execution_id: "e1" },
      });

      expect(result.isError).toBe(true);
      const data = parseResult(result) as { error: string };
      expect(data.error).toContain(`Cannot diagnose execution with status '${status}'`);
      expect(data.error).toContain("Diagnosis is only available for completed executions");
    }
  });

  it("allows pipeline executions with shared terminal statuses", async () => {
    const terminalStatuses = [
      "Success",
      "Failed",
      "Errored",
      "IgnoreFailed",
      "Expired",
      "Aborted",
      "Skipped",
      "ApprovalRejected",
      "Suspended",
      "AbortedByFreeze",
    ];

    for (const status of terminalStatuses) {
      mockRequest.mockResolvedValueOnce({
        data: {
          pipelineExecutionSummary: {
            status,
            pipelineIdentifier: "test",
            planExecutionId: "e1",
            layoutNodeMap: {},
          },
        },
      });

      const result = await server.call("harness_diagnose", {
        options: { execution_id: "e1" },
      });

      if (result.isError) {
        const data = parseResult(result) as { error: string };
        expect(data.error).not.toContain("Cannot diagnose execution with status");
      }
    }
  });
});
