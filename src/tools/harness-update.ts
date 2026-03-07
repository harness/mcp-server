import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_update",
    "Update an existing Harness resource. Response includes openInHarness link to the updated resource when applicable (e.g. pipeline, service).",
    {
      resource_type: z.string().describe("The type of resource to update (e.g. pipeline, service, environment, connector, trigger)"),
      resource_id: z.string().describe("The identifier of the resource to update"),
      body: z.record(z.string(), z.unknown()).describe("The updated resource definition body"),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      pipeline_id: z.string().describe("Pipeline ID (for trigger updates)").optional(),
      version_label: z.string().describe("Template version label (for template updates; defaults to body.version_label or v1)").optional(),
    },
    async (args) => {
      try {
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_update",
          message: `Update ${args.resource_type} "${args.resource_id}"?\n\n${JSON.stringify(args.body, null, 2)}`,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
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
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
