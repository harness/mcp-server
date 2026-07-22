import { describe, it, expect, beforeAll } from "vitest";
import { LocalSearchProvider } from "../../src/search/local-provider.js";

// These tests download the model on first run (~23MB); subsequent runs use cache.
// CI has no model cache, so init fetches from huggingface.co live. When the hub is
// unreachable or rate-limits (429), skip rather than fail — that is an environment
// outage, not a code regression. A genuine logic break (model loads but a query
// returns wrong results) still fails, because we only skip when initialize() could
// not fetch the model at all.
const NETWORK_INIT_FAILURE =
  /\b(429|too many requests|fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|load file|getaddrinfo|socket)\b/i;

// The embedding backend (@huggingface/transformers) is an optionalDependency. When it
// isn't installed (e.g. optional deps skipped in CI/local), initialize() fails with a
// module-resolution error rather than a network error. That is an environment condition,
// not a code regression, so skip rather than fail — same policy as a HuggingFace outage.
const MISSING_OPTIONAL_DEP =
  /Cannot find (?:package|module) ['"]@huggingface\/transformers['"]/i;

describe("LocalSearchProvider", () => {
  let provider: LocalSearchProvider;
  let skipReason: string | undefined;

  beforeAll(async () => {
    provider = new LocalSearchProvider();
    await provider.initialize();
    if (!provider.isAvailable()) {
      const initError = provider.getInitError() ?? "unknown initialization error";
      if (NETWORK_INIT_FAILURE.test(initError)) {
        skipReason = `embedding model unavailable (offline/rate-limited): ${initError}`;
      } else if (MISSING_OPTIONAL_DEP.test(initError)) {
        skipReason = `embedding backend not installed (optional dependency): ${initError}`;
      } else {
        // Not a network problem — surface it as a real failure below.
        throw new Error(`LocalSearchProvider failed to initialize: ${initError}`);
      }
    }
  }, 60_000); // model download can take a moment

  // Guard placed at the top of every test: bail out (as a pass) when the model
  // could not be fetched, so a HuggingFace outage never reds the build.
  function requireModel(ctx: { skip: () => void }): boolean {
    if (skipReason) {
      console.warn(`[local-provider.test] skipping: ${skipReason}`);
      ctx.skip();
      return false;
    }
    return true;
  }

  it("is available after initialize", (ctx) => {
    if (!requireModel(ctx)) return;
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns empty results for empty index", async (ctx) => {
    if (!requireModel(ctx)) return;
    const results = await provider.search("anything", { corpus: "entities", accountId: "acc-empty" });
    expect(results).toEqual([]);
  });

  it("returns indexed item in search results", async (ctx) => {
    if (!requireModel(ctx)) return;
    await provider.index({
      id: "pipeline:p1",
      content: "deploy payments service to production",
      corpus: "entities",
      accountId: "acc1",
      metadata: { resource_type: "pipeline", identifier: "p1" },
    });

    const results = await provider.search("deploy payments", {
      corpus: "entities",
      accountId: "acc1",
      k: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe("pipeline:p1");
    expect(results[0]!.corpus).toBe("entities");
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("updates existing item on re-index", async (ctx) => {
    if (!requireModel(ctx)) return;
    await provider.index({
      id: "pipeline:p2",
      content: "original content",
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

    const results = await provider.search("canary rollout", {
      corpus: "entities",
      accountId: "acc1",
      k: 5,
    });
    expect(results.some(r => r.id === "pipeline:p2")).toBe(true);
  });

  it("isolates results by accountId", async (ctx) => {
    if (!requireModel(ctx)) return;
    await provider.index({
      id: "pipeline:isolated",
      content: "isolated account pipeline xyz123",
      corpus: "entities",
      accountId: "acc-isolated",
      metadata: {},
    });

    const results = await provider.search("isolated account pipeline xyz123", {
      corpus: "entities",
      accountId: "acc-other",
    });
    expect(results.find(r => r.id === "pipeline:isolated")).toBeUndefined();
  });

  it("isolates results by corpus", async (ctx) => {
    if (!requireModel(ctx)) return;
    await provider.index({
      id: "doc:d1",
      content: "how to configure canary deployment strategy",
      corpus: "docs",
      metadata: {},
    });

    const results = await provider.search("canary deployment strategy", {
      corpus: "entities",
      accountId: "acc1",
    });
    expect(results.find(r => r.id === "doc:d1")).toBeUndefined();
  });

  it("searches all corpora when corpus=all", async (ctx) => {
    if (!requireModel(ctx)) return;
    await provider.index({
      id: "pipeline:all-test",
      content: "unique cross corpus test pipeline deployment",
      corpus: "entities",
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

  it("does not throw on empty id or content", async (ctx) => {
    if (!requireModel(ctx)) return;
    await expect(provider.index({ id: "", content: "", corpus: "entities", metadata: {} })).resolves.toBeUndefined();
  });
});
