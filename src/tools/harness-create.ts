import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation, describeElicitationFailure } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { coerceRecord } from "../utils/type-guards.js";
import { formatBodyPreview } from "../utils/body-preview.js";
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
        url: z.string().optional().describe("A Harness UI URL — org, project, and supported resource_scope are extracted automatically"),
        resource_scope: resourceScopeSchema,
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        confirm: z.boolean().optional().describe("Set to true to confirm the operation. Only required when the operation risk is medium_write or above (most write resources) AND the client cannot surface a confirmation prompt — e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Has no effect for low-risk creates. Does NOT override an explicit decline from a client that completed an elicitation prompt — a user's decline is authoritative."),
        params: z.record(z.string(), z.unknown()).optional().describe("Additional parameters. For external Git pipelines: store_type='REMOTE', connector_ref, repo_name, branch, file_path, commit_msg. For Harness Code pipelines: store_type='REMOTE', is_harness_code_repo=true, repo_name, branch, file_path."),
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
        const bodyPreview = formatBodyPreview(args.body);
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_create",
          message: `Create ${args.resource_type}?\n\n${bodyPreview}`,
          risk,
          autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
          callerConfirmed: args.confirm === true,
        });
        if (!elicit.proceed) {
          registry.auditBlockedAttempt(
            args.resource_type,
            "create",
            input,
            { tool: "harness_create", confirmation: "blocked" },
            `Operation ${elicit.reason} by user (${elicit.method})`,
          );
          return errorResult(describeElicitationFailure(elicit));
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
