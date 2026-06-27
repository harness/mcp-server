import { describe, it, expect, vi } from "vitest";
import { SearchManager } from "../../src/search/manager.js";
import { NullSearchProvider } from "../../src/search/null-provider.js";
import {
  LocalSearchProvider,
  type LocalSearchProviderOptions,
} from "../../src/search/local-provider.js";
import * as localProviderModule from "../../src/search/local-provider.js";

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

  it("forwards HARNESS_SEARCH_MODEL to LocalSearchProvider constructor options", () => {
    const previous = process.env.HARNESS_SEARCH_MODEL;
    process.env.HARNESS_SEARCH_MODEL = "custom/search-model";
    const captured: LocalSearchProviderOptions[] = [];
    const Original = localProviderModule.LocalSearchProvider;
    class CapturingLocalSearchProvider extends Original {
      constructor(opts?: LocalSearchProviderOptions) {
        captured.push(opts ?? {});
        super(opts);
      }
    }
    const ctorSpy = vi.spyOn(localProviderModule, "LocalSearchProvider")
      .mockImplementation(CapturingLocalSearchProvider);

    try {
      new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_HF_CACHE_DIR: "/tmp/custom-hf-cache",
      }) as never);

      expect(captured).toEqual([{
        cacheDir: "/tmp/custom-hf-cache",
        model: "custom/search-model",
      }]);
    } finally {
      if (previous === undefined) {
        delete process.env.HARNESS_SEARCH_MODEL;
      } else {
        process.env.HARNESS_SEARCH_MODEL = previous;
      }
      ctorSpy.mockRestore();
    }
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
});
