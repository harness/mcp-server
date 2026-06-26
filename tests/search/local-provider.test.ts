import { describe, it, expect, beforeAll } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

// These tests download the model on first run (~23MB); subsequent runs use cache
describe("LocalSearchProvider", () => {
  let provider: LocalSearchProvider;

  beforeAll(async () => {
    provider = new LocalSearchProvider();
    await provider.initialize();
  }, 60_000); // model download can take a moment

  it("is available after initialize", () => {
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns empty results for empty index", async () => {
    const results = await provider.search("anything", { corpus: "resources", accountId: "acc-empty" });
    expect(results).toEqual([]);
  });

  it("returns indexed item in search results", async () => {
    await provider.index({
      id: "pipeline:p1",
      content: "deploy payments service to production",
      corpus: "resources",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p1" },
    });

    const results = await provider.search("deploy payments", {
      corpus: "resources",
      accountId: "acc1",
      k: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe("pipeline:p1");
    expect(results[0]!.corpus).toBe("resources");
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("updates existing item on re-index", async () => {
    await provider.index({
      id: "pipeline:p2",
      content: "original content",
      corpus: "resources",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p2" },
    });
    await provider.index({
      id: "pipeline:p2",
      content: "updated canary rollout pipeline",
      corpus: "resources",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p2" },
    });

    const results = await provider.search("canary rollout", {
      corpus: "resources",
      accountId: "acc1",
      k: 5,
    });
    expect(results.some(r => r.id === "pipeline:p2")).toBe(true);
  });

  it("isolates results by accountId", async () => {
    await provider.index({
      id: "pipeline:isolated",
      content: "isolated account pipeline xyz123",
      corpus: "resources",
      accountId: "acc-isolated",
      metadata: {},
    });

    const results = await provider.search("isolated account pipeline xyz123", {
      corpus: "resources",
      accountId: "acc-other",
    });
    expect(results.find(r => r.id === "pipeline:isolated")).toBeUndefined();
  });

  it("isolates results by corpus", async () => {
    await provider.index({
      id: "doc:d1",
      content: "how to configure canary deployment strategy",
      corpus: "docs",
      metadata: {},
    });

    const results = await provider.search("canary deployment strategy", {
      corpus: "resources",
      accountId: "acc1",
    });
    expect(results.find(r => r.id === "doc:d1")).toBeUndefined();
  });

  it("searches all corpora when corpus=all", async () => {
    await provider.index({
      id: "pipeline:all-test",
      content: "unique cross corpus test pipeline deployment",
      corpus: "resources",
      accountId: "acc-all",
      metadata: { resource_type: "pipeline" },
    });
    await provider.index({
      id: "doc:all-test",
      content: "unique cross corpus test documentation deployment",
      corpus: "docs",
      metadata: {},
    });

    const results = await provider.search("unique cross corpus test", {
      corpus: "all",
      accountId: "acc-all",
      k: 20,
    });
    const ids = results.map(r => r.id);
    expect(ids).toContain("pipeline:all-test");
    expect(ids).toContain("doc:all-test");
  });

  it("does not throw on empty id or content", async () => {
    await expect(provider.index({ id: "", content: "", corpus: "resources", metadata: {} })).resolves.toBeUndefined();
  });
});
