/**
 * Semantic routing tests for harness_search — verifies scatter-gather narrowing,
 * fallback behavior, and tier-0 semantic result merging.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { SearchManager } from "../../src/search/manager.js";
import type { SearchProvider, SearchResult } from "../../src/search/types.js";
import { Registry } from "../../src/registry/index.js";

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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

function makeMcpServer() {
  const tools = new Map<string, { schema: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    registerTool: vi.fn((name: string, schema: unknown, handler: (...args: unknown[]) => Promise<ToolResult>) => {
      tools.set(name, { schema, handler });
    }),
    async call(name: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = tools.get(name);
      if (!tool) throw new Error(`Tool "${name}" not registered`);
      return tool.handler(args, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} });
    },
  };
}

function parseResult(result: ToolResult): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

function makeMockProvider(searchResults: SearchResult[]) {
  const provider: SearchProvider & { search: ReturnType<typeof vi.fn> } = {
    initialize: vi.fn().mockResolvedValue(undefined),
    isAvailable: () => true,
    search: vi.fn().mockResolvedValue(searchResults),
    index: vi.fn().mockResolvedValue(undefined),
    evictExpired: vi.fn(),
  };
  return provider;
}

function makeSearchManager(provider: SearchProvider): SearchManager {
  return { getProvider: () => provider } as SearchManager;
}

describe("harness_search semantic routing", () => {
  let mockRequest: ReturnType<typeof vi.fn>;
  let registry: Registry;
  let client: HarnessClient;
  let server: ReturnType<typeof makeMcpServer>;

  beforeEach(async () => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "item-1", name: "test" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
    server = makeMcpServer();
  });

  it("narrows scatter-gather to high-confidence semantic resource types", async () => {
    const provider = makeMockProvider([
      {
        id: "resource-def:connector",
        content: "connector git credentials",
        score: 0.82,
        corpus: "mcp_resources",
        metadata: { resource_type: "connector", type: "resource_definition" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const allListable = registry.getTypesForOperation("list").filter(
      (rt) => registry.supportsOperation(rt, "list"),
    );
    const result = await server.call("harness_search", { query: "github connector" });
    const data = parseResult(result);

    expect(data.semantic_routed).toBe(true);
    expect(data.types_skipped).toBe(allListable.length - 1);
    expect(data.searched_types).toBe(1);
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const path = (mockRequest.mock.calls[0]![0] as { path: string }).path;
    expect(path).toContain("connectors");
  });

  it("falls back to full scatter-gather when semantic scores are below routing threshold", async () => {
    const provider = makeMockProvider([
      {
        id: "resource-def:connector",
        content: "connector",
        score: 0.42,
        corpus: "mcp_resources",
        metadata: { resource_type: "connector" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const result = await server.call("harness_search", { query: "github" });
    const data = parseResult(result);

    expect(data.semantic_routed).toBeUndefined();
    expect(data.searched_types).toBeGreaterThan(1);
    expect(provider.search).toHaveBeenCalledWith(
      "github",
      expect.objectContaining({ corpus: "all", accountId: "test-account", k: 30 }),
    );
    expect(mockRequest).toHaveBeenCalled();
  });

  it("skips semantic routing when resource_types are explicitly provided", async () => {
    const provider = makeMockProvider([
      {
        id: "resource-def:pipeline",
        content: "pipeline deploy",
        score: 0.95,
        corpus: "mcp_resources",
        metadata: { resource_type: "pipeline" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const result = await server.call("harness_search", {
      query: "deploy",
      resource_types: ["pipeline", "connector"],
    });
    const data = parseResult(result);

    expect(data.semantic_routed).toBeUndefined();
    expect(data.searched_types).toBe(2);
    expect(provider.search).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("merges display-threshold semantic hits as tier-0 results", async () => {
    const provider = makeMockProvider([
      {
        id: "example:create-pipeline",
        content: "example pipeline yaml",
        score: 0.4,
        corpus: "mcp_resources",
        metadata: { resource_type: "pipeline", type: "example", name: "create-pipeline" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const result = await server.call("harness_search", { query: "pipeline example" });
    const data = parseResult(result);
    const results = data.results as Array<{ tier: number; resource_type: string; items: unknown[] }>;

    const tier0 = results.filter((r) => r.tier === 0);
    expect(tier0.length).toBeGreaterThan(0);
    expect(tier0[0]!.items[0]).toMatchObject({
      type: "example",
      name: "create-pipeline",
      _semantic_score: 0.4,
      _corpus: "mcp_resources",
    });
  });

  it("does not duplicate semantic hits already present in keyword results", async () => {
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "p1", name: "deploy pipeline" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);

    const provider = makeMockProvider([
      {
        id: "pipeline:p1",
        content: "deploy pipeline production",
        score: 0.75,
        corpus: "resources",
        metadata: { resource_type: "pipeline", identifier: "p1" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const result = await server.call("harness_search", { query: "deploy" });
    const data = parseResult(result);
    const results = data.results as Array<{ tier: number; items: Array<Record<string, unknown>> }>;

    const semanticDupes = results
      .filter((r) => r.tier === 0)
      .flatMap((r) => r.items)
      .filter((item) => item.identifier === "p1");
    expect(semanticDupes).toHaveLength(0);
  });

  it("ignores semantic hits for resource types outside the candidate set", async () => {
    const provider = makeMockProvider([
      {
        id: "resource-def:secret",
        content: "secret credentials",
        score: 0.9,
        corpus: "mcp_resources",
        metadata: { resource_type: "secret" },
      },
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, makeSearchManager(provider));

    const result = await server.call("harness_search", { query: "secret token" });
    const data = parseResult(result);

    expect(data.semantic_routed).toBeUndefined();
    expect(data.searched_types).toBeGreaterThan(1);
    expect(mockRequest).toHaveBeenCalled();
  });
});
