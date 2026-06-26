import type { Config } from "../config.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { SearchProvider } from "./types.js";
import { NullSearchProvider } from "./null-provider.js";
import { LocalSearchProvider } from "./local-provider.js";
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

  async initializeIndex(registry: Registry, client: HarnessClient): Promise<void> {
    if (!this.provider.isAvailable()) return;
    const TIER1_TYPES = ["pipeline", "service", "environment", "connector"] as const;
    const accountId = client.account;
    const types = TIER1_TYPES.filter(t => registry.supportsOperation(t, "list"));

    for (const resourceType of types) {
      try {
        const result = await registry.dispatch(client, resourceType, "list", {
          size: 50, limit: 50, page: 0,
        }, { tool: "search-init" }) as { items?: Array<Record<string, unknown>> };
        const items = result?.items ?? [];
        await Promise.all(items.map(item =>
          this.provider.index({
            id: `${resourceType}:${String(item["identifier"] ?? item["id"] ?? "")}`,
            content: [item["name"], item["description"], item["identifier"]].filter(Boolean).join(" "),
            corpus: "resources",
            accountId,
            metadata: {
              resource_type: resourceType,
              identifier: String(item["identifier"] ?? item["id"] ?? ""),
              name: String(item["name"] ?? ""),
            },
          })
        ));
        log.info(`Pre-indexed ${items.length} ${resourceType} items`);
      } catch (err) {
        log.warn(`Failed to pre-index ${resourceType}`, { error: String(err) });
      }
    }
  }

  private loadProvider(config: Config): SearchProvider {
    const providerName = config.HARNESS_SEARCH_PROVIDER ?? "none";
    if (providerName === "local") {
      // LocalSearchProvider defers @huggingface/transformers import to initialize(),
      // so construction is safe even if the package is absent at load time
      return new LocalSearchProvider();
    }
    return new NullSearchProvider();
  }
}
