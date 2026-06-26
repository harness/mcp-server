import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEmbed = vi.fn(async (text: string) => {
  const vec = new Float32Array(384);
  for (let i = 0; i < vec.length; i++) {
    vec[i] = (text.charCodeAt(i % text.length) % 97) / 100;
  }
  return vec;
});

vi.mock("@huggingface/transformers", () => ({
  env: { cacheDir: "" },
  pipeline: vi.fn().mockResolvedValue((text: string) => ({
    data: mockEmbed(text),
  })),
}));

import { LocalSearchProvider } from "../../src/search/local-provider.js";

describe("LocalSearchProvider (mocked embeddings)", () => {
  let provider: LocalSearchProvider;

  beforeEach(async () => {
    provider = new LocalSearchProvider();
    await provider.initialize();
    mockEmbed.mockClear();
  });

  afterEach(() => {
    provider.evictExpired();
  });

  it("evictExpired removes items past their TTL", async () => {
    await provider.index({
      id: "pipeline:expired",
      content: "short lived pipeline item",
      corpus: "resources",
      accountId: "acc-ttl",
      metadata: { resource_type: "pipeline" },
      ttlMs: 1,
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    provider.evictExpired();

    const results = await provider.search("short lived pipeline", {
      corpus: "resources",
      accountId: "acc-ttl",
    });
    expect(results.find((r) => r.id === "pipeline:expired")).toBeUndefined();
  });

  it("keeps permanent items when ttlMs is 0", async () => {
    await provider.index({
      id: "resource-def:pipeline",
      content: "permanent pipeline definition",
      corpus: "mcp_resources",
      metadata: { resource_type: "pipeline" },
      ttlMs: 0,
    });

    provider.evictExpired();

    const results = await provider.search("permanent pipeline definition", {
      corpus: "mcp_resources",
    });
    expect(results.some((r) => r.id === "resource-def:pipeline")).toBe(true);
  });

  it("enforces per-key cap by evicting soonest-expiring items", async () => {
    const accountId = "acc-cap";

    for (let i = 0; i < 5000; i++) {
      await provider.index({
        id: `pipeline:cap-${i}`,
        content: `pipeline cap test item number ${i}`,
        corpus: "resources",
        accountId,
        metadata: { resource_type: "pipeline", identifier: `cap-${i}` },
        ttlMs: 60_000 + i,
      });
    }

    await provider.index({
      id: "pipeline:cap-new",
      content: "pipeline cap test newest item",
      corpus: "resources",
      accountId,
      metadata: { resource_type: "pipeline", identifier: "cap-new" },
      ttlMs: 120_000,
    });

    const results = await provider.search("pipeline cap test", {
      corpus: "resources",
      accountId,
      k: 5001,
    });
    expect(results.length).toBe(5000);
    expect(results.some((r) => r.id === "pipeline:cap-0")).toBe(false);
    expect(results.some((r) => r.id === "pipeline:cap-new")).toBe(true);
  }, 30_000);
});
