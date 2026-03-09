import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

export function registerListTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_list",
    "List Harness resources by type with filtering and pagination. You can pass a Harness URL to auto-extract org, project, and resource type. Call harness_describe to discover available resource_types.",
    {
      resource_type: z.string().describe("The type of resource to list (e.g. pipeline, service, environment, connector). Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness UI URL — org, project, and resource type are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      page: z.number().describe("Page number, 0-indexed").default(0).optional(),
      size: z.number().min(1).max(100).describe("Page size (1–100)").default(20).optional(),
      search_term: z.string().describe("Filter results by name or keyword").optional(),
      compact: z.boolean().describe("Strip verbose metadata from list items, keeping only essential fields (default true)").default(true).optional(),
      filters: z.record(z.string(), z.unknown()).describe("Additional filter fields passed to the API (e.g. status, module, pipeline_id, environment_id, agent_id). Call harness_describe for available filters per resource_type.").optional(),
    },
    async (args) => {
      try {
        const { filters, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        // Spread caller-supplied filters into the input for registry dispatch
        if (filters) Object.assign(input, filters);
        const resourceType = input.resource_type as string | undefined;
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        if (resourceType === "template" && input.template_list_type === undefined) {
          input.template_list_type = "All";
        }
        const result = await registry.dispatch(client, resourceType, "list", input);

        // Apply compact mode — strip verbose metadata from list items
        if (args.compact !== false) {
          const r = result as { items?: unknown[] };
          if (r.items && Array.isArray(r.items)) {
            r.items = compactItems(r.items);
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
