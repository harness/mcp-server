import type { SearchProvider, SearchResult, SearchOptions, IndexableItem } from "./types.js";

export class NullSearchProvider implements SearchProvider {
  async initialize(): Promise<void> {}
  isAvailable(): boolean { return false; }
  async search(_query: string, _options?: SearchOptions): Promise<SearchResult[]> { return []; }
  async index(_item: IndexableItem): Promise<void> {}
}
