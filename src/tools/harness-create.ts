import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

export function registerCreateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_create",
    "Create a new Harness resource. You can pass a Harness URL to auto-extract org and project scope. For pipelines, templates, and triggers — read the schema resource first (e.g. schema:///pipeline) to understand the required body format.",
    {
      resource_type: z.string().describe("The type of resource to create (e.g. pipeline, service, environment, connector, trigger)"),
      body: z.record(z.string(), z.unknown()).describe("The resource definition body (varies by resource type — typically the YAML or JSON spec)"),
      url: z.string().describe("A Harness UI URL — org and project are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
    },
    async (args) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_create",
          message: `Create ${args.resource_type}?\n\n${JSON.stringify(args.body, null, 2)}`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }

        const result = await registry.dispatch(client, args.resource_type, "create", input);
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
