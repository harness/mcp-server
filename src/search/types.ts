export type SearchCorpus = "entities" | "docs" | "knowledge";

/** Per-corpus default TTL in milliseconds. undefined = never expires. */
export const CORPUS_DEFAULT_TTL_MS: Record<SearchCorpus, number | undefined> = {
  entities: 30 * 60 * 1000,    // 30 minutes — live Harness data changes frequently
  docs: undefined,               // permanent — doc content is versioned externally
  knowledge: undefined,      // permanent — bundled static data (schemas, examples, defs)
};

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  corpus: SearchCorpus;
  metadata: Record<string, string>;
}

export interface SearchOptions {
  corpus?: SearchCorpus | "all";
  accountId?: string;
  filters?: Record<string, string>;
  k?: number;
}

export interface IndexableItem {
  id: string;
  content: string;
  corpus: SearchCorpus;
  accountId?: string;
  metadata: Record<string, string>;
  /**
   * How long this item remains valid in milliseconds.
   * undefined = use the corpus default from CORPUS_DEFAULT_TTL_MS.
   * 0 = never expires (permanent), regardless of corpus default.
   */
  ttlMs?: number;
}

export type SearchProviderName = "none" | "local";

export type SearchReadiness =
  | { state: "disabled"; configured: "none" }
  | { state: "initializing"; configured: SearchProviderName }
  | { state: "ready"; configured: SearchProviderName; provider: string }
  | { state: "failed"; configured: SearchProviderName; error: string };

export interface SearchProvider {
  /** Called once at server startup. Must not throw — log and degrade gracefully. */
  initialize(): Promise<void>;
  /** Returns true if this provider can serve queries. */
  isAvailable(): boolean;
  /** Semantic search. Returns [] if unavailable. Must not throw. */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Index a single item. Must not throw. */
  index(item: IndexableItem): Promise<void>;
  /** Remove expired items across all corpora and keys. */
  evictExpired(): void;
}
