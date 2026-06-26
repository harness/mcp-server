import { describe, it, expect } from "vitest";
import { SearchManager } from "../../src/search/manager.js";
import { NullSearchProvider } from "../../src/search/null-provider.js";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    HARNESS_SEARCH_PROVIDER: "none",
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
});
