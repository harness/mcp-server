import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import { jsonResult } from "../utils/response-formatter.js";

export function registerDescribeTool(server: McpServer, registry: Registry): void {
  server.tool(
    "harness_describe",
    "Describe available Harness resource types, their supported operations, and fields. No API call — returns local metadata only. Use this to discover what resource_types you can use with other harness_ tools.",
    {
      resource_type: z.string().describe("Get details for a specific resource type").optional(),
      toolset: z.string().describe("Filter to a specific toolset (e.g. pipelines, services)").optional(),
      search_term: z.string().describe("Search for resource types by keyword (matches type name, display name, toolset, description)").optional(),
    },
    async (args) => {
      if (args.resource_type) {
        try {
          const def = registry.getResource(args.resource_type);
          return jsonResult({
            resource_type: def.resourceType,
            displayName: def.displayName,
            description: def.description,
            toolset: def.toolset,
            scope: def.scope,
            identifierFields: def.identifierFields,
            listFilterFields: def.listFilterFields,
            operations: Object.entries(def.operations).map(([op, spec]) => ({
              operation: op,
              method: spec.method,
              description: spec.description,
              bodySchema: spec.bodySchema ?? undefined,
            })),
            executeActions: def.executeActions
              ? Object.entries(def.executeActions).map(([action, spec]) => ({
                  action,
                  method: spec.method,
                  description: spec.actionDescription,
                  bodySchema: spec.bodySchema ?? undefined,
                }))
              : undefined,
            diagnosticHint: def.diagnosticHint ?? undefined,
          });
        } catch (err) {
          // Resource type not found — return the compact summary with an error hint
          const summary = registry.describeSummary();
          return jsonResult({
            error: err instanceof Error ? err.message : String(err),
            ...summary,
          });
        }
      }

      // Search by keyword
      if (args.search_term) {
        const results = registry.searchResources(args.search_term);
        return jsonResult({
          search_term: args.search_term,
          total_results: results.length,
          resource_types: results,
          hint: results.length > 0
            ? "Call harness_describe with resource_type='<type>' for full details on a specific match."
            : "No matches found. Try a broader term, or call harness_describe with no arguments to see all resource types.",
        });
      }

      // Filter by toolset if specified — use full detail
      if (args.toolset) {
        const describe = registry.describe();
        const toolsets = describe.toolsets as Record<string, unknown>;
        const filtered = toolsets[args.toolset];
        if (!filtered) {
          return jsonResult({
            error: `Unknown toolset "${args.toolset}". Available: ${Object.keys(toolsets).join(", ")}`,
            available_toolsets: Object.keys(toolsets),
          });
        }
        return jsonResult({ toolset: args.toolset, ...filtered as object });
      }

      // No-args: return compact summary (~30 tokens per resource type)
      return jsonResult(registry.describeSummary());
    },
  );
}
