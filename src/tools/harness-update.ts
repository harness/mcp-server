import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { logAudit } from "../utils/logger.js";
import { confirmViaElicitation } from "../utils/elicitation.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, isRecord } from "../utils/type-guards.js";

export function registerUpdateTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  const updatableTypes = registry.getTypesForOperation("update") as [string, ...string[]];

  server.registerTool(
    "harness_update",
    {
      description: "Update an existing Harness resource. For pipelines/input sets: pass body as a YAML string directly (recommended for complex definitions), or use body.yamlPipeline/body.pipeline. You can pass a Harness URL to auto-extract identifiers. Response includes openInHarness link to the updated resource when applicable.",
      inputSchema: {
        resource_type: z.enum(updatableTypes).describe("The type of resource to update"),
        resource_id: z.string().describe("The identifier of the resource to update"),
        url: z.string().describe("A Harness UI URL — org, project, resource type, and ID are extracted automatically").optional(),
        body: z.union([
          z.record(z.string(), z.unknown()),
          z.string(),
        ]).describe("The updated resource definition body. For pipelines: pass a YAML string directly, or an object with yamlPipeline (YAML string) or pipeline (JSON object)"),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers (e.g. pipeline_id for triggers/input sets, version_label for templates).").optional(),
      },
      annotations: {
        title: "Update Harness Resource",
        readOnlyHint: false,
        destructiveHint: false,
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

        const blockWithoutConfirmation = !!def.operations.update?.blockWithoutConfirmation;
        const bodyPreview = typeof args.body === "string"
          ? (args.body.length > 500 ? args.body.slice(0, 500) + "\n...(truncated)" : args.body)
          : JSON.stringify(args.body, null, 2);
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_update",
          message: `Update ${args.resource_type} "${args.resource_id}"?\n\n${bodyPreview}`,
          destructive: blockWithoutConfirmation,
        });
        if (!elicit.proceed) {
          return errorResult(`Operation ${elicit.reason} by user.`);
        }
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        if (params) Object.assign(input, params);
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

        const result = await registry.dispatch(client, args.resource_type, "update", input);
        logAudit({ operation: "update", resource_type: args.resource_type, resource_id: args.resource_id, org_id: input.org_id as string, project_id: input.project_id as string, outcome: "success" });
        return jsonResult(result);
      } catch (err) {
        logAudit({ operation: "update", resource_type: args.resource_type, resource_id: args.resource_id, outcome: "error", error: String(err) });
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
