import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";
import { compactItems } from "../utils/compact.js";

export function registerListTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_list",
    "List Harness resources by type with filtering and pagination. Call harness_describe to discover available resource_types, or harness_describe with search_term to find specific ones.",
    {
      resource_type: z.string().describe("The type of resource to list (e.g. pipeline, service, environment, connector)"),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      page: z.number().describe("Page number, 0-indexed").default(0).optional(),
      size: z.number().min(1).max(100).describe("Page size (1–100)").default(20).optional(),
      search_term: z.string().describe("Filter results by name or keyword").optional(),
      compact: z.boolean().describe("Strip verbose metadata from list items, keeping only essential fields (default true)").default(true).optional(),
      // Additional filter fields passed through dynamically
      filter_type: z.string().describe("Filter type qualifier").optional(),
      module: z.string().describe("Harness module filter (CD, CI, etc.)").optional(),
      status: z.string().describe("Status filter").optional(),
      type: z.string().describe("Type/category filter").optional(),
      category: z.string().describe("Category filter").optional(),
      env_type: z.string().describe("Environment type filter (Production, PreProduction)").optional(),
      sort: z.string().describe("Sort field").optional(),
      pipeline_id: z.string().describe("Pipeline identifier for sub-resources (triggers, input sets, executions)").optional(),
      environment_id: z.string().describe("Environment identifier for infrastructure").optional(),
      agent_id: z.string().describe("GitOps agent identifier for agent sub-resources").optional(),
      repo_id: z.string().describe("Repository identifier for sub-resources").optional(),
      registry_id: z.string().describe("Registry identifier for artifact sub-resources").optional(),
      artifact_id: z.string().describe("Artifact identifier for version sub-resources").optional(),
      environment: z.string().describe("Feature flag environment").optional(),
      severity: z.string().describe("Security severity filter").optional(),
      template_type: z.string().describe("Template entity type for template list (e.g. Pipeline, Stage, Step). Optional filter for resource_type=template.").optional(),
      template_list_type: z.string().describe("Template list type: Stable, LastUpdated, or All. Used for resource_type=template.").optional(),
    },
    async (args) => {
      try {
        const input = { ...args } as Record<string, unknown>;
        if (args.resource_type === "template" && input.template_list_type === undefined) {
          input.template_list_type = "All";
        }
        const result = await registry.dispatch(client, args.resource_type, "list", input);

        // Apply compact mode — strip verbose metadata from list items
        if (args.compact !== false) {
          const r = result as { items?: unknown[] };
          if (r.items && Array.isArray(r.items)) {
            r.items = compactItems(r.items);
          }
        }

        return jsonResult(result);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Unknown resource_type")) {
          return errorResult(err.message);
        }
        if (err instanceof Error && err.message.includes("does not support")) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}
