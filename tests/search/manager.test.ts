import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchManager } from "../../src/search/manager.js";
import { NullSearchProvider } from "../../src/search/null-provider.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";
import type { SearchProvider, IndexableItem } from "../../src/search/types.js";
import { Registry } from "../../src/registry/index.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_SEARCH_PROVIDER: "none" as const,
    HARNESS_SEARCH_SERVICE_URL: undefined,
    HARNESS_TOOLSETS: "pipelines,connectors",
    ...overrides,
  };
}

function makeMockProvider(overrides: Partial<SearchProvider> = {}): SearchProvider & {
  index: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
} {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockReturnValue(true),
    search: vi.fn().mockResolvedValue([]),
    index: vi.fn().mockResolvedValue(undefined),
    evictExpired: vi.fn(),
    ...overrides,
  };
}

describe("SearchManager", () => {
  it("returns NullSearchProvider when HARNESS_SEARCH_PROVIDER=none", () => {
    const mgr = new SearchManager(makeConfig() as never);
    expect(mgr.getProvider()).toBeInstanceOf(NullSearchProvider);
  });

  it("returns LocalSearchProvider when HARNESS_SEARCH_PROVIDER=local", () => {
    const mgr = new SearchManager(makeConfig({ HARNESS_SEARCH_PROVIDER: "local" }) as never);
    expect(mgr.getProvider()).toBeInstanceOf(LocalSearchProvider);
  });

  it("provider.isAvailable() is false for null provider", () => {
    const mgr = new SearchManager(makeConfig() as never);
    expect(mgr.getProvider().isAvailable()).toBe(false);
  });

  it("initialize resolves without throwing", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await expect(mgr.initialize()).resolves.toBeUndefined();
  });

  it("falls back to NullSearchProvider when initialize fails", async () => {
    const failingProvider = makeMockProvider({
      initialize: vi.fn().mockRejectedValue(new Error("model load failed")),
    });
    const mgr = new SearchManager(makeConfig() as never);
    (mgr as unknown as { provider: SearchProvider }).provider = failingProvider;

    await mgr.initialize();

    expect(mgr.getProvider()).toBeInstanceOf(NullSearchProvider);
    expect(mgr.getProvider().isAvailable()).toBe(false);
  });

  it("indexStaticContent indexes resource definitions, examples, and schemas", async () => {
    const provider = makeMockProvider();
    const mgr = new SearchManager(makeConfig() as never);
    (mgr as unknown as { provider: SearchProvider }).provider = provider;
    const registry = new Registry(makeConfig() as never);

    await mgr.indexStaticContent(registry);

    const indexed = provider.index.mock.calls.map((call) => call[0] as IndexableItem);
    expect(indexed.some((item) => item.id === "resource-def:pipeline")).toBe(true);
    expect(indexed.some((item) => item.corpus === "mcp_resources" && item.ttlMs === 0)).toBe(true);
    expect(indexed.some((item) => item.id.startsWith("example:"))).toBe(true);
    expect(indexed.some((item) => item.id.startsWith("schema:"))).toBe(true);
    expect(indexed.some((item) => item.id.startsWith("entity-schema:"))).toBe(true);
    expect(indexed.some((item) => item.metadata.resource_type === "connector")).toBe(true);
  });

  it("indexStaticContent is a no-op when provider is unavailable", async () => {
    const provider = makeMockProvider({ isAvailable: vi.fn().mockReturnValue(false) });
    const mgr = new SearchManager(makeConfig() as never);
    (mgr as unknown as { provider: SearchProvider }).provider = provider;
    const registry = new Registry(makeConfig() as never);

    await mgr.indexStaticContent(registry);

    expect(provider.index).not.toHaveBeenCalled();
  });

  it("initializeIndex pre-indexes tier-1 list results for the account", async () => {
    const provider = makeMockProvider();
    const mgr = new SearchManager(makeConfig() as never);
    (mgr as unknown as { provider: SearchProvider }).provider = provider;
    const registry = new Registry(makeConfig() as never);
    const dispatch = vi.spyOn(registry, "dispatch").mockResolvedValue({
      items: [{ identifier: "pipe-1", name: "Deploy", description: "prod deploy" }],
    });
    const client = {
      account: "acc-123",
      request: vi.fn(),
    } as unknown as HarnessClient;

    await mgr.initializeIndex(registry, client);

    expect(dispatch).toHaveBeenCalled();
    const indexed = provider.index.mock.calls.map((call) => call[0] as IndexableItem);
    expect(indexed.some((item) => item.id === "pipeline:pipe-1" && item.accountId === "acc-123")).toBe(true);
    expect(indexed.every((item) => item.corpus === "resources")).toBe(true);
  });

  it("initializeIndex skips when provider is unavailable", async () => {
    const provider = makeMockProvider({ isAvailable: vi.fn().mockReturnValue(false) });
    const mgr = new SearchManager(makeConfig() as never);
    (mgr as unknown as { provider: SearchProvider }).provider = provider;
    const registry = new Registry(makeConfig() as never);
    const client = { account: "acc-123", request: vi.fn() } as unknown as HarnessClient;

    await mgr.initializeIndex(registry, client);

    expect(provider.index).not.toHaveBeenCalled();
  });
});
