import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

const mockExtractor = vi.hoisted(() => vi.fn(async () => ({
  data: new Float32Array(384).fill(0.5),
})));

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(async () => mockExtractor),
  env: { cacheDir: "" },
}));

describe("LocalSearchProvider eviction and TTL", () => {
  let provider: LocalSearchProvider;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockExtractor.mockClear();
    provider = new LocalSearchProvider({ cacheDir: "/tmp/test-hf-cache" });
    await provider.initialize();
    expect(provider.isAvailable()).toBe(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("evicts TTL-backed entities items after expiry", async () => {
    await provider.index({
      id: "pipeline:expiring",
      content: "short-lived pipeline",
      corpus: "entities",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "expiring" },
    });

    vi.advanceTimersByTime(31 * 60 * 1000);
    provider.evictExpired();

    const results = await provider.search("short-lived pipeline", {
      corpus: "entities",
      accountId: "acc1",
      k: 5,
    });
    expect(results).toHaveLength(0);
  });

  it("keeps permanent entities items when ttlMs is 0", async () => {
    await provider.index({
      id: "pipeline:permanent",
      content: "permanent pipeline index",
      corpus: "entities",
      accountId: "acc1",
      ttlMs: 0,
      metadata: { resource_type: "pipeline", identifier: "permanent" },
    });

    vi.advanceTimersByTime(31 * 60 * 1000);
    provider.evictExpired();

    const results = await provider.search("permanent pipeline index", {
      corpus: "entities",
      accountId: "acc1",
      k: 5,
    });
    expect(results.some((r) => r.id === "pipeline:permanent")).toBe(true);
  });

  it("merges global knowledge items when searching with an accountId", async () => {
    await provider.index({
      id: "resource-def:connector",
      content: "connector resource definition",
      corpus: "knowledge",
      ttlMs: 0,
      metadata: { type: "resource_definition", resource_type: "connector" },
    });

    const results = await provider.search("connector resource definition", {
      corpus: "knowledge",
      accountId: "acc-tenant",
      k: 5,
    });

    expect(results.some((r) => r.id === "resource-def:connector")).toBe(true);
  });
});
