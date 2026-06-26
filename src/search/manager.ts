import type { Config } from "../config.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { SearchCorpus, SearchProvider, IndexableItem } from "./types.js";
import { NullSearchProvider } from "./null-provider.js";
import { LocalSearchProvider } from "./local-provider.js";
import { createLogger } from "../utils/logger.js";
import "../data/examples/load-all.js";
import { getAllExamples } from "../data/examples/index.js";
import { SCHEMAS } from "../data/schemas/index.js";
import { ENTITY_BUNDLED_SCHEMAS } from "../data/schemas/entities/index.js";
import { buildResourceIndexContent } from "./embedding-content.js";

const log = createLogger("search-manager");

const TIER1_TYPES = ["pipeline", "service", "environment", "connector"] as const;

export class SearchManager {
  private provider: SearchProvider;
  private readonly mcpMode: Config["HARNESS_MCP_MODE"];
  private readonly providerName: Config["HARNESS_SEARCH_PROVIDER"];
  private loggedResourcesCorpusDisabled = false;

  constructor(config: Config) {
    this.mcpMode = config.HARNESS_MCP_MODE;
    this.providerName = config.HARNESS_SEARCH_PROVIDER;
    this.provider = this.loadProvider(config);
  }

  /**
   * Whether live customer data may be indexed into the given corpus.
   * LocalSearchProvider must not index `resources` in multi-user HTTP mode.
   */
  canIndexCorpus(corpus: SearchCorpus): boolean {
    if (corpus === "resources" && this.mcpMode === "multi-user" && this.providerName === "local") {
      return false;
    }
    return true;
  }

  /**
   * Index a single item, enforcing corpus/mode policy before delegating to the provider.
   */
  async indexItem(item: IndexableItem): Promise<void> {
    if (!this.provider.isAvailable()) return;
    if (!this.canIndexCorpus(item.corpus)) {
      if (!this.loggedResourcesCorpusDisabled) {
        this.loggedResourcesCorpusDisabled = true;
        log.warn("resources corpus disabled in multi-user mode — requires HarnessSearchProvider");
      }
      return;
    }
    await this.provider.index(item);
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

    // 3. Bundled pipeline/template/trigger schemas
    // Display-only mapping: comma-separated resource types for schemas that span multiple types.
    // NOT used for routing (comma values won't match any single type in extractRoutingTypes).
    const SCHEMA_RESOURCE_TYPES: Record<string, string> = {
      "pipeline": "pipeline",
      "pipeline_v1": "pipeline_v1",
      "template": "template,pipeline,template_v1",
      "template_v1": "template_v1,template",
      "trigger": "trigger,pipeline",
      "inputSet_v1": "input_set",
      "overlayInputSet_v1": "input_set",
      "agent-pipeline": "pipeline,pipeline_v1",
    };
    const schemaEntries = Object.entries(SCHEMAS);
    await Promise.all(schemaEntries.map(([name, schema]) => {
      const resourceType = SCHEMA_RESOURCE_TYPES[name] ?? name;
      return this.provider.index({
        id: `schema:${name}`,
        content: [
          name.replace(/_/g, " ").replace(/-/g, " "),
          "schema",
          "yaml structure",
          schema?.title ?? "",
          schema?.description ?? "",
        ].filter(Boolean).join(" "),
        corpus: "mcp_resources",
        ttlMs: 0,
        metadata: {
          type: "schema",
          resource_type: resourceType,
          schema_name: name,
          uri: `schema:///${name}`,
          action: `call harness_schema with resource_type="${name.replace("_v1", "").replace("-", "_")}"`,
        },
      });
    }));

    // 4. Entity schemas (connector, environment, service, secret, infrastructure)
    const entityEntries = Object.entries(ENTITY_BUNDLED_SCHEMAS);
    await Promise.all(entityEntries.map(([name, schema]) =>
      this.provider.index({
        id: `entity-schema:${name}`,
        content: [
          name.replace(/[._]/g, " "),
          "schema",
          "yaml structure",
          schema?.title ?? "",
          schema?.description ?? "",
        ].filter(Boolean).join(" "),
        corpus: "mcp_resources",
        ttlMs: 0,
        metadata: {
          type: "entity_schema",
          schema_name: name,
          resource_type: name.split(".")[0] ?? name,
          scope: name.split(".")[1] ?? "",
          action: `call harness_schema with resource_type="${name.split(".")[0] ?? name}"`,
        },
      })
    ));
    log.info(`Indexed ${schemaEntries.length} bundled schemas, ${entityEntries.length} entity schemas`);
  }

  /**
   * Pre-index tier-1 Harness resources for a specific account.
   * Only call in stdio (single-user) mode where client.account is known.
   */
  async initializeIndex(registry: Registry, client: HarnessClient): Promise<void> {
    if (!this.provider.isAvailable()) return;
    if (!this.canIndexCorpus("resources")) {
      if (!this.loggedResourcesCorpusDisabled) {
        this.loggedResourcesCorpusDisabled = true;
        log.warn("resources corpus disabled in multi-user mode — requires HarnessSearchProvider");
      }
      return;
    }
    const accountId = client.account;
    const types = TIER1_TYPES.filter(t => registry.supportsOperation(t, "list"));

    for (const resourceType of types) {
      try {
        const result = await registry.dispatch(client, resourceType, "list", {
          size: 50, limit: 50, page: 0,
        }, { tool: "search-init" }) as { items?: Array<Record<string, unknown>> };
        const items = result?.items ?? [];
        await Promise.all(items.filter(item => item["identifier"] ?? item["id"]).map(item =>
          this.indexItem({
            id: `${resourceType}:${String(item["identifier"] ?? item["id"] ?? "")}`,
            content: buildResourceIndexContent(resourceType, item),
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
      return new LocalSearchProvider({ cacheDir: config.HARNESS_HF_CACHE_DIR });
    }
    return new NullSearchProvider();
  }
}
