import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult, mixedResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord } from "../utils/type-guards.js";
import { renderListVisual } from "../utils/svg/list-visuals.js";
import type { ListVisualType } from "../utils/svg/list-visuals.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("list");

export function registerListTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  // Build a dynamic description for the filters param from all enabled resource definitions
  const allFilterNames = registry.getAllFilterFields().map((f) => f.name);
  const filtersDesc = allFilterNames.length > 0
    ? `Resource-specific filters as key-value pairs. Available keys across enabled resource types: ${allFilterNames.join(", ")}. Call harness_describe for filters available on a specific resource_type.`
    : "Resource-specific filters as key-value pairs. Call harness_describe for available filters per resource_type.";

  server.registerTool(
    "harness_list",
    {
      description: "List Harness resources with filtering and pagination. Accepts a Harness URL to auto-extract scope.",
      inputSchema: {
        resource_type: z.string().describe("Resource type (e.g. pipeline, service, environment). Auto-detected from url.").optional(),
        url: z.string().describe("Harness UI URL — auto-extracts org, project, and type").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        page: z.number().describe("Page number, 0-indexed").default(0).optional(),
        size: z.number().min(1).max(100).describe("Page size (1–100)").default(20).optional(),
        search_term: z.string().describe("Filter results by name or keyword").optional(),
        compact: z.boolean().describe("Strip verbose metadata from list items, keeping only essential fields (default true)").default(true).optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers for nested resources (e.g. repo_id for pull requests). Call harness_describe for fields per resource_type.").optional(),
        filters: z.record(z.string(), z.unknown()).describe(filtersDesc).optional(),
        include_visual: z.boolean().describe("Include an inline PNG chart of the results (default false). Supported for execution resource_type. Use when user asks for a visualization, chart, or graph.").default(false).optional(),
        visual_type: z.enum(["timeseries", "bar", "pie"]).describe("Chart type when include_visual=true. 'timeseries' = daily execution counts, 'pie' = breakdown by status, 'bar' = breakdown by pipeline. Default 'pie'.").default("pie").optional(),
      },
      annotations: {
        title: "List Harness Resources",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { params, filters, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        // Spread caller-supplied params (path identifiers) and filters into the input
        if (params) Object.assign(input, params);
        if (filters) Object.assign(input, filters);
        const resourceType = asString(input.resource_type);
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        if (resourceType === "template" && input.template_list_type === undefined) {
          input.template_list_type = "All";
        }
        const result = await registry.dispatch(client, resourceType, "list", input);

        // Apply compact mode — strip verbose metadata from list items
        if (args.compact !== false && isRecord(result)) {
          const items = result.items;
          if (Array.isArray(items)) {
            result.items = compactItems(items);
          }
        }

        // Visual rendering (opt-in)
        if (args.include_visual && resourceType && isRecord(result)) {
          const items = result.items;
          if (Array.isArray(items)) {
            try {
              const vt = (args.visual_type ?? "pie") as ListVisualType;
              const visual = renderListVisual(resourceType, items, vt);
              if (visual) {
                (result as Record<string, unknown>).analysis = visual.analysis;
                return mixedResult(result, visual.svg);
              }
            } catch (err) {
              log.warn("Visual rendering failed, returning text-only", { error: String(err) });
            }
          }
        }

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
