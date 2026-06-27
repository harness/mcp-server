import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

type TestableProvider = LocalSearchProvider & {
  available: boolean;
  embed: (text: string) => Promise<Float32Array>;
  store: Map<string, unknown[]>;
};

function makeTestProvider(): TestableProvider {
  const provider = new LocalSearchProvider() as TestableProvider;
  provider.available = true;
  provider.embed = async () => new Float32Array(384).fill(0.1);
  provider.store = new Map();
  return provider;
}

describe("LocalSearchProvider entity bucket eviction", () => {
  let provider: TestableProvider;

  beforeEach(() => {
    provider = makeTestProvider();
  });

  afterEach(() => {
    provider.evictExpired();
  });

  it("evicts the least-recently-used entities:<account> bucket when account key limit is exceeded", async () => {
    for (let i = 0; i < 33; i++) {
      await provider.index({
        id: `pipeline:acc-${i}`,
        content: `pipeline for account ${i}`,
        corpus: "entities",
        accountId: `acc-${i}`,
        metadata: { resource_type: "pipeline", identifier: `acc-${i}` },
      });
    }

    const store = (provider as unknown as { store: Map<string, unknown[]> }).store;
    const accountKeys = [...store.keys()].filter((key) => key.startsWith("entities:acc-"));
    expect(accountKeys).toHaveLength(32);
    expect(store.has("entities:acc-0")).toBe(false);
    expect(store.has("entities:acc-32")).toBe(true);
  });

  it("does not evict static global corpora keys when adding entity buckets", async () => {
    await provider.index({
      id: "schema:pipeline",
      content: "pipeline schema",
      corpus: "knowledge",
      ttlMs: 0,
      metadata: { type: "schema" },
    });

    for (let i = 0; i < 33; i++) {
      await provider.index({
        id: `pipeline:acc-${i}`,
        content: `pipeline for account ${i}`,
        corpus: "entities",
        accountId: `acc-${i}`,
        metadata: { resource_type: "pipeline", identifier: `acc-${i}` },
      });
    }

    const store = (provider as unknown as { store: Map<string, unknown[]> }).store;
    expect(store.has("knowledge:global")).toBe(true);
  });
});
