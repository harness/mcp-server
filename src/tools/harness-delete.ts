import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { toMcpError } from "../utils/errors.js";

export function registerDeleteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_delete",
    "Delete a Harness resource. Requires confirmation=true to proceed. This is destructive and cannot be undone.",
    {
      resource_type: z.string().describe("The type of resource to delete (e.g. pipeline, trigger, connector)"),
      resource_id: z.string().describe("The identifier of the resource to delete"),
      confirmation: z.boolean().describe("Must be true to confirm the delete operation — this is destructive").default(false),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      pipeline_id: z.string().describe("Pipeline ID (for trigger deletes)").optional(),
      environment_id: z.string().describe("Environment ID (for infrastructure deletes)").optional(),
    },
    async (args) => {
      try {
        if (!args.confirmation) {
          return errorResult("Delete operations require confirmation=true. This is destructive and cannot be undone.");
        }

        const def = registry.getResource(args.resource_type);
        const input: Record<string, unknown> = { ...args };
        if (def.identifierFields.length > 0 && args.resource_id) {
          input[def.identifierFields[0]] = args.resource_id;
        }

        const result = await registry.dispatch(client, args.resource_type, "delete", input);
        return jsonResult({ deleted: true, resource_type: args.resource_type, resource_id: args.resource_id, ...((typeof result === "object" && result !== null) ? result : {}) });
      } catch (err) {
        if (err instanceof Error && (err.message.startsWith("Unknown resource_type") || err.message.includes("does not support"))) {
          return errorResult(err.message);
        }
        throw toMcpError(err);
      }
    },
  );
}
