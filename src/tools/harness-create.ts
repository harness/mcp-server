import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { coerceRecord } from "../utils/type-guards.js";
import { resourceScopeSchema, resourceTypeSchema } from "./input-schemas.js";
import { createOutputSchema } from "./output-schemas.js";

export function registerCreateTool(server: McpServer, registry: Registry, client: HarnessClient, config?: Config): void {
  const creatableTypes = registry.getTypesForOperation("create");

  server.registerTool(
    "harness_create",
    {
      description: "Create a Harness resource. For pipelines/input sets: pass body as a YAML string directly (recommended for complex definitions), or use body.yamlPipeline (YAML string), or body.pipeline (JSON object). For remote pipelines, pass git details in params: external Git (store_type='REMOTE', connector_ref, repo_name, branch, file_path) or Harness Code (store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path). For others: call harness_describe for the body format.",
      inputSchema: {
        resource_type: resourceTypeSchema(creatableTypes).describe("The type of resource to create"),
        body: z.union([
          z.record(z.string(), z.unknown()),
          z.string(),
        ]).describe("The resource definition body. For pipelines: pass a YAML string directly, or an object with yamlPipeline (YAML string) or pipeline (JSON object). For other resources: pass a JSON object"),
        url: z.string().describe("A Harness UI URL — org, project, and supported resource_scope are extracted automatically").optional(),
        resource_scope: resourceScopeSchema,
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        confirm: z.boolean().describe("Set to true to confirm the operation. Required when the client does not support interactive confirmation prompts (e.g. managed MCP).").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional parameters. For external Git pipelines: store_type='REMOTE', connector_ref, repo_name, branch, file_path, commit_msg. For Harness Code pipelines: store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path.").optional(),
      },
      outputSchema: createOutputSchema,
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
        const { params, body, confirm: _confirm, ...rest } = args;
        const coercedBody = typeof body === "string" ? (coerceRecord(body) ?? body) : body;
        const input = applyUrlDefaults({ ...rest, body: coercedBody } as Record<string, unknown>, args.url, { includeResourceScope: true });
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);

        // Validate resource_type and operation before asking user to confirm
        const def = registry.getResource(args.resource_type);
        if (!def.operations.create) {
          return errorResult(`Resource "${args.resource_type}" does not support "create". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const risk = def.operations.create!.operationPolicy.risk;
        const bodyPreview = typeof args.body === "string"
          ? (args.body.length > 500 ? args.body.slice(0, 500) + "\n...(truncated)" : args.body)
          : JSON.stringify(args.body, null, 2);
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_create",
          message: `Create ${args.resource_type}?\n\n${bodyPreview}`,
          risk,
          autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
          callerConfirmed: args.confirm === true,
        });
        if (!elicit.proceed) {
          return errorResult(
            `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
          );
        }

        const result = await registry.dispatch(client, args.resource_type, "create", input, { tool: "harness_create", confirmation: elicit.method });
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
