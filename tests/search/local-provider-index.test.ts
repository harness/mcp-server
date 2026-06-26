import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

const mockExtractor = vi.hoisted(() => vi.fn(async () => ({
  data: new Float32Array(384).fill(0.5),
})));

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(async () => mockExtractor),
  env: { cacheDir: "" },
}));

describe("LocalSearchProvider index behavior", () => {
  let provider: LocalSearchProvider;

  beforeEach(async () => {
    mockExtractor.mockClear();
    provider = new LocalSearchProvider({ cacheDir: "/tmp/test-hf-cache" });
    await provider.initialize();
    expect(provider.isAvailable()).toBe(true);
  });

  it("skips re-embedding when indexed content is unchanged", async () => {
    const item = {
      id: "pipeline:p1",
      content: "deploy payments service",
      corpus: "entities" as const,
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p1" },
    };

    await provider.index(item);
    await provider.index(item);

    expect(mockExtractor).toHaveBeenCalledTimes(1);
  });

  it("re-embeds when content changes for the same id", async () => {
    await provider.index({
      id: "pipeline:p2",
      content: "original pipeline content",
      corpus: "entities",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p2" },
    });
    await provider.index({
      id: "pipeline:p2",
      content: "updated canary rollout pipeline",
      corpus: "entities",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p2" },
    });

    expect(mockExtractor).toHaveBeenCalledTimes(2);
  });

  it("evicts the LRU entities account bucket when account key limit is exceeded", async () => {
    for (let i = 0; i < 33; i++) {
      await provider.index({
        id: `pipeline:p${i}`,
        content: `pipeline content ${i}`,
        corpus: "entities",
        accountId: `acc-${i}`,
        metadata: { resource_type: "pipeline", identifier: `p${i}` },
      });
    }

    const firstAccountResults = await provider.search("pipeline content 0", {
      corpus: "entities",
      accountId: "acc-0",
      k: 5,
    });
    const lastAccountResults = await provider.search("pipeline content 32", {
      corpus: "entities",
      accountId: "acc-32",
      k: 5,
    });

    expect(firstAccountResults).toHaveLength(0);
    expect(lastAccountResults.some((r) => r.id === "pipeline:p32")).toBe(true);
  });
});
