import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";
import { createLogger } from "../utils/logger.js";
import { sendProgress } from "../utils/progress.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import type { ResourceScope } from "../registry/types.js";
import { searchOutputSchema } from "./output-schemas.js";
import type { SearchManager } from "../search/index.js";
import type { SearchResult } from "../search/types.js";
import { entityResultMatchesEffectiveScope } from "../search/entity-index.js";

const log = createLogger("search");
const RESOURCE_SCOPES: readonly ResourceScope[] = ["account", "org", "project"];

/** Relevance tiers — lower number = more relevant. */
const RELEVANCE_TIERS: Record<string, number> = {
  pipeline: 1, service: 1, environment: 1, connector: 1, execution: 1,
  template: 2, trigger: 2, input_set: 2, secret: 2, fme_feature_flag: 2,
  repository: 2, infrastructure: 2,
  scs_artifact_source: 2, artifact_security: 2, code_repo_security: 2,
  scs_artifact_component: 2, scs_compliance_result: 2,
};

function getTier(resourceType: string): number {
  return RELEVANCE_TIERS[resourceType] ?? 3;
}

function asResourceScope(value: unknown): ResourceScope | undefined {
  return typeof value === "string" && RESOURCE_SCOPES.includes(value as ResourceScope)
    ? value as ResourceScope
    : undefined;
}

interface SearchResultEntry {
  resource_type: string;
  tier: number;
  match_count: number;
  items: unknown[];
  total: number;
  openInHarness?: string;
}

/**
 * Tier-1 types always included in semantic routing even when embeddings miss them.
 * Prevents confident-but-wrong routing from silently skipping core CI/CD entities.
 */
export const SEMANTIC_ROUTING_SAFETY_FLOOR = ["pipeline", "service", "environment", "connector"] as const;

/**
 * Routing threshold — semantic hits above this score are used to predict which
 * resource types scatter-gather should target. Higher = more conservative routing
 * (fewer types skipped, safer). Lower = more aggressive (more savings, higher miss risk).
 */
const SEMANTIC_ROUTING_THRESHOLD = 0.5;

/**
 * Display threshold — semantic hits above this (but below routing threshold) are still
 * shown as tier-0 results even if they didn't influence routing.
 */
const SEMANTIC_DISPLAY_THRESHOLD = 0.35;

/**
 * Extract unique resource types from semantic results that meet the routing threshold.
 * Uses both:
 * - `resources` corpus hits: live Harness data already indexed for this account
 * - `mcp_resources` corpus hits: resource_definition and entity_schema entries whose
 *   resource_type field maps directly to a listable API type (e.g. resource-def:connector
 *   → "connector"). These are the primary routing signal since mcp_resources is always
 *   indexed at startup whereas resources may be sparse.
 */
export function extractRoutingTypes(semanticResults: SearchResult[], allTargetTypes: string[]): string[] | null {
  const targetSet = new Set(allTargetTypes);
  const predicted = new Set<string>();
  for (const sr of semanticResults) {
    if (sr.score < SEMANTIC_ROUTING_THRESHOLD) continue;
    const rt = sr.metadata["resource_type"];
    if (rt && targetSet.has(rt)) {
      predicted.add(rt);
    }
  }
  return predicted.size > 0 ? Array.from(predicted) : null;
}

/** Union predicted types with tier-1 safety floor types present in the candidate set. */
export function applyRoutingSafetyFloor(predicted: string[], candidateTypes: string[]): string[] {
  const candidateSet = new Set(candidateTypes);
  const routed = new Set(predicted);
  for (const rt of SEMANTIC_ROUTING_SAFETY_FLOOR) {
    if (candidateSet.has(rt)) {
      routed.add(rt);
    }
  }
  return Array.from(routed);
}

