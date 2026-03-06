import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("search");

/** Relevance tiers — lower number = more relevant. */
const RELEVANCE_TIERS: Record<string, number> = {
  pipeline: 1, service: 1, environment: 1, connector: 1, execution: 1,
  template: 2, trigger: 2, input_set: 2, secret: 2, feature_flag: 2,
  repository: 2, infrastructure: 2,
  // Everything else defaults to tier 3
};

function getTier(resourceType: string): number {
  return RELEVANCE_TIERS[resourceType] ?? 3;
}

interface SearchResultEntry {
  resource_type: string;
  tier: number;
  match_count: number;
  items: unknown[];
  total: number;
  openInHarness?: string;
}

export function registerSearchTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_search",
    "Search across multiple Harness resource types simultaneously. Returns results ranked by relevance (pipelines/services first, then templates/triggers, then others).",
    {
      query: z.string().describe("Search term to find across resource types"),
      resource_types: z.array(z.string()).describe("Resource types to search (defaults to all listable types if empty)").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      max_per_type: z.number().describe("Max results per resource type").default(5).optional(),
      compact: z.boolean().describe("Strip verbose metadata from results (default true)").default(true).optional(),
    },
    async (args) => {
      try {
        // Determine which resource types to search
        let targetTypes = args.resource_types ?? [];
        if (targetTypes.length === 0) {
          // Search all types that support list
          targetTypes = registry.getAllResourceTypes().filter((rt) => registry.supportsOperation(rt, "list"));
        }

        const entries: SearchResultEntry[] = [];
        const errors: Record<string, string> = {};

        // Run searches with concurrency limit to avoid overwhelming the API
        const MAX_CONCURRENCY = 5;
        const settled: { rt: string; result: unknown; error: string | null }[] = [];

        for (let i = 0; i < targetTypes.length; i += MAX_CONCURRENCY) {
          const batch = targetTypes.slice(i, i + MAX_CONCURRENCY);
          const batchResults = await Promise.all(
            batch.map(async (rt) => {
              try {
                const result = await registry.dispatch(client, rt, "list", {
                  ...args,
                  search_term: args.query,
                  name: args.query,
                  query: args.query,
                  search: args.query,
                  size: args.max_per_type ?? 5,
                  limit: args.max_per_type ?? 5,
                  page: 0,
                });
                return { rt, result, error: null };
              } catch (err) {
                log.debug(`Search failed for ${rt}`, { error: String(err) });
                return { rt, result: null, error: String(err) };
              }
            }),
          );
          settled.push(...batchResults);
        }
        let totalMatches = 0;

        for (const { rt, result, error } of settled) {
          if (result) {
            const r = result as { items?: unknown[]; total?: number; openInHarness?: string };
            if (r.items && r.items.length > 0) {
              const items = args.compact !== false ? compactItems(r.items) : r.items;
              const matchCount = r.items.length;
              totalMatches += matchCount;
              entries.push({
                resource_type: rt,
                tier: getTier(rt),
                match_count: matchCount,
                items,
                total: r.total ?? matchCount,
                ...(r.openInHarness ? { openInHarness: r.openInHarness } : {}),
              });
            }
          }
          if (error) {
            errors[rt] = error;
          }
        }

        // Sort by tier ascending, then by match_count descending within tier
        entries.sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return b.match_count - a.match_count;
        });

        return jsonResult({
          query: args.query,
          total_matches: totalMatches,
          searched_types: targetTypes.length,
          results: entries,
          ...(Object.keys(errors).length > 0 ? { errors } : {}),
        });
      } catch (err) {
        if (err instanceof Error) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}
