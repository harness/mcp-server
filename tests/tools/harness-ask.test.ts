import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import { Registry } from "../../src/registry/index.js";

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
    requestStream: vi.fn(),
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { schema: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    registerTool: vi.fn((name: string, schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
    _tools: tools,
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

describe("harness_ask", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(async () => {
    server = makeMcpServer();
    registry = new Registry(makeConfig());
    client = makeClient();
  });

  it("registers tool with name harness_ask", async () => {
    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());
    expect(server._tools.has("harness_ask")).toBe(true);
  });

  it("has correct annotations", async () => {
    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());

    const call = server.registerTool.mock.calls[0];
    const schema = call[1] as { annotations: Record<string, unknown> };
    expect(schema.annotations).toEqual({
      title: "Ask AI DevOps Agent",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
  });

  it("is NOT registered when HARNESS_READ_ONLY=true", async () => {
    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig({ HARNESS_READ_ONLY: true }));
    expect(server._tools.has("harness_ask")).toBe(false);
  });

  it("is NOT registered when HARNESS_TOOLSETS excludes intelligence", async () => {
    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    const config = makeConfig({ HARNESS_TOOLSETS: "pipelines" });
    const filteredRegistry = new Registry(config);
    registerAskTool(server, filteredRegistry, client, config);
    expect(server._tools.has("harness_ask")).toBe(false);
  });

  it("IS registered when HARNESS_TOOLSETS includes intelligence", async () => {
    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    const config = makeConfig({ HARNESS_TOOLSETS: "pipelines,intelligence" });
    const filteredRegistry = new Registry(config);
    registerAskTool(server, filteredRegistry, client, config);
    expect(server._tools.has("harness_ask")).toBe(true);
  });

  it("calls intelligence service with correct request shape", async () => {
    const mockResponse = {
      conversation_id: "conv-1",
      response: "Here is your pipeline YAML",
    };
    const mockRequest = vi.fn().mockResolvedValue(mockResponse);
    client = makeClient(mockRequest);

    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());

    const result = await server.call("harness_ask", {
      prompt: "Create a deploy pipeline",
      action: "CREATE_PIPELINE",
      stream: false,
    });

    expect(result.isError).toBeUndefined();
    const data = parseResult(result) as { conversation_id: string; response: string };
    expect(data.conversation_id).toBe("conv-1");
    expect(data.response).toBe("Here is your pipeline YAML");
  });

  it("auto-generates conversation_id when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ conversation_id: "auto" });
    client = makeClient(mockRequest);

    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());

    await server.call("harness_ask", {
      prompt: "Test",
      action: "CREATE_PIPELINE",
      stream: false,
    });

    // Verify that a conversation_id was sent in the body
    const requestCall = mockRequest.mock.calls[0]![0] as { body: { conversation_id: string } };
    expect(requestCall.body.conversation_id).toBeDefined();
    expect(requestCall.body.conversation_id.length).toBeGreaterThan(0);
  });

  it("uses config defaults for org_id and project_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ conversation_id: "c" });
    client = makeClient(mockRequest);

    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig({
      HARNESS_DEFAULT_ORG_ID: "my-org",
      HARNESS_DEFAULT_PROJECT_ID: "my-project",
    }));

    await server.call("harness_ask", {
      prompt: "Test",
      action: "CREATE_SERVICE",
      stream: false,
    });

    const requestCall = mockRequest.mock.calls[0]![0] as { body: { harness_context: { org_id: string; project_id: string } } };
    expect(requestCall.body.harness_context.org_id).toBe("my-org");
    expect(requestCall.body.harness_context.project_id).toBe("my-project");
  });

  it("overrides org_id and project_id when provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ conversation_id: "c" });
    client = makeClient(mockRequest);

    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());

    await server.call("harness_ask", {
      prompt: "Test",
      action: "CREATE_PIPELINE",
      stream: false,
      org_id: "custom-org",
      project_id: "custom-project",
    });

    const requestCall = mockRequest.mock.calls[0]![0] as { body: { harness_context: { org_id: string; project_id: string } } };
    expect(requestCall.body.harness_context.org_id).toBe("custom-org");
    expect(requestCall.body.harness_context.project_id).toBe("custom-project");
  });

  it("returns errorResult when intelligence service returns an error", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      conversation_id: "c",
      error: "Model capacity exceeded",
    });
    client = makeClient(mockRequest);

    const { registerAskTool } = await import("../../src/tools/harness-ask.js");
    registerAskTool(server, registry, client, makeConfig());

    const result = await server.call("harness_ask", {
      prompt: "Test",
      action: "CREATE_PIPELINE",
      stream: false,
    });

    expect(result.isError).toBe(true);
    const data = parseResult(result) as { error: string };
    expect(data.error).toBe("Model capacity exceeded");
  });
});
