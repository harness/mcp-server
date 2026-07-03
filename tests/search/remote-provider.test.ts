import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RemoteSearchProvider } from "../../src/search/remote-provider.js";

const BASE_URL = "http://search-svc:8080";

function mockFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const resp = responses[call++ % responses.length]!;
    return Promise.resolve({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: () => Promise.resolve(resp.body ?? {}),
      text: () => Promise.resolve(typeof resp.body === "string" ? resp.body : ""),
    });
  });
}

describe("RemoteSearchProvider", () => {
  let provider: RemoteSearchProvider;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new RemoteSearchProvider({ baseUrl: BASE_URL, timeoutMs: 1000 });
  });

  describe("initialize", () => {
    it("marks available when health check returns 200", async () => {
      fetchSpy = mockFetch([{ ok: true }]);
      vi.stubGlobal("fetch", fetchSpy);
      await provider.initialize();
      expect(provider.isAvailable()).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/v1/health"),
        expect.anything(),
      );
      vi.unstubAllGlobals();
    });

    it("marks unavailable when health check fails", async () => {
      fetchSpy = mockFetch([{ ok: false, status: 503 }]);
      vi.stubGlobal("fetch", fetchSpy);
      await provider.initialize();
      expect(provider.isAvailable()).toBe(false);
      expect(provider.getInitError()).toMatch("503");
      vi.unstubAllGlobals();
    });

    it("marks unavailable on network error", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      await provider.initialize();
      expect(provider.isAvailable()).toBe(false);
      expect(provider.getInitError()).toMatch("ECONNREFUSED");
      vi.unstubAllGlobals();
    });
  });

  describe("search", () => {
    const serviceResult = {
      results: [
        { id: "pipeline:p1", content: "deploy payments", metadata: { resource_type: "pipeline", identifier: "p1" }, score: 0.9 },
      ],
      total_count: 1,
      query: "deploy",
    };

    beforeEach(async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: serviceResult }]);
      vi.stubGlobal("fetch", fetchSpy);
      await provider.initialize();
    });

    afterEach(() => vi.unstubAllGlobals());

    it("returns [] when unavailable", async () => {
      const unavailable = new RemoteSearchProvider({ baseUrl: BASE_URL });
      const results = await unavailable.search("anything");
      expect(results).toEqual([]);
    });

    it("sends collection_name and tenant_id for entities corpus", async () => {
      await provider.search("deploy", { corpus: "entities", accountId: "acct-123", k: 5 });
      const calls = fetchSpy.mock.calls.map(c => String(c[0]));
      const searchCall = calls.find(u => u.includes("/v1/hybrid"));
      expect(searchCall).toBeDefined();
      expect(searchCall).toContain("q=deploy");
      expect(searchCall).toContain("tenant_id=acct-123");
      expect(searchCall).toContain("collection_name=mcp_entities");
      expect(searchCall).toContain("k=5");
    });

    it("omits tenant_id for static corpora, uses correct collection", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("schema", { corpus: "knowledge", accountId: "acct-123" });
      const calls = fetchSpy.mock.calls.map(c => String(c[0]));
      const searchCall = calls.find(u => u.includes("/v1/hybrid"));
      expect(searchCall).toContain("collection_name=mcp_knowledge");
      expect(searchCall).not.toContain("tenant_id");
    });

    it("sends bearer token when Authorization header provided", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL, headers: { "Authorization": "Bearer my-token" } });
      await p.initialize();
      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe("Bearer my-token");
    });

    it("sends custom service-to-service headers as-is", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL, headers: { "x-harness-token": "svc-token", "x-api-key": "key" } });
      await p.initialize();
      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
      expect(headers["x-harness-token"]).toBe("svc-token");
      expect(headers["x-api-key"]).toBe("key");
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("sends no auth headers when none configured", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
      expect(headers["Authorization"]).toBeUndefined();
    });

    it("maps service results to SearchResult shape", async () => {
      const results = await provider.search("deploy", { corpus: "entities", accountId: "acct-123" });
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        id: "pipeline:p1",
        content: "deploy payments",
        score: 0.9,
        corpus: "entities",
      });
    });

    it("fans out across all corpora for corpus=all", async () => {
      fetchSpy = mockFetch([
        { ok: true },
        { ok: true, body: { results: [], total_count: 0 } },
        { ok: true, body: { results: [], total_count: 0 } },
        { ok: true, body: { results: [], total_count: 0 } },
      ]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("pipeline", { corpus: "all", accountId: "acct-123" });
      const searchCalls = fetchSpy.mock.calls.filter(c => String(c[0]).includes("/v1/hybrid"));
      expect(searchCalls).toHaveLength(3);
      const urls = searchCalls.map(c => String(c[0]));
      expect(urls.some(u => u.includes("collection_name=mcp_entities"))).toBe(true);
      expect(urls.some(u => u.includes("collection_name=mcp_knowledge"))).toBe(true);
      expect(urls.some(u => u.includes("collection_name=mcp_docs"))).toBe(true);
    });

    it("returns [] and does not throw when service returns non-200", async () => {
      const textSpy = vi.fn().mockResolvedValue("upstream error");
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: textSpy })
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: textSpy });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "knowledge" });
      expect(results).toEqual([]);
      expect(textSpy).toHaveBeenCalled();
    });

    it("forwards filters as query params to the hybrid endpoint", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("deploy", {
        corpus: "entities",
        accountId: "acct-123",
        filters: { "metadata.resource_type": "pipeline", org_id: "default" },
      });
      const searchCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/hybrid"));
      expect(searchCall).toBeDefined();
      const url = String(searchCall![0]);
      expect(url).toContain("metadata.resource_type=pipeline");
      expect(url).toContain("org_id=default");
    });

    it("returns [] when the service body omits results", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("deploy", { corpus: "entities", accountId: "acct-123" });
      expect(results).toEqual([]);
    });

    it("returns [] when the service body has null results", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: null, total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("deploy", { corpus: "entities", accountId: "acct-123" });
      expect(results).toEqual([]);
    });

    it("strips trailing slash from baseUrl", async () => {
      fetchSpy = mockFetch([{ ok: true }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: `${BASE_URL}/` });
      await p.initialize();
      expect(fetchSpy.mock.calls[0]![0]).toBe(`${BASE_URL}/v1/health`);
      vi.unstubAllGlobals();
    });

    it("omits tenant_id for docs corpus", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("readme", { corpus: "docs", accountId: "acct-123" });
      const searchCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/hybrid"));
      expect(String(searchCall![0])).toContain("collection_name=mcp_docs");
      expect(String(searchCall![0])).not.toContain("tenant_id");
      vi.unstubAllGlobals();
    });

    it("omits tenant_id for entities corpus when accountId is missing", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("deploy", { corpus: "entities" });
      const searchCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/hybrid"));
      expect(String(searchCall![0])).not.toContain("tenant_id");
      vi.unstubAllGlobals();
    });

    it("returns partial results when one corpus fails in corpus=all", async () => {
      const textSpy = vi.fn().mockResolvedValue("upstream error");
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            results: [{ id: "entities:ok", content: "ok", metadata: {}, score: 0.9 }],
            total_count: 1,
          }),
          text: () => Promise.resolve(""),
        })
        .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}), text: textSpy })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ results: [], total_count: 0 }), text: () => Promise.resolve("") });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("pipeline", { corpus: "all", accountId: "acct-123" });
      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("entities:ok");
      expect(textSpy).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("returns [] on search network error without throwing", async () => {
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") })
        .mockRejectedValueOnce(new Error("socket hang up"));
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await expect(p.search("deploy", { corpus: "entities", accountId: "acct-123" })).resolves.toEqual([]);
      vi.unstubAllGlobals();
    });

    it("merges corpus results and applies the global k limit", async () => {
      const makeResult = (id: string, score: number, corpus: string) => ({
        id,
        content: id,
        metadata: {},
        score,
        corpus,
      });
      fetchSpy = mockFetch([
        { ok: true },
        {
          ok: true,
          body: {
            results: [makeResult("entities:high", 0.95, "entities"), makeResult("entities:low", 0.5, "entities")],
            total_count: 2,
          },
        },
        {
          ok: true,
          body: {
            results: [makeResult("knowledge:mid", 0.8, "knowledge")],
            total_count: 1,
          },
        },
        { ok: true, body: { results: [], total_count: 0 } },
      ]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("pipeline", { corpus: "all", accountId: "acct-123", k: 2 });
      expect(results).toHaveLength(2);
      expect(results.map(r => r.id)).toEqual(["entities:high", "knowledge:mid"]);
    });
  });

  describe("index", () => {
    beforeEach(async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { id: "pipeline:p1", success: true } }]);
      vi.stubGlobal("fetch", fetchSpy);
      await provider.initialize();
    });

    afterEach(() => vi.unstubAllGlobals());

    it("posts to mcp_entities collection with tenant_id for entities", async () => {
      await provider.index({
        id: "pipeline:p1",
        content: "deploy payments",
        corpus: "entities",
        accountId: "acct-123",
        metadata: { resource_type: "pipeline" },
      });
      const ingestCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/ingest"));
      expect(ingestCall).toBeDefined();
      const body = JSON.parse(ingestCall![1].body as string);
      expect(body.tenant_id).toBe("acct-123");
      expect(body.collection_name).toBe("mcp_entities");
      expect(body.document_id).toBe("pipeline:p1");
      expect(body.metadata.corpus).toBeUndefined();
    });

    it("posts to mcp_knowledge collection with no tenant_id for knowledge corpus", async () => {
      await provider.index({
        id: "schema:pipeline",
        content: "pipeline schema",
        corpus: "knowledge",
        metadata: { resource_type: "pipeline" },
        ttlMs: 0,
      });
      const ingestCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/ingest"));
      const body = JSON.parse(ingestCall![1].body as string);
      expect(body.tenant_id).toBeUndefined();
      expect(body.collection_name).toBe("mcp_knowledge");
    });

    it("skips index when unavailable", async () => {
      const unavailable = new RemoteSearchProvider({ baseUrl: BASE_URL });
      const ingestCallsBefore = fetchSpy.mock.calls.filter(c => String(c[0]).includes("/v1/ingest")).length;
      await unavailable.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} });
      const ingestCallsAfter = fetchSpy.mock.calls.filter(c => String(c[0]).includes("/v1/ingest")).length;
      expect(ingestCallsAfter).toBe(ingestCallsBefore);
    });

    it("includes ttl_ms in index metadata when ttlMs is set", async () => {
      await provider.index({
        id: "pipeline:p1",
        content: "deploy payments",
        corpus: "entities",
        accountId: "acct-123",
        metadata: { resource_type: "pipeline" },
        ttlMs: 3_600_000,
      });
      const ingestCall = fetchSpy.mock.calls.find(c => String(c[0]).includes("/v1/ingest"));
      const body = JSON.parse(ingestCall![1].body as string);
      expect(body.metadata.ttl_ms).toBe("3600000");
    });

    it("does not throw on index network error", async () => {
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("") })
        .mockRejectedValueOnce(new Error("ECONNRESET"));
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await expect(p.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} })).resolves.toBeUndefined();
      vi.unstubAllGlobals();
    });

    it("does not throw when service returns non-200", async () => {
      const textSpy = vi.fn().mockResolvedValue("service unavailable");
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}), text: textSpy })
        .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}), text: textSpy });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await expect(p.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} })).resolves.toBeUndefined();
      expect(textSpy).toHaveBeenCalled();
    });
  });

  describe("evictExpired", () => {
    it("is a no-op", () => {
      expect(() => provider.evictExpired()).not.toThrow();
    });
  });
});
