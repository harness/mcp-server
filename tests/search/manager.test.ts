import { describe, it, expect, vi, afterEach } from "vitest";
import { SearchManager } from "../../src/search/manager.js";
import { NullSearchProvider } from "../../src/search/null-provider.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";
import { RemoteSearchProvider } from "../../src/search/remote-provider.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_MCP_MODE: "single-user" as const,
    HARNESS_SEARCH_PROVIDER: "none" as const,
    HARNESS_SEARCH_SERVICE_URL: undefined,
    ...overrides,
  };
}

describe("SearchManager", () => {
  it("returns NullSearchProvider when HARNESS_SEARCH_PROVIDER=none", () => {
    const mgr = new SearchManager(makeConfig() as never);
    expect(mgr.getProvider()).toBeInstanceOf(NullSearchProvider);
  });

  it("provider.isAvailable() is false for null provider", () => {
    const mgr = new SearchManager(makeConfig() as never);
    expect(mgr.getProvider().isAvailable()).toBe(false);
  });

  it("initialize resolves without throwing", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    await expect(mgr.initialize()).resolves.toBeUndefined();
  });

  it("reports disabled readiness when search provider is none", async () => {
    const mgr = new SearchManager(makeConfig() as never);
    expect(mgr.getReadiness()).toEqual({ state: "disabled", configured: "none" });
    await mgr.initialize();
    expect(mgr.getReadiness()).toEqual({ state: "disabled", configured: "none" });
  });

  it("reports failed readiness when local provider initialization fails", async () => {
    vi.spyOn(LocalSearchProvider.prototype, "initialize").mockResolvedValueOnce();
    vi.spyOn(LocalSearchProvider.prototype, "isAvailable").mockReturnValue(false);
    vi.spyOn(LocalSearchProvider.prototype, "getInitError").mockReturnValue("Cannot find module '@huggingface/transformers'");

    const mgr = new SearchManager(makeConfig({ HARNESS_SEARCH_PROVIDER: "local" }) as never);
    expect(mgr.getReadiness()).toEqual({ state: "initializing", configured: "local" });

    await mgr.initialize();

    expect(mgr.getReadiness()).toEqual({
      state: "failed",
      configured: "local",
      error: "Cannot find module '@huggingface/transformers'",
    });
    expect(mgr.getProvider().isAvailable()).toBe(false);

    vi.restoreAllMocks();
  });

  describe("canIndexCorpus", () => {
    it("allows resources corpus in single-user mode with local provider", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "single-user",
      }) as never);
      expect(mgr.canIndexCorpus("entities")).toBe(true);
    });

    it("blocks resources corpus in multi-user mode with local provider", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "multi-user",
      }) as never);
      expect(mgr.canIndexCorpus("entities")).toBe(false);
    });

    it("always allows mcp_resources corpus regardless of mode", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "multi-user",
      }) as never);
      expect(mgr.canIndexCorpus("knowledge")).toBe(true);
    });
  });

  describe("remote provider wiring", () => {
    it("falls back to NullSearchProvider when remote is configured without a service URL", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "remote",
        HARNESS_SEARCH_SERVICE_URL: undefined,
      }) as never);
      expect(mgr.getProvider()).toBeInstanceOf(NullSearchProvider);
    });

    it("constructs RemoteSearchProvider when remote is configured with a service URL", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "remote",
        HARNESS_SEARCH_SERVICE_URL: "http://search-svc:8080",
        HARNESS_SEARCH_SERVICE_HEADERS: JSON.stringify({ Authorization: "Bearer tok" }),
        HARNESS_API_TIMEOUT_MS: 15_000,
      }) as never);
      expect(mgr.getProvider()).toBeInstanceOf(RemoteSearchProvider);
    });

    it("ignores non-string header values when parsing HARNESS_SEARCH_SERVICE_HEADERS", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      }));
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "remote",
        HARNESS_SEARCH_SERVICE_URL: "http://search-svc:8080",
        HARNESS_SEARCH_SERVICE_HEADERS: JSON.stringify({
          Authorization: "Bearer good",
          "x-bad-number": 42,
          "x-bad-object": { nested: true },
        }),
      }) as never);
      await mgr.initialize();
      const fetchMock = vi.mocked(globalThis.fetch);
      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer good");
      expect(headers["x-bad-number"]).toBeUndefined();
      expect(headers["x-bad-object"]).toBeUndefined();
      vi.unstubAllGlobals();
    });

    it("ignores invalid HARNESS_SEARCH_SERVICE_HEADERS JSON", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      }));
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "remote",
        HARNESS_SEARCH_SERVICE_URL: "http://search-svc:8080",
        HARNESS_SEARCH_SERVICE_HEADERS: "not-json",
      }) as never);
      await mgr.initialize();
      const fetchMock = vi.mocked(globalThis.fetch);
      const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined;
      expect(headers?.Authorization).toBeUndefined();
      vi.unstubAllGlobals();
    });
  });

  describe("indexItem", () => {
    it("skips resources indexing in multi-user mode with local provider", async () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "multi-user",
      }) as never);
      const provider = mgr.getProvider();
      const indexSpy = vi.spyOn(provider, "index");

      await mgr.indexItem({
        id: "pipeline:foo",
        content: "pipeline foo",
        corpus: "entities",
        accountId: "acct-1",
        metadata: { resource_type: "pipeline", identifier: "foo", name: "foo" },
      });

      expect(indexSpy).not.toHaveBeenCalled();
    });

    it("indexes resources in single-user mode with local provider", async () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "single-user",
      }) as never);
      await mgr.initialize();
      const provider = mgr.getProvider();
      if (!(provider instanceof LocalSearchProvider) || !provider.isAvailable()) {
        return;
      }
      const indexSpy = vi.spyOn(provider, "index");

      await mgr.indexItem({
        id: "pipeline:foo",
        content: "pipeline foo",
        corpus: "entities",
        accountId: "acct-1",
        metadata: { resource_type: "pipeline", identifier: "foo", name: "foo" },
      });

      expect(indexSpy).toHaveBeenCalledOnce();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
