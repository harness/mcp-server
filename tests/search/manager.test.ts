import { describe, it, expect, vi } from "vitest";
import { SearchManager } from "../../src/search/manager.js";
import { NullSearchProvider } from "../../src/search/null-provider.js";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

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

  describe("canIndexCorpus", () => {
    it("allows resources corpus in single-user mode with local provider", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "single-user",
      }) as never);
      expect(mgr.canIndexCorpus("resources")).toBe(true);
    });

    it("blocks resources corpus in multi-user mode with local provider", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "multi-user",
      }) as never);
      expect(mgr.canIndexCorpus("resources")).toBe(false);
    });

    it("always allows mcp_resources corpus regardless of mode", () => {
      const mgr = new SearchManager(makeConfig({
        HARNESS_SEARCH_PROVIDER: "local",
        HARNESS_MCP_MODE: "multi-user",
      }) as never);
      expect(mgr.canIndexCorpus("mcp_resources")).toBe(true);
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
        corpus: "resources",
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
        corpus: "resources",
        accountId: "acct-1",
        metadata: { resource_type: "pipeline", identifier: "foo", name: "foo" },
      });

      expect(indexSpy).toHaveBeenCalledOnce();
    });
  });
});
