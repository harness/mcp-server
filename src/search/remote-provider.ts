import type { SearchProvider, SearchResult, SearchOptions, IndexableItem, SearchCorpus } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("remote-search-provider");
const CORPORA: SearchCorpus[] = ["entities", "docs", "knowledge"];

/**
 * Each corpus maps to its own collection in the search service.
 * Static corpora (docs, knowledge) are shared across all tenants — no tenant_id filter needed.
 * Entity corpus is per-account — tenant_id scopes results to the requesting account.
 */
const STATIC_CORPORA = new Set<SearchCorpus>(["docs", "knowledge"]);

/** Collection name in the search service for each corpus. */
const CORPUS_COLLECTION: Record<SearchCorpus, string> = {
  knowledge: "mcp_knowledge",
  docs: "mcp_docs",
  entities: "mcp_entities",
};

export interface RemoteSearchProviderOptions {
  baseUrl: string;
  /**
   * Extra headers sent with every request. Supports any auth scheme:
   *   { "Authorization": "Bearer <token>" }           — standard bearer
   *   { "x-api-key": "key" }                          — API key header
   *   { "x-harness-token": "svc", "x-tenant": "..." } — internal service mesh
   */
  headers?: Record<string, string>;
  timeoutMs?: number;
}

interface ServiceSearchResult {
  id: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
}

interface ServiceSearchResponse {
  results: ServiceSearchResult[];
  total_count: number;
  query?: string;
}

interface ServiceIngestRequest {
  content: string;
  metadata: Record<string, string>;
  tenant_id?: string;
  document_id?: string;
  collection_name?: string;
}

export class RemoteSearchProvider implements SearchProvider {
  private available = false;
  private initError: string | undefined;
  private readonly baseUrl: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: RemoteSearchProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.extraHeaders = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async initialize(): Promise<void> {
    try {
      const res = await this.doFetch("/v1/health");
      if (res.ok) {
        this.available = true;
        log.info("RemoteSearchProvider initialized", { baseUrl: this.baseUrl });
      } else {
        this.initError = `Health check returned HTTP ${res.status}`;
        log.error("RemoteSearchProvider health check failed", { status: res.status });
      }
    } catch (err) {
      this.initError = String(err);
      log.error("RemoteSearchProvider initialization failed", { error: this.initError });
    }
  }

  getInitError(): string | undefined {
    return this.initError;
  }

  isAvailable(): boolean {
    return this.available;
  }

  evictExpired(): void {
    // The search service owns TTL — nothing to do locally
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.available) return [];
    try {
      const { corpus = "all", accountId, k = 10 } = options;
      const corpora: SearchCorpus[] = corpus === "all" ? CORPORA : [corpus as SearchCorpus];

      // One request per corpus — each targets its own collection.
      // Use hybrid search (vector + BM25); the service gracefully degrades to
      // vector-only when the collection is not hybrid-capable.
      // Static corpora omit tenant_id (whole collection is shared).
      // Entities corpus passes accountId as tenant_id for per-account scoping.
      const allResults = await Promise.all(
        corpora.map(async (c) => {
          const params = new URLSearchParams({
            q: query,
            k: String(k),
            collection_name: CORPUS_COLLECTION[c],
          });
          if (!STATIC_CORPORA.has(c) && accountId) {
            params.set("tenant_id", accountId);
          }
          const res = await this.doFetch(`/v1/hybrid?${params}`);
          if (!res.ok) {
            log.warn("Remote search request failed", { status: res.status, corpus: c });
            return [] as SearchResult[];
          }
          const body = await res.json() as ServiceSearchResponse;
          return body.results.map(r => ({
            id: r.id,
            content: r.content,
            score: r.score,
            corpus: c,
            metadata: r.metadata,
          }));
        })
      );

      return allResults
        .flat()
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    } catch (err) {
      log.error("RemoteSearchProvider search failed", { error: String(err) });
      return [];
    }
  }

  async index(item: IndexableItem): Promise<void> {
    if (!this.available) return;
    try {
      const body: ServiceIngestRequest = {
        content: item.content,
        metadata: {
          ...item.metadata,
          ...(item.ttlMs !== undefined ? { ttl_ms: String(item.ttlMs) } : {}),
        },
        collection_name: CORPUS_COLLECTION[item.corpus],
        document_id: item.id,
        // Entities are per-account; static corpora have no tenant scoping.
        ...(!STATIC_CORPORA.has(item.corpus) && item.accountId
          ? { tenant_id: item.accountId }
          : {}),
      };

      const res = await this.doFetch("/v1/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        log.warn("Remote index request failed", { id: item.id, status: res.status });
      }
    } catch (err) {
      log.error("RemoteSearchProvider index failed", { id: item.id, error: String(err) });
    }
  }

  private doFetch(pathOrUrl: string, init?: RequestInit): Promise<Response> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    const headers: Record<string, string> = {
      ...this.extraHeaders,
      ...(init?.headers as Record<string, string> ?? {}),
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    return fetch(url, { ...init, headers, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }
}
