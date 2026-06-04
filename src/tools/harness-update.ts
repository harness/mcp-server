import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord, coerceRecord } from "../utils/type-guards.js";
import { resourceScopeSchema, resourceTypeSchema } from "./input-schemas.js";
import { updateOutputSchema } from "./output-schemas.js";

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient, config?: Config): void {
  const updatableTypes = registry.getTypesForOperation("update");

  server.registerTool(
    "harness_update",
    {
      description: "Update an existing Harness resource. For pipelines/input sets: pass body as a YAML string directly (recommended for complex definitions), or use body.yamlPipeline/body.pipeline. You can pass a Harness URL to auto-extract identifiers. Response includes openInHarness link to the updated resource when applicable.",
      inputSchema: {
        resource_type: resourceTypeSchema(updatableTypes).describe("The type of resource to update"),
        resource_id: z.string().describe("The identifier of the resource to update"),
        url: z.string().describe("A Harness UI URL — org, project, resource type, ID, and supported resource_scope are extracted automatically").optional(),
        resource_scope: resourceScopeSchema,
        body: z.union([
          z.record(z.string(), z.unknown()),
          z.string(),
        ]).describe("The updated resource definition body. For pipelines: pass a YAML string directly, or an object with yamlPipeline (YAML string) or pipeline (JSON object)"),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        confirm: z.boolean().describe("Set to true to confirm the operation. Required when the client does not support interactive confirmation prompts (e.g. managed MCP).").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers (e.g. pipeline_id for triggers/input sets, version_label for templates).").optional(),
      },
      outputSchema: updateOutputSchema,
      annotations: {
        title: "Update Harness Resource",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        // Validate resource_type and operation before asking user to confirm
        const def = registry.getResource(args.resource_type);
        if (!def.operations.update) {
          return errorResult(`Resource "${args.resource_type}" does not support "update". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const risk = def.operations.update!.operationPolicy.risk;
        const bodyPreview = typeof args.body === "string"
          ? (args.body.length > 500 ? args.body.slice(0, 500) + "\n...(truncated)" : args.body)
          : JSON.stringify(args.body, null, 2);
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_update",
          message: `Update ${args.resource_type} "${args.resource_id}"?\n\n${bodyPreview}`,
          risk,
          autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
          callerConfirmed: args.confirm === true,
        });
        if (!elicit.proceed) {
          return errorResult(
            `Operation ${elicit.reason} by user. Hint: if your client does not support interactive confirmation, pass confirm: true to proceed.`,
          );
        }
        const { params, body, confirm: _confirm, ...rest } = args;
        const coercedBody = typeof body === "string" ? (coerceRecord(body) ?? body) : body;
        const input = applyUrlDefaults({ ...rest, body: coercedBody } as Record<string, unknown>, args.url, { includeResourceScope: true });
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);
        const identFields = def.identifierFields;
        const primaryField = identFields.length > 1
          ? identFields[identFields.length - 1]!
          : identFields[0];
        if (primaryField && args.resource_id) {
          input[primaryField] = args.resource_id;
        }
        const versionLabel = asString(input.version_label);
        if (versionLabel) { /* already set via params */ }
        else if (isRecord(args.body) && "version_label" in args.body) {
          input.version_label = args.body.version_label;
        } else if (args.resource_type === "template") {
          input.version_label = "v1";
        }

        const result = await registry.dispatch(client, args.resource_type, "update", input, { tool: "harness_update", confirmation: elicit.method, resource_id: args.resource_id });
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
