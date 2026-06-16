import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { confirmViaElicitation, describeElicitationFailure, describeBlockedAudit } from "../utils/elicitation.js";
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
        resource_id: z.string().optional().describe("The identifier of the resource to delete. Optional when url contains the resource ID."),
        url: z.string().optional().describe("A Harness UI URL — org, project, resource type, ID, and supported resource_scope are extracted automatically"),
        resource_scope: resourceScopeSchema,
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        confirm: z.boolean().optional().describe("Set to true to confirm the destructive operation. Required when the client cannot surface a confirmation prompt — e.g. managed MCP that does not advertise elicitation, or an elicitation that fails at runtime. Does NOT override an explicit decline from a client that completed an elicitation prompt — a user's decline is authoritative."),
        params: z.record(z.string(), z.unknown()).optional().describe("Additional identifiers for nested resources (e.g. pipeline_id for triggers/input sets, environment_id for infrastructure)."),
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

        const { params, confirm: _confirm, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url, { includeResourceScope: true });
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);
        const identFields = def.identifierFields;
        const primaryField = identFields.length > 1
          ? identFields[identFields.length - 1]!
          : identFields[0];
        const fromResourceId = asString(input.resource_id);
        const fromPrimaryField = primaryField ? asString(input[primaryField]) : undefined;
        if (fromResourceId && fromPrimaryField && fromResourceId !== fromPrimaryField) {
          return errorResult(
            `Conflicting identifiers: resource_id/url gives "${fromResourceId}" but params.${primaryField} gives "${fromPrimaryField}". Provide one or ensure they match.`,
          );
        }
        const resolvedResourceId = fromResourceId ?? fromPrimaryField;
        if (!resolvedResourceId) {
          return errorResult("resource_id is required for harness_delete unless url contains the resource ID or params includes the resource-specific ID field.");
        }
        // Populate the primary identifier on the input map BEFORE any
        // pre-dispatch audit emission so pathBuilder-backed deletes (e.g.
        // template.delete reading input.template_id) resolve a stable
        // http_path on blocked-attempt audit rows instead of throwing or
        // recording a path with empty placeholders.
        if (primaryField) {
          input[primaryField] = resolvedResourceId;
        }

        // Fail fast on HARNESS_READ_ONLY before elicitation — see
        // harness_create.ts for the rationale. Mirrors registry.dispatch().
        if (config?.HARNESS_READ_ONLY) {
          const reason = `Read-only mode is enabled (HARNESS_READ_ONLY=true). "delete" operations are not allowed.`;
          registry.auditBlockedAttempt(
            args.resource_type,
            "delete",
            input,
            { tool: "harness_delete", confirmation: "blocked", resource_id: resolvedResourceId },
            reason,
          );
          return errorResult(reason);
        }
        const elicit = await confirmViaElicitation({
          server,
          toolName: "harness_delete",
          message: `Delete ${args.resource_type} "${resolvedResourceId}"?\n\nThis is destructive and cannot be undone.`,
          risk: "destructive",
          autoApproveRisk: config?.HARNESS_AUTO_APPROVE_RISK,
          callerConfirmed: args.confirm === true,
        });
        if (!elicit.proceed) {
          registry.auditBlockedAttempt(
            args.resource_type,
            "delete",
            input,
            { tool: "harness_delete", confirmation: elicit.method, resource_id: resolvedResourceId },
            describeBlockedAudit(elicit),
          );
          return errorResult(describeElicitationFailure(elicit));
        }

        const result = await registry.dispatch(client, args.resource_type, "delete", input, { tool: "harness_delete", confirmation: elicit.method, resource_id: resolvedResourceId });

        const payload: Record<string, unknown> = {
          deleted: true,
          resource_type: args.resource_type,
          resource_id: resolvedResourceId,
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
