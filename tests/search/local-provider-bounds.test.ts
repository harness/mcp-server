import { describe, it, expect, beforeEach } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

type StoredItem = {
  id: string;
  content: string;
  corpus: "entities" | "docs" | "knowledge";
  metadata: Record<string, string>;
  embedding: Float32Array;
  expiresAt: number | undefined;
};

type ProviderInternals = {
  available: boolean;
  embed: (text: string) => Promise<Float32Array>;
  store: Map<string, StoredItem[]>;
  keyLastAccessed: Map<string, number>;
};

function makeMockProvider(): LocalSearchProvider & ProviderInternals {
  const provider = new LocalSearchProvider();
  const internals = provider as unknown as ProviderInternals;
  internals.available = true;
  internals.embed = async () => new Float32Array(384).fill(0.1);
  internals.store = new Map();
  internals.keyLastAccessed = new Map();
  return provider as LocalSearchProvider & ProviderInternals;
}

function makeStoredItem(id: string): StoredItem {
  return {
    id,
    content: `content for ${id}`,
    corpus: "entities",
    metadata: {},
    embedding: new Float32Array(384).fill(0.1),
    expiresAt: undefined,
  };
}

describe("LocalSearchProvider entity bucket bounds", () => {
  let provider: LocalSearchProvider & ProviderInternals;

  beforeEach(() => {
    provider = makeMockProvider();
  });

  it("evicts the LRU entities: account bucket when a new account exceeds the account-key cap", async () => {
    for (let i = 0; i < 32; i++) {
      provider.store.set(`entities:acc${i}`, [makeStoredItem(`pipeline:acc${i}`)]);
      provider.keyLastAccessed.set(`entities:acc${i}`, i === 0 ? 1 : i * 1000);
    }

    await provider.index({
      id: "pipeline:new-account",
      content: "new account pipeline",
      corpus: "entities",
      accountId: "acc-new",
      metadata: {},
    });

    expect(provider.store.has("entities:acc0")).toBe(false);
    expect(provider.store.has("entities:acc-new")).toBe(true);
  });

  it("does not treat legacy resources: keys as entity account buckets during eviction", async () => {
    provider.store.set("resources:legacy", [makeStoredItem("pipeline:legacy")]);
    provider.keyLastAccessed.set("resources:legacy", 1);

    for (let i = 0; i < 32; i++) {
      provider.store.set(`entities:acc${i}`, [makeStoredItem(`pipeline:acc${i}`)]);
      provider.keyLastAccessed.set(`entities:acc${i}`, i * 1000 + 100);
    }

    await provider.index({
      id: "pipeline:overflow",
      content: "overflow pipeline",
      corpus: "entities",
      accountId: "acc-overflow",
      metadata: {},
    });

    expect(provider.store.has("resources:legacy")).toBe(true);
    expect(provider.store.has("entities:acc0")).toBe(false);
  });

  it("drops the oldest entities item when the per-account cap is reached", async () => {
    const items = Array.from({ length: 5000 }, (_, i) => makeStoredItem(`pipeline:p${i}`));
    provider.store.set("entities:acc1", items);

    await provider.index({
      id: "pipeline:new",
      content: "new pipeline",
      corpus: "entities",
      accountId: "acc1",
      metadata: {},
    });

    const stored = provider.store.get("entities:acc1")!;
    expect(stored).toHaveLength(5000);
    expect(stored.some((item) => item.id === "pipeline:p0")).toBe(false);
    expect(stored.some((item) => item.id === "pipeline:new")).toBe(true);
  });
});
