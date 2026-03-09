/**
 * Generic tool handler tests for all 10 MCP tools.
 *
 * Tests input validation and error handling paths with mocked registry/client.
 * Does not test actual API calls — that's covered by registry dispatch tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";
import { HarnessApiError } from "../../src/utils/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
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
  const tools = new Map<string, { handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi.fn().mockResolvedValue({ action: elicitAction }),
    },
    registerTool: vi.fn((name: string, _schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { handler });
    }),
    _tools: tools,
    /** Invoke a registered tool handler by name. */
    async call(name: string, args: Record<string, unknown>, extra?: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      const defaultExtra = { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} };
      return tool.handler(args, { ...defaultExtra, ...extra }) as Promise<ToolResult>;
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

  it("propagates 404 as errorResult", async () => {
    mockRequest.mockRejectedValueOnce(new HarnessApiError("Not found", 404));
    const result = await server.call("harness_get", { resource_type: "pipeline", resource_id: "missing" });
    expect(result.isError).toBe(true);
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
