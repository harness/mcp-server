import { describe, it, expect } from "vitest";
import { NullSearchProvider } from "../../src/search/null-provider.js";

describe("NullSearchProvider", () => {
  it("is not available", async () => {
    const p = new NullSearchProvider();
    await p.initialize();
    expect(p.isAvailable()).toBe(false);
  });

  it("returns empty results", async () => {
    const p = new NullSearchProvider();
    await p.initialize();
    const results = await p.search("anything");
    expect(results).toEqual([]);
  });

  it("index is a no-op", async () => {
    const p = new NullSearchProvider();
    await p.initialize();
    await expect(p.index({ id: "x", content: "y", corpus: "entities", metadata: {} })).resolves.toBeUndefined();
  });
});
