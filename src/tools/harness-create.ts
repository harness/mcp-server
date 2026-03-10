import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

export function registerCreateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.registerTool(
    "harness_create",
    {
      description: "Create a Harness resource. For pipelines: use body.yamlPipeline (YAML string, recommended) or body.pipeline (JSON). For remote/git-backed pipelines, pass git details in params (store_type, connector_ref, repo_name, branch, file_path). For others: call harness_describe for the body format.",
      inputSchema: {
        resource_type: z.string().describe("The type of resource to create (e.g. pipeline, service, environment, connector, trigger)"),
        body: z.record(z.string(), z.unknown()).describe("The resource definition body (varies by resource type — typically the YAML or JSON spec)"),
        url: z.string().describe("A Harness UI URL — org and project are extracted automatically").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional parameters. For remote pipelines: store_type='REMOTE', connector_ref, repo_name, branch, file_path, commit_msg.").optional(),
      },
      annotations: {
        title: "Create Harness Resource",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        if (params) Object.assign(input, params);

        // Validate resource_type and operation before asking user to confirm
        const def = registry.getResource(args.resource_type);
        if (!def.operations.create) {
          return errorResult(`Resource "${args.resource_type}" does not support "create". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

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
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
