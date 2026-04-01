import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { InputExpansionRule } from "../registry/types.js";
import { jsonResult } from "../utils/response-formatter.js";

export function registerDescribeTool(server: McpServer, registry: Registry): void {
  const allTypes = registry.getAllResourceTypes() as [string, ...string[]];
  const allToolsets = registry.getAllToolsets().map(t => t.name) as [string, ...string[]];

  server.registerTool(
    "harness_describe",
    {
      description: "Describe available Harness resource types, their supported operations, and fields. No API call — returns local metadata only. Use this to discover what resource_types you can use with other harness_ tools.",
      inputSchema: {
        resource_type: z.enum(allTypes).describe("Get details for a specific resource type").optional(),
        toolset: z.enum(allToolsets).describe("Filter to a specific toolset").optional(),
        search_term: z.string().describe("Search for resource types by keyword (matches type name, display name, toolset, description)").optional(),
      },
      annotations: {
        title: "Describe Harness Resources",
        readOnlyHint: true,
        openWorldHint: false,
      },
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
                  ...(spec.inputExpansions?.length
                    ? { inputShorthands: buildShorthands(spec.inputExpansions) }
                    : {}),
                }))
              : undefined,
            diagnosticHint: def.diagnosticHint ?? undefined,
            relatedResources: def.relatedResources ?? undefined,
            executeHint: def.executeHint ?? undefined,
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

/** Generate human-readable shorthand descriptions from expansion rules. */
function buildShorthands(rules: InputExpansionRule[]): Array<{ shorthand: string; expands_to: string }> {
  return rules.map((rule) => ({
    shorthand: rule.triggerKey,
    expands_to: summarizeExpansion(rule.expand),
  }));
}

/** Flatten an expand template into a readable dot-path summary. */
function summarizeExpansion(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === "$value") {
      parts.push(path);
    } else if (typeof value === "string") {
      parts.push(`${path}=${value}`);
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      parts.push(summarizeExpansion(value as Record<string, unknown>, path));
    }
  }
  return parts.join(", ");
}
