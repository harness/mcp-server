import type { Config } from "../config.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { SearchProvider } from "./types.js";
import { NullSearchProvider } from "./null-provider.js";
import { LocalSearchProvider } from "./local-provider.js";
import { createLogger } from "../utils/logger.js";
import "../data/examples/load-all.js";
import { getAllExamples } from "../data/examples/index.js";

const log = createLogger("search-manager");

const TIER1_TYPES = ["pipeline", "service", "environment", "connector"] as const;

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

  /**
   * Index all static, account-agnostic content into mcp_resources corpus.
   * Safe to call in any mode — no account context needed.
   * Items are permanent (ttlMs=0) since they're bundled with the server.
   */
  async indexStaticContent(registry: Registry): Promise<void> {
    if (!this.provider.isAvailable()) return;

    // 1. Resource type definitions from registry
    const resourceTypes = registry.getAllResourceTypes();
    await Promise.all(resourceTypes.map(rt => {
      try {
        const def = registry.getResource(rt);
        const ops = Object.keys(def.operations ?? {}).join(", ");
        return this.provider.index({
          id: `resource-def:${rt}`,
          content: [rt.replace(/_/g, " "), def.displayName, def.description, ops].filter(Boolean).join(" "),
          corpus: "mcp_resources",
          ttlMs: 0,
          metadata: {
            type: "resource_definition",
            resource_type: rt,
            display_name: def.displayName ?? rt,
            operations: ops,
            scope: def.scope ?? "",
          },
        });
      } catch {
        return Promise.resolve();
      }
    }));
    log.info(`Indexed ${resourceTypes.length} resource definitions`);

    // 2. Examples (YAML templates)
    const examples = getAllExamples();
    await Promise.all(examples.map(ex =>
      this.provider.index({
        id: `example:${ex.name}`,
        content: [ex.resourceType.replace(/_/g, " "), ex.name.replace(/-/g, " "), ex.description, ex.tags.join(" ")].join(" "),
        corpus: "mcp_resources",
        ttlMs: 0,
        metadata: {
          type: "example",
          resource_type: ex.resourceType,
          name: ex.name,
          description: ex.description,
          tags: ex.tags.join(","),
        },
      })
    ));
    log.info(`Indexed ${examples.length} examples`);
  }

  /**
   * Pre-index tier-1 Harness resources for a specific account.
   * Only call in stdio (single-user) mode where client.account is known.
   */
  async initializeIndex(registry: Registry, client: HarnessClient): Promise<void> {
    if (!this.provider.isAvailable()) return;
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
            content: [resourceType.replace(/_/g, " "), item["name"], item["description"], item["identifier"], item["tags"]].filter(Boolean).join(" "),
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
      return new LocalSearchProvider();
    }
    return new NullSearchProvider();
  }
}
