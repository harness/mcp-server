import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

export function registerDeleteTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_delete",
    "Delete a Harness resource. You can pass a Harness URL to auto-extract identifiers. This is destructive and cannot be undone.",
    {
      resource_type: z.string().describe("The type of resource to delete (e.g. pipeline, trigger, connector)"),
      resource_id: z.string().describe("The identifier of the resource to delete"),
      url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      pipeline_id: z.string().describe("Pipeline ID (for trigger deletes)").optional(),
      environment_id: z.string().describe("Environment ID (for infrastructure deletes)").optional(),
    },
    async (args) => {
      try {
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_delete",
          message: `Delete ${args.resource_type} "${args.resource_id}"?\n\nThis is destructive and cannot be undone.`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }

        const def = registry.getResource(args.resource_type);
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        if (def.identifierFields.length > 0 && args.resource_id) {
          input[def.identifierFields[0]] = args.resource_id;
        }

        const result = await registry.dispatch(client, args.resource_type, "delete", input);
        return jsonResult({ deleted: true, resource_type: args.resource_type, resource_id: args.resource_id, ...((typeof result === "object" && result !== null) ? result : {}) });
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
