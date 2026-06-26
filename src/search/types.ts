export type SearchCorpus = "resources" | "docs" | "mcp_resources";

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
}

export interface SearchProvider {
  /** Called once at server startup. Must not throw — log and degrade gracefully. */
  initialize(): Promise<void>;
  /** Returns true if this provider can serve queries. */
  isAvailable(): boolean;
  /** Semantic search. Returns [] if unavailable. Must not throw. */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Index a single item async (fire-and-forget caller). Must not throw. */
  index(item: IndexableItem): Promise<void>;
}
