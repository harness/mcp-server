import type { Config } from "../config.js";
import type { SearchProvider } from "./types.js";
import { NullSearchProvider } from "./null-provider.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search-manager");

export class SearchManager {
  private provider: SearchProvider;

  constructor(config: Config) {
    this.provider = this.loadProvider(config);
  }

  getProvider(): SearchProvider {
    return this.provider;
  }

  async initialize(): Promise<void> {
    try {
      await this.provider.initialize();
      log.info(`Search provider initialized: ${this.provider.constructor.name}, available=${this.provider.isAvailable()}`);
    } catch (err) {
      log.warn("Search provider initialization failed — falling back to null provider", { error: String(err) });
      this.provider = new NullSearchProvider();
    }
  }

  private loadProvider(config: Config): SearchProvider {
    const providerName = config.HARNESS_SEARCH_PROVIDER ?? "none";
    if (providerName === "faiss") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { LocalSearchProvider } = require("./local-provider.js") as typeof import("./local-provider.js");
        return new LocalSearchProvider();
      } catch (err) {
        log.warn("local provider requested but @huggingface/transformers not available — using null provider", { error: String(err) });
        return new NullSearchProvider();
      }
    }
    return new NullSearchProvider();
  }
}
