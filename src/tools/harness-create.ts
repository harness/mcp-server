import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";

export function registerCreateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_create",
    "Create a new Harness resource. Requires confirmation=true to proceed. For pipelines, templates, and triggers — read the schema resource first (e.g. schema:///pipeline) to understand the required body format.",
    {
      resource_type: z.string().describe("The type of resource to create (e.g. pipeline, service, environment, connector, trigger)"),
      body: z.record(z.string(), z.unknown()).describe("The resource definition body (varies by resource type — typically the YAML or JSON spec)"),
      confirmation: z.boolean().describe("Must be true to confirm the create operation").default(false),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
    },
    async (args) => {
      try {
        if (!args.confirmation) {
          return errorResult("Create operations require confirmation=true. Set confirmation to true to proceed.");
        }

        const result = await registry.dispatch(client, args.resource_type, "create", args as Record<string, unknown>);
        return jsonResult(result);
      } catch (err) {
        if (err instanceof Error && (err.message.startsWith("Unknown resource_type") || err.message.includes("does not support"))) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}
