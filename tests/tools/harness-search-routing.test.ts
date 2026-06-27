/**
 * Unit tests for semantic search routing and tier-0 merge/dedup in harness_search.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ToolResult } from "../../src/utils/response-formatter.js";
import type { SearchManager } from "../../src/search/index.js";
import type { SearchProvider, SearchResult } from "../../src/search/types.js";
import { Registry } from "../../src/registry/index.js";
import {
  SEMANTIC_ROUTING_SAFETY_FLOOR,
  extractRoutingTypes,
  applyRoutingSafetyFloor,
} from "../../src/tools/harness-search.js";

const ROUTING_THRESHOLD = 0.5;
const DISPLAY_THRESHOLD = 0.35;

function makeSemanticResult(
  score: number,
  metadata: Record<string, string> = {},
  overrides: Partial<SearchResult> = {},
): SearchResult {
  return {
    id: overrides.id ?? `semantic-${metadata.resource_type ?? "unknown"}`,
    content: overrides.content ?? "semantic hit",
    score,
    corpus: overrides.corpus ?? "knowledge",
    metadata,
    ...overrides,
  };
}

function makeSemanticHit(resourceType: string, score: number): SearchResult {
  return makeSemanticResult(score, { resource_type: resourceType });
}

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

function makeMcpServer() {
  const tools = new Map<string, { schema: unknown; handler: (...args: unknown[]) => Promise<ToolResult> }>();
  return {
    server: {
      getClientCapabilities: () => ({}),
    },
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
  };
}

function makeSearchManager(results: SearchResult[]): SearchManager {
  const provider: SearchProvider = {
    initialize: async () => {},
    isAvailable: () => true,
    search: async () => results,
    index: async () => {},
    evictExpired: () => {},
  };
  return { getProvider: () => provider } as SearchManager;
}

function makeIndexingSearchManager() {
  const indexItem = vi.fn().mockResolvedValue(undefined);
  return {
    searchManager: { indexItem } as unknown as SearchManager,
    indexItem,
  };
}

function parseResult(result: ToolResult): unknown {
  return JSON.parse(result.content[0]!.text);
}

describe("extractRoutingTypes", () => {
  const candidateTypes = [
    "pipeline",
    "service",
    "environment",
    "connector",
    "secret",
    "template",
    "trigger",
  ];

  it("extracts high-confidence resource types from semantic hits", () => {
    expect(extractRoutingTypes([makeSemanticHit("secret", 0.8)], candidateTypes)).toEqual(["secret"]);
  });

  it("routes to a single type when one high-confidence hit matches a target type", () => {
    const results = [
      makeSemanticResult(0.82, { resource_type: "pipeline", type: "resource_definition" }),
    ];
    expect(extractRoutingTypes(results, candidateTypes)).toEqual(["pipeline"]);
  });

  it("routes to multiple types when several high-confidence hits match", () => {
    const results = [
      makeSemanticResult(0.9, { resource_type: "pipeline" }),
      makeSemanticResult(0.75, { resource_type: "connector" }),
      makeSemanticResult(0.6, { resource_type: "service" }),
    ];
    const routed = extractRoutingTypes(results, candidateTypes);
    expect(routed).toHaveLength(3);
    expect(routed).toEqual(expect.arrayContaining(["pipeline", "connector", "service"]));
  });

  it("returns null when all scores are below the routing threshold (full fallback)", () => {
    const results = [
      makeSemanticResult(ROUTING_THRESHOLD - 0.01, { resource_type: "pipeline" }),
      makeSemanticResult(0.2, { resource_type: "connector" }),
    ];
    expect(extractRoutingTypes(results, candidateTypes)).toBeNull();
  });

  it("ignores semantic hits below the routing threshold", () => {
    expect(extractRoutingTypes([makeSemanticHit("secret", 0.4)], candidateTypes)).toBeNull();
  });

  it("ignores comma-separated schema resource_type values that do not match a single target type", () => {
    const results = [
      makeSemanticResult(0.9, {
        resource_type: "template,pipeline,template_v1",
        type: "schema",
        schema_name: "template",
      }),
    ];
    expect(extractRoutingTypes(results, candidateTypes)).toBeNull();
  });

  it("ignores resource types outside the candidate target list", () => {
    expect(extractRoutingTypes([makeSemanticHit("secret", 0.9)], ["pipeline", "connector"])).toBeNull();
  });
});

describe("applyRoutingSafetyFloor", () => {
  const candidateTypes = [
    "pipeline",
    "service",
    "environment",
    "connector",
    "secret",
    "template",
    "trigger",
  ];

  it("always includes tier-1 safety floor types in the routed set", () => {
    const predicted = ["secret"];
    const routed = applyRoutingSafetyFloor(predicted, candidateTypes);
    for (const rt of SEMANTIC_ROUTING_SAFETY_FLOOR) {
      expect(routed).toContain(rt);
    }
    expect(routed).toContain("secret");
  });

  it("only adds safety floor types that are in the candidate set", () => {
    const routed = applyRoutingSafetyFloor(["secret"], ["secret", "pipeline"]);
    expect(routed).toEqual(expect.arrayContaining(["secret", "pipeline"]));
    expect(routed).not.toContain("service");
  });
});

describe("harness_search semantic routing integration", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines,connectors" }));
    mockRequest = vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "p1" }], totalElements: 1 },
    });
    client = makeClient(mockRequest);
  });

  it("narrows scatter-gather when semantic routing predicts specific types", async () => {
    const searchManager = makeSearchManager([
      makeSemanticResult(0.85, { resource_type: "connector", type: "resource_definition" }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, searchManager);

    const fullTypeCount = registry.getTypesForOperation("list").length;
    const result = await server.call("harness_search", { query: "github connector" });
    const data = parseResult(result) as {
      semantic_routed?: boolean;
      searched_types: number;
      types_skipped?: string[];
    };

    expect(data.semantic_routed).toBe(true);
    // connector prediction + pipeline safety floor (both in pipelines+connectors toolset)
    expect(data.searched_types).toBe(2);
    expect(data.types_skipped).toHaveLength(fullTypeCount - 2);
    expect(data.types_skipped).not.toContain("pipeline");
    expect(data.types_skipped).not.toContain("connector");
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it("falls back to full scatter-gather when routing scores are below threshold", async () => {
    const searchManager = makeSearchManager([
      makeSemanticResult(ROUTING_THRESHOLD - 0.05, { resource_type: "pipeline" }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, searchManager);

    const fullTypeCount = registry.getTypesForOperation("list").length;
    const result = await server.call("harness_search", { query: "deploy" });
    const data = parseResult(result) as { semantic_routed?: boolean; searched_types: number };

    expect(data.semantic_routed).toBeUndefined();
    expect(data.searched_types).toBe(fullTypeCount);
  });
});

describe("harness_search tier-0 semantic merge/dedup", () => {
  let server: ReturnType<typeof makeMcpServer>;
  let registry: Registry;
  let client: HarnessClient;

  beforeEach(() => {
    server = makeMcpServer();
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    client = makeClient(vi.fn().mockResolvedValue({
      data: { content: [], totalElements: 0 },
    }));
  });

  it("adds display-threshold semantic hits as tier-0 even when routing does not narrow", async () => {
    const searchManager = makeSearchManager([
      makeSemanticResult(DISPLAY_THRESHOLD + 0.05, {
        resource_type: "pipeline",
        type: "schema",
        schema_name: "pipeline",
        identifier: "schema:pipeline",
      }, { id: "schema:pipeline" }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, searchManager);

    const result = await server.call("harness_search", { query: "pipeline yaml" });
    const data = parseResult(result) as {
      total_matches: number;
      results: Array<{ tier: number; resource_type: string; items: unknown[] }>;
    };

    const tier0 = data.results.filter((entry) => entry.tier === 0);
    expect(tier0).toHaveLength(1);
    expect(tier0[0]!.resource_type).toBe("pipeline");
    expect(data.total_matches).toBe(1);
  });

  it("deduplicates semantic hits by identifier", async () => {
    const searchManager = makeSearchManager([
      makeSemanticResult(0.6, {
        resource_type: "pipeline",
        identifier: "dup-id",
      }, { id: "hit-1" }),
      makeSemanticResult(0.55, {
        resource_type: "pipeline",
        identifier: "dup-id",
      }, { id: "hit-2" }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, client, searchManager);

    const result = await server.call("harness_search", { query: "pipeline" });
    const data = parseResult(result) as {
      results: Array<{ tier: number; items: Array<Record<string, unknown>> }>;
    };

    const tier0Items = data.results
      .filter((entry) => entry.tier === 0)
      .flatMap((entry) => entry.items);
    expect(tier0Items).toHaveLength(1);
    expect(tier0Items[0]!._id).toBe("hit-1");
  });

  it("counts both keyword and tier-0 semantic hits in total_matches", async () => {
    const clientWithKeywordHit = makeClient(vi.fn().mockImplementation((req: { path?: string }) => {
      if (typeof req.path === "string" && req.path.includes("/pipelines/list")) {
        return Promise.resolve({
          data: { content: [{ identifier: "kw-pipe" }], totalElements: 1 },
        });
      }
      return Promise.resolve({ data: { content: [], totalElements: 0 } });
    }));
    const searchManager = makeSearchManager([
      makeSemanticResult(DISPLAY_THRESHOLD + 0.05, {
        resource_type: "service",
        identifier: "semantic-svc",
      }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, clientWithKeywordHit, searchManager);

    const result = await server.call("harness_search", { query: "deploy" });
    const data = parseResult(result) as { total_matches: number };

    expect(data.total_matches).toBe(2);
  });

  it("skips semantic hits whose identifier already appears in keyword results", async () => {
    const clientWithKeywordHit = makeClient(vi.fn().mockResolvedValue({
      data: { content: [{ identifier: "existing-pipe" }], totalElements: 1 },
    }));
    const searchManager = makeSearchManager([
      makeSemanticResult(0.7, {
        resource_type: "pipeline",
        identifier: "existing-pipe",
      }),
    ]);
    const { registerSearchTool } = await import("../../src/tools/harness-search.js");
    registerSearchTool(server, registry, clientWithKeywordHit, searchManager);

    const result = await server.call("harness_search", { query: "existing-pipe" });
    const data = parseResult(result) as {
      results: Array<{ tier: number; items: Array<Record<string, unknown>> }>;
    };

    const tier0Items = data.results
      .filter((entry) => entry.tier === 0)
      .flatMap((entry) => entry.items);
    expect(tier0Items).toHaveLength(0);
    const keywordItems = data.results
      .filter((entry) => entry.tier !== 0)
      .flatMap((entry) => entry.items) as Array<Record<string, unknown>>;
    expect(keywordItems.some((item) => item.identifier === "existing-pipe")).toBe(true);
  });
});

describe("live resource indexing guards", () => {
  it("skips harness_list semantic indexing for items without a stable identifier", async () => {
    const server = makeMcpServer();
    const dispatch = vi.fn().mockResolvedValue({
      items: [
        { name: "No Id" },
        { identifier: "stable-id", name: "Stable" },
      ],
      total: 2,
    });
    const registry = {
      getAllFilterFields: () => [],
      getTypesForOperation: () => ["pipeline"],
      getResource: () => ({}),
      dispatch,
    } as unknown as Registry;
    const { searchManager, indexItem } = makeIndexingSearchManager();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, makeClient(), searchManager);

    await server.call("harness_list", { resource_type: "pipeline" });

    expect(indexItem).toHaveBeenCalledOnce();
    expect(indexItem).toHaveBeenCalledWith(expect.objectContaining({
      id: "pipeline:stable-id",
      metadata: expect.objectContaining({ identifier: "stable-id" }),
    }));
  });

  it("indexes harness_list items using id when identifier is absent", async () => {
    const server = makeMcpServer();
    const dispatch = vi.fn().mockResolvedValue({
      items: [{ id: "legacy-id", name: "Legacy" }],
      total: 1,
    });
    const registry = {
      getAllFilterFields: () => [],
      getTypesForOperation: () => ["pipeline"],
      getResource: () => ({}),
      dispatch,
    } as unknown as Registry;
    const { searchManager, indexItem } = makeIndexingSearchManager();
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    registerListTool(server, registry, makeClient(), searchManager);

    await server.call("harness_list", { resource_type: "pipeline" });

    expect(indexItem).toHaveBeenCalledOnce();
    expect(indexItem).toHaveBeenCalledWith(expect.objectContaining({
      id: "pipeline:legacy-id",
      metadata: expect.objectContaining({ identifier: "legacy-id" }),
    }));
  });

  it("indexes harness_get responses using id when identifier is absent", async () => {
    const server = makeMcpServer();
    const dispatch = vi.fn().mockResolvedValue({ id: "legacy-id", name: "Legacy" });
    const registry = {
      getTypesForOperation: () => ["pipeline"],
      getResource: () => ({ identifierFields: ["identifier"] }),
      dispatch,
    } as unknown as Registry;
    const { searchManager, indexItem } = makeIndexingSearchManager();
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, makeClient(), searchManager);

    await server.call("harness_get", { resource_type: "pipeline", resource_id: "requested-id" });

    expect(indexItem).toHaveBeenCalledOnce();
    expect(indexItem).toHaveBeenCalledWith(expect.objectContaining({
      id: "pipeline:legacy-id",
      metadata: expect.objectContaining({ identifier: "legacy-id" }),
    }));
  });

  it("skips harness_get semantic indexing when the response has no stable identifier", async () => {
    const server = makeMcpServer();
    const dispatch = vi.fn().mockResolvedValue({ name: "No Id" });
    const registry = {
      getTypesForOperation: () => ["pipeline"],
      getResource: () => ({ identifierFields: ["identifier"] }),
      dispatch,
    } as unknown as Registry;
    const { searchManager, indexItem } = makeIndexingSearchManager();
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    registerGetTool(server, registry, makeClient(), searchManager);

    await server.call("harness_get", { resource_type: "pipeline", resource_id: "requested-id" });

    expect(indexItem).not.toHaveBeenCalled();
  });
});
