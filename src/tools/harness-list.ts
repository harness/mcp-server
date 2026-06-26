import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult, mixedResult, normalizeHarnessListPayload } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, enrichErrorWithHint, HarnessApiError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord, coerceRecord } from "../utils/type-guards.js";
import { renderListVisual } from "../utils/svg/list-visuals.js";
import type { SearchManager } from "../search/index.js";
import { buildResourceIndexContent } from "../search/embedding-content.js";
import type { ListVisualType } from "../utils/svg/list-visuals.js";
import { createLogger } from "../utils/logger.js";
import { resourceTypeSchema } from "./input-schemas.js";
import { listOutputSchema } from "./output-schemas.js";

const log = createLogger("list");

export function registerListTool(server: McpServer, registry: Registry, client: HarnessClient, searchManager?: SearchManager): void {
  // Build a dynamic description for the filters param from all enabled resource definitions
  const allFilterNames = registry.getAllFilterFields().map((f) => f.name);
  const filtersDesc = allFilterNames.length > 0
    ? `Resource-specific filters as key-value pairs. Available keys across enabled resource types: ${allFilterNames.join(", ")}. Call harness_describe for filters available on a specific resource_type.`
    : "Resource-specific filters as key-value pairs. Call harness_describe for available filters per resource_type.";

  const listableTypes = registry.getTypesForOperation("list");

  server.registerTool(
    "harness_list",
    {
      description: "List Harness resources with filtering and pagination. Accepts a Harness URL to auto-extract scope.",
      inputSchema: {
        resource_type: resourceTypeSchema(listableTypes).optional().describe("Resource type to list. Auto-detected from url."),
        url: z.string().optional().describe("Harness UI URL — auto-extracts org, project, and type"),
        resource_scope: z.enum(["account", "org", "project"]).optional().describe("Scope to query. Use account for account-level resources and to omit org/project defaults; org injects only org; project injects org+project. Auto-detected from url."),
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        page: z.number().default(0).optional().describe("Page number, 0-indexed"),
        size: z.number().min(1).max(100).default(20).optional().describe("Page size (1–100)"),
        search_term: z.string().optional().describe("Filter results by name or keyword"),
        compact: z.boolean().default(true).optional().describe("Strip verbose metadata from list items, keeping only essential fields (default true)"),
        params: z.record(z.string(), z.unknown()).optional().describe("Additional identifiers for nested resources (e.g. repo_id for pull requests). Call harness_describe for fields per resource_type."),
        filters: z.record(z.string(), z.unknown()).optional().describe(filtersDesc),
        include_visual: z.boolean().default(false).optional().describe("Include an inline PNG chart of the results (default false). Supported for execution resource_type. Use when user asks for a visualization, chart, or graph."),
        visual_type: z.enum(["timeseries", "bar", "pie"]).default("pie").optional().describe("Chart type when include_visual=true. 'timeseries' = daily execution counts, 'pie' = breakdown by status, 'bar' = breakdown by pipeline. Default 'pie'."),
      },
      outputSchema: listOutputSchema,
      annotations: {
        title: "List Harness Resources",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { params, filters, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url, { includeResourceScope: true });
        // Spread caller-supplied params (path identifiers) and filters into the input
        // Use coerceRecord to handle LLMs that serialize objects as JSON strings
        const coercedParams = coerceRecord(params);
        const coercedFilters = coerceRecord(filters);
        if (coercedParams) Object.assign(input, coercedParams);
        if (coercedFilters) Object.assign(input, coercedFilters);
        const resourceType = asString(input.resource_type);
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        if (resourceType === "template" && input.template_list_type === undefined) {
          input.template_list_type = "All";
        }
        const rawResult = await registry.dispatch(client, resourceType, "list", input);
        const page = typeof args.page === "number" ? args.page : 0;
        const result = normalizeHarnessListPayload(rawResult, { page });

        // Apply compact mode — strip verbose metadata from list items.
        // Skip when the endpoint spec has opted out via `skipCompact` (marker
        // propagated as non-enumerable `__skipCompact` by the registry).
        const resultSkipCompact = isRecord(result) && (result as Record<string, unknown> & { __skipCompact?: boolean }).__skipCompact === true;
        if (args.compact !== false && !resultSkipCompact && isRecord(result)) {
          const items = result.items;
          if (Array.isArray(items)) {
            const compactFn = registry.getResource(resourceType).compactItem;
            result.items = compactItems(items, compactFn);
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
                result.analysis = visual.analysis;
                return await mixedResult(result, visual.svg);
              }
            } catch (err) {
              log.warn("Visual rendering failed, returning text-only", { error: String(err) });
            }
          }
        }

        // Fire-and-forget: index items for semantic search (skipped in multi-user + local)
        if (searchManager && isRecord(result) && Array.isArray(result.items)) {
          const accountId = client.account;
          void Promise.all(
            (result.items as Array<Record<string, unknown>>).map(item =>
              searchManager.indexItem({
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
            )
          ).catch(() => { /* never surface indexing errors to caller */ });
        }

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) {
          const rt = asString(args.resource_type);
          let hint: string | undefined;
          if (err instanceof HarnessApiError && err.statusCode === 404 && rt) {
            try { hint = registry.getResource(rt).diagnosticHint; } catch { /* unknown type */ }
          }
          return errorResult(enrichErrorWithHint(err.message, hint));
        }
        throw toMcpError(err);
      }
    },
  );
}
