import type { SearchProvider, SearchResult, SearchOptions, IndexableItem, SearchCorpus } from "./types.js";
import { CORPUS_DEFAULT_TTL_MS } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("local-provider");
const DEFAULT_HF_CACHE_DIR = "/tmp/hf-cache";
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;
const CORPORA: SearchCorpus[] = ["resources", "docs", "mcp_resources"];
// Per-key cap — permanent corpora (mcp_resources, docs) are exempt since they're bounded by definition
const MAX_ITEMS_PER_KEY = 5000;

interface StoredItem {
  id: string;
  content: string;
  corpus: SearchCorpus;
  metadata: Record<string, string>;
  embedding: Float32Array;
  /** Unix ms timestamp when this item expires. undefined = never expires. */
  expiresAt: number | undefined;
}

type EmbedFn = (text: string) => Promise<Float32Array>;

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function resolveExpiresAt(item: IndexableItem, now: number): number | undefined {
  // Explicit ttlMs=0 means permanent, overriding corpus default
  if (item.ttlMs === 0) return undefined;
  const ttl = item.ttlMs ?? CORPUS_DEFAULT_TTL_MS[item.corpus];
  return ttl !== undefined ? now + ttl : undefined;
}

export interface LocalSearchProviderOptions {
  cacheDir?: string;
}

export class LocalSearchProvider implements SearchProvider {
  private available = false;
  private embed: EmbedFn | null = null;
  private readonly cacheDir: string;
  // key: `${corpus}:${accountId ?? "global"}`
  private store = new Map<string, StoredItem[]>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: LocalSearchProviderOptions = {}) {
    this.cacheDir = options.cacheDir ?? DEFAULT_HF_CACHE_DIR;
  }

  async initialize(): Promise<void> {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = this.cacheDir;
      const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "fp32" });
      this.embed = async (text: string): Promise<Float32Array> => {
        const out = await extractor(text, { pooling: "mean", normalize: true });
        const raw = out.data;
        return raw instanceof Float32Array ? raw : new Float32Array(raw as ArrayLike<number>);
      };
      this.available = true;
      // Run eviction every 10 minutes
      this.evictionTimer = setInterval(() => this.evictExpired(), 10 * 60 * 1000);
      log.info("LocalSearchProvider initialized", { model: EMBEDDING_MODEL, dim: EMBEDDING_DIM, cacheDir: this.cacheDir });
    } catch (err) {
      log.error("LocalSearchProvider initialization failed", { error: String(err) });
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [key, items] of this.store) {
      const before = items.length;
      const fresh = items.filter(i => i.expiresAt === undefined || i.expiresAt > now);
      if (fresh.length !== before) {
        this.store.set(key, fresh);
        evicted += before - fresh.length;
      }
    }
    if (evicted > 0) log.info(`Evicted ${evicted} expired items`);
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.available || !this.embed) return [];
    try {
      const { corpus = "all", accountId, k = 10 } = options;
      const now = Date.now();
      const queryEmbedding = await this.embed(query);
      const corpora = corpus === "all" ? CORPORA : [corpus as SearchCorpus];
      const scored: (SearchResult & { _score: number })[] = [];

      const seen = new Set<string>();
      for (const c of corpora) {
        // Include account-specific items + global items (accountId=undefined)
        const keys = accountId ? [storeKey(c, accountId), storeKey(c, undefined)] : [storeKey(c, undefined)];
        for (const key of keys) {
          const items = this.store.get(key) ?? [];
          for (const item of items) {
            if (seen.has(item.id)) continue;
            // Skip expired items (lazy eviction during search)
            if (item.expiresAt !== undefined && item.expiresAt <= now) continue;
            seen.add(item.id);
            const score = cosineSimilarity(queryEmbedding, item.embedding);
            scored.push({ id: item.id, content: item.content, score, corpus: c, metadata: item.metadata, _score: score });
          }
        }
      }

      return scored
        .sort((a, b) => b._score - a._score)
        .slice(0, k)
        .map(({ _score: _s, ...r }) => r);
    } catch (err) {
      log.error("LocalSearchProvider search failed", { error: String(err) });
      return [];
    }
  }

  async index(item: IndexableItem): Promise<void> {
    if (!this.available || !this.embed) return;
    try {
      if (!item.id || !item.content) return;
      const key = storeKey(item.corpus, item.accountId);
      if (!this.store.has(key)) this.store.set(key, []);
      const items = this.store.get(key)!;
      const existing = items.findIndex(i => i.id === item.id);
      // Only apply cap for non-permanent items (permanent corpora are bounded by definition)
      const expiresAt = resolveExpiresAt(item, Date.now());
      if (existing < 0 && expiresAt !== undefined && items.length >= MAX_ITEMS_PER_KEY) {
        // Evict the item with the nearest expiry (soonest to expire = least valuable)
        let minIdx = 0;
        for (let i = 1; i < items.length; i++) {
          const a = items[minIdx]!.expiresAt ?? Infinity;
          const b = items[i]!.expiresAt ?? Infinity;
          if (b < a) minIdx = i;
        }
        items.splice(minIdx, 1);
      }
      const embedding =
        existing >= 0 && items[existing]!.content === item.content
          ? items[existing]!.embedding
          : await this.embed(item.content);
      const stored: StoredItem = {
        id: item.id,
        content: item.content,
        corpus: item.corpus,
        metadata: item.metadata,
        embedding,
        expiresAt,
      };
      if (existing >= 0) {
        items[existing] = stored;
      } else {
        items.push(stored);
      }
    } catch (err) {
      log.error("LocalSearchProvider index failed", { id: item.id, error: String(err) });
    }
  }
}

function storeKey(corpus: SearchCorpus, accountId?: string): string {
  return `${corpus}:${accountId ?? "global"}`;
}
