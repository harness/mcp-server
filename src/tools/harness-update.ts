import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_update",
    "Update an existing Harness resource. Requires confirmation=true to proceed. Response includes openInHarness link to the updated resource when applicable (e.g. pipeline, service).",
    {
      resource_type: z.string().describe("The type of resource to update (e.g. pipeline, service, environment, connector, trigger)"),
      resource_id: z.string().describe("The identifier of the resource to update"),
      body: z.record(z.string(), z.unknown()).describe("The updated resource definition body"),
      confirmation: z.boolean().describe("Must be true to confirm the update operation").default(false),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      pipeline_id: z.string().describe("Pipeline ID (for trigger updates)").optional(),
      version_label: z.string().describe("Template version label (for template updates; defaults to body.version_label or v1)").optional(),
    },
    async (args) => {
      try {
        if (!args.confirmation) {
          return errorResult("Update operations require confirmation=true. Set confirmation to true to proceed.");
        }

        const def = registry.getResource(args.resource_type);
        const input: Record<string, unknown> = { ...args };
        if (def.identifierFields.length > 0 && args.resource_id) {
          input[def.identifierFields[0]] = args.resource_id;
        }
        if (args.version_label) input.version_label = args.version_label;
        else if (args.body && typeof args.body === "object" && "version_label" in args.body) {
          input.version_label = (args.body as Record<string, unknown>).version_label;
        } else if (args.resource_type === "template") {
          input.version_label = "v1";
        }

        const result = await registry.dispatch(client, args.resource_type, "update", input);
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
