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
      text: () => Promise.resolve(""),
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
    it("strips trailing slash from baseUrl before calling the service", async () => {
      fetchSpy = mockFetch([{ ok: true }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: `${BASE_URL}/` });
      await p.initialize();
      expect(fetchSpy.mock.calls[0]![0]).toBe(`${BASE_URL}/v1/health`);
      vi.unstubAllGlobals();
    });

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
      fetchSpy = mockFetch([{ ok: true }, { ok: false, status: 500 }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "knowledge" });
      expect(results).toEqual([]);
    });

    it("forwards filters as query params to the hybrid endpoint", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("pipeline", {
        corpus: "entities",
        accountId: "acct-123",
        filters: { "metadata.resource_type": "pipeline", "metadata.identifier": "deploy" },
      });
      const searchCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/v1/hybrid"));
      expect(searchCall).toBeDefined();
      const url = String(searchCall![0]);
      expect(url).toContain("metadata.resource_type=pipeline");
      expect(url).toContain("metadata.identifier=deploy");
    });

    it("returns [] when the service response omits results", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "knowledge" });
      expect(results).toEqual([]);
    });

    it("drains the response body when search returns non-200", async () => {
      const textSpy = vi.fn().mockResolvedValue("upstream error");
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: textSpy })
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}), text: textSpy });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "knowledge" });
      expect(results).toEqual([]);
      expect(textSpy).toHaveBeenCalledOnce();
    });

    it("merges corpus=all hits by score and caps at k", async () => {
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => "" })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ id: "entities:low", content: "low", metadata: {}, score: 0.4 }],
            total_count: 1,
          }),
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ id: "knowledge:high", content: "high", metadata: {}, score: 0.95 }],
            total_count: 1,
          }),
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            results: [{ id: "docs:mid", content: "mid", metadata: {}, score: 0.7 }],
            total_count: 1,
          }),
          text: async () => "",
        });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "all", accountId: "acct-123", k: 2 });
      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe("knowledge:high");
      expect(results[1]!.id).toBe("docs:mid");
    });

    it("returns [] when the hybrid request throws", async () => {
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: async () => "" })
        .mockRejectedValueOnce(new Error("network down"));
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      const results = await p.search("test", { corpus: "knowledge" });
      expect(results).toEqual([]);
    });

    it("omits tenant_id for entities corpus when accountId is missing", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { results: [], total_count: 0 } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.search("pipeline", { corpus: "entities" });
      const searchCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/v1/hybrid"));
      expect(String(searchCall![0])).not.toContain("tenant_id");
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

    it("does not throw when service returns non-200", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: false, status: 503 }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await expect(p.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} })).resolves.toBeUndefined();
    });

    it("drains the response body when index returns non-200", async () => {
      const textSpy = vi.fn().mockResolvedValue("upstream error");
      fetchSpy = vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}), text: textSpy })
        .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}), text: textSpy });
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} });
      expect(textSpy).toHaveBeenCalledOnce();
    });

    it("is a no-op when the provider is unavailable", async () => {
      fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.index({ id: "x", content: "y", corpus: "knowledge", metadata: {} });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("posts to mcp_docs collection for docs corpus", async () => {
      fetchSpy = mockFetch([{ ok: true }, { ok: true, body: { id: "doc:1", success: true } }]);
      vi.stubGlobal("fetch", fetchSpy);
      const p = new RemoteSearchProvider({ baseUrl: BASE_URL });
      await p.initialize();
      await p.index({
        id: "doc:1",
        content: "Harness docs",
        corpus: "docs",
        metadata: { type: "doc" },
      });
      const ingestCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes("/v1/ingest"));
      const body = JSON.parse(ingestCall![1].body as string);
      expect(body.collection_name).toBe("mcp_docs");
      expect(body.tenant_id).toBeUndefined();
    });
  });

  describe("evictExpired", () => {
    it("is a no-op", () => {
      expect(() => provider.evictExpired()).not.toThrow();
    });
  });
});
