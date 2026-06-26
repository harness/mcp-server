import type { SearchProvider, SearchResult, SearchOptions, IndexableItem, SearchCorpus } from "./types.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("local-provider");
const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;
const CORPORA: SearchCorpus[] = ["resources", "docs", "mcp_resources"];
const MAX_ITEMS_PER_KEY = 5000;

interface StoredItem {
  id: string;
  content: string;
  corpus: SearchCorpus;
  metadata: Record<string, string>;
  embedding: Float32Array;
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

export class LocalSearchProvider implements SearchProvider {
  private available = false;
  private embed: EmbedFn | null = null;
  // key: `${corpus}:${accountId ?? "global"}`
  private store = new Map<string, StoredItem[]>();

  async initialize(): Promise<void> {
    try {
      const { pipeline, env } = await import("@huggingface/transformers");
      // Cache model in memory only, no filesystem write needed for local use
      env.cacheDir = "/tmp/hf-cache";
      const extractor = await pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "fp32" });
      this.embed = async (text: string): Promise<Float32Array> => {
        const out = await extractor(text, { pooling: "mean", normalize: true });
        const raw = out.data;
        return raw instanceof Float32Array ? raw : new Float32Array(raw as ArrayLike<number>);
      };
      this.available = true;
      log.info("LocalSearchProvider initialized", { model: EMBEDDING_MODEL, dim: EMBEDDING_DIM });
    } catch (err) {
      log.error("LocalSearchProvider initialization failed", { error: String(err) });
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.available || !this.embed) return [];
    try {
      const { corpus = "all", accountId, k = 10 } = options;
      const queryEmbedding = await this.embed(query);
      const corpora = corpus === "all" ? CORPORA : [corpus as SearchCorpus];
      const scored: (SearchResult & { _score: number })[] = [];

      const seen = new Set<string>();
      for (const c of corpora) {
        // Always include global (accountId=undefined) items; also include account-specific items
        const keys = accountId ? [storeKey(c, accountId), storeKey(c, undefined)] : [storeKey(c, undefined)];
        for (const key of keys) {
          const items = this.store.get(key) ?? [];
          for (const item of items) {
            if (seen.has(item.id)) continue;
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
      // Evict oldest entry if at cap (LRU-lite: drop from front)
      if (existing < 0 && items.length >= MAX_ITEMS_PER_KEY) items.shift();
      const embedding = await this.embed(item.content);
      const stored: StoredItem = { id: item.id, content: item.content, corpus: item.corpus, metadata: item.metadata, embedding };
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
