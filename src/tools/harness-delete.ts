import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { coerceRecord, asString } from "../utils/type-guards.js";
import { resourceScopeSchema, resourceTypeSchema } from "./input-schemas.js";
import { deleteOutputSchema } from "./output-schemas.js";

export function registerDeleteTool(server: McpServer, registry: Registry, client: HarnessClient, config?: Config): void {
  const deletableTypes = registry.getTypesForOperation("delete");

  server.registerTool(
    "harness_delete",
    {
      description: "Delete a Harness resource. You can pass a Harness URL to auto-extract identifiers. This is destructive and cannot be undone.",
      inputSchema: {
        resource_type: resourceTypeSchema(deletableTypes).describe("The type of resource to delete"),
        resource_id: z.string().describe("The identifier of the resource to delete"),
        url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
        resource_scope: resourceScopeSchema,
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers for nested resources (e.g. pipeline_id for triggers/input sets, environment_id for infrastructure).").optional(),
      },
      outputSchema: deleteOutputSchema,
      annotations: {
        title: "Delete Harness Resource",
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
        if (!def.operations.delete) {
          return errorResult(`Resource "${args.resource_type}" does not support "delete". Supported: ${Object.keys(def.operations).join(", ")}`);
        }

        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_delete",
          message: `Delete ${args.resource_type} "${args.resource_id}"?\n\nThis is destructive and cannot be undone.`,
          risk: "destructive",
          autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);
        const identFields = def.identifierFields;
        const primaryField = identFields.length > 1
          ? identFields[identFields.length - 1]!
          : identFields[0];
        if (primaryField && args.resource_id) {
          input[primaryField] = args.resource_id;
        }

        const result = await registry.dispatch(client, args.resource_type, "delete", input, { tool: "harness_delete", confirmation: elicit.method, resource_id: args.resource_id });

        const payload: Record<string, unknown> = {
          deleted: true,
          resource_type: args.resource_type,
          resource_id: args.resource_id,
        };
        const versionLabel = asString(input.version_label);
        if (versionLabel) payload.version_label = versionLabel;
        if (typeof result === "object" && result !== null && !Array.isArray(result) && Object.keys(result).length > 0) {
          payload.details = result;
        }
        return jsonResult(payload);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