export function registerSearchTool(server: McpServer, registry: Registry, client: HarnessClient, searchManager?: SearchManager): void {
  const listableTypes = registry.getTypesForOperation("list") as [string, ...string[]];

  server.registerTool(
    "harness_search",
    {
      description: "Search across multiple Harness resource types. Returns results ranked by relevance. Accepts a Harness URL for scope.",
      inputSchema: {
        query: z.string().describe("Search term"),
        resource_types: z.array(z.enum(listableTypes)).optional().describe("Types to search (defaults to all listable)"),
        url: z.string().optional().describe("Harness UI URL — auto-extracts org and project"),
        resource_scope: z.enum(["account", "org", "project"]).optional().describe("Scope to search. Use account for account-level resources and to omit org/project defaults; org injects only org; project injects org+project. Auto-detected from url."),
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        max_per_type: z.number().default(5).optional().describe("Max results per type"),
        compact: z.boolean().default(true).optional().describe("Strip verbose metadata (default true)"),
      },
      outputSchema: searchOutputSchema,
      annotations: {
        title: "Search Harness Resources",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      try {
        const signal = extra.signal;
        const mergedArgs = applyUrlDefaults(args as Record<string, unknown>, args.url, { includeResourceScope: true });
        const requestedScope = asResourceScope(mergedArgs.resource_scope);
        const hasExplicitResourceTypes = (args.resource_types?.length ?? 0) > 0;

        // Determine the full candidate type list (before semantic narrowing)
        let candidateTypes = args.resource_types ?? [];
        if (candidateTypes.length === 0) {
          candidateTypes = registry.getAllResourceTypes().filter((rt) => registry.supportsOperation(rt, "list"));
        }
        if (requestedScope && !hasExplicitResourceTypes) {
          candidateTypes = candidateTypes.filter((rt) => registry.getSupportedScopes(rt).includes(requestedScope));
        }

        // --- Semantic routing ---
        // Run semantic search first. If it returns high-confidence hits for specific
        // resource types, narrow scatter-gather to only those types.
        const provider = searchManager?.getProvider();
        let semanticResults: SearchResult[] = [];
        let routedTypes: string[] | null = null;
        let semanticRouted = false;

        if (provider?.isAvailable() && !hasExplicitResourceTypes) {
          semanticResults = await provider.search(args.query, {
            corpus: "all",
            accountId: client.account,
            k: 30,
          });
          semanticResults = semanticResults.filter((result) =>
            entityResultMatchesEffectiveScope(result, registry, mergedArgs)
          );

          if (semanticResults.length > 0) {
            const predictedTypes = extractRoutingTypes(semanticResults, candidateTypes);
            if (predictedTypes) {
              routedTypes = applyRoutingSafetyFloor(predictedTypes, candidateTypes);
              semanticRouted = true;
              const floorAdded = routedTypes.filter((rt) => !predictedTypes.includes(rt));
              log.info(`Semantic routing: narrowed from ${candidateTypes.length} → ${routedTypes.length} types`, {
                query: args.query,
                routed_types: routedTypes,
                predicted_types: predictedTypes,
                safety_floor_added: floorAdded,
                top_score: semanticResults[0]?.score,
                skipped: candidateTypes.length - routedTypes.length,
              });
            } else {
              log.info(`Semantic search: no high-confidence routing hits, falling back to full scatter-gather`, {
                query: args.query,
                results: semanticResults.length,
                top_score: semanticResults[0]?.score ?? 0,
              });
            }
          }
        }

        const targetTypes = routedTypes ?? candidateTypes;

        // --- Scatter-gather over targetTypes ---
        const entries: SearchResultEntry[] = [];
        const errors: Record<string, string> = {};
        const MAX_CONCURRENCY = 5;
        const settled: { rt: string; result: unknown; error: string | null }[] = [];
        let searched = 0;

        for (let i = 0; i < targetTypes.length; i += MAX_CONCURRENCY) {
          signal.throwIfAborted();
          const batch = targetTypes.slice(i, i + MAX_CONCURRENCY);
          await sendProgress(extra, searched, targetTypes.length, `Searching batch ${Math.floor(i / MAX_CONCURRENCY) + 1} of ${Math.ceil(targetTypes.length / MAX_CONCURRENCY)}${semanticRouted ? " (semantic-routed)" : ""}...`);
          const batchResults = await Promise.all(
            batch.map(async (rt) => {
              try {
                const result = await registry.dispatch(client, rt, "list", {
                  ...mergedArgs,
                  search_term: args.query,
                  name: args.query,
                  query: args.query,
                  search: args.query,
                  size: args.max_per_type ?? 5,
                  limit: args.max_per_type ?? 5,
                  page: 0,
                }, { tool: "harness_search" }, signal);
                return { rt, result, error: null };
              } catch (err) {
                log.debug(`Search failed for ${rt}`, { error: String(err) });
                return { rt, result: null, error: String(err) };
              }
            }),
          );
          settled.push(...batchResults);
          searched += batch.length;
        }

        await sendProgress(extra, targetTypes.length, targetTypes.length, "Processing results...");
        let totalMatches = 0;

        for (const { rt, result, error } of settled) {
          if (result) {
            const r = result as { items?: unknown[]; total?: number; openInHarness?: string };
            if (r.items && r.items.length > 0) {
              const items = args.compact !== false ? compactItems(r.items, registry.getResource(rt).compactItem) : r.items;
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

        // --- Merge semantic results ---
        // Tier-0: semantic hits (schemas, examples, resource defs, and any live resources
        // not already in keyword results) above display threshold
        const keywordIds = new Set(
          entries.flatMap(e => (e.items as Array<Record<string, unknown>>).map(i => String(i["identifier"] ?? i["id"] ?? "")))
        );
        const seenSemanticIds = new Set<string>();
        let semanticMatchCount = 0;
        for (const sr of semanticResults) {
          if (sr.score < SEMANTIC_DISPLAY_THRESHOLD) continue;
          const dedupeId = sr.metadata["identifier"] || sr.id;
          if (seenSemanticIds.has(dedupeId)) continue;
          seenSemanticIds.add(dedupeId);
          if (sr.metadata["identifier"] && keywordIds.has(sr.metadata["identifier"])) continue;
          semanticMatchCount++;
          entries.push({
            resource_type: sr.metadata["resource_type"] ?? sr.corpus,
            tier: 0,
            match_count: 1,
            items: [{ ...sr.metadata, _id: sr.id, _semantic_score: sr.score, _corpus: sr.corpus }],
            total: 1,
          });
        }

        entries.sort((a, b) => {
          if (a.tier !== b.tier) return a.tier - b.tier;
          return b.match_count - a.match_count;
        });

        const skippedTypes = semanticRouted
          ? candidateTypes.filter((rt) => !targetTypes.includes(rt))
          : [];
        return jsonResult({
          query: args.query,
          total_matches: totalMatches + semanticMatchCount,
          searched_types: targetTypes.length,
          ...(semanticRouted ? { semantic_routed: true, types_skipped: skippedTypes } : {}),
          results: entries,
          ...(Object.keys(errors).length > 0 ? { errors } : {}),
        });
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
