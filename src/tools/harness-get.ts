import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, enrichErrorWithHint, HarnessApiError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, coerceRecord } from "../utils/type-guards.js";
import { resolveLogContent } from "../utils/log-resolver.js";
import { buildLogPrefixFromExecution } from "../utils/log-prefix.js";

export function registerGetTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  const gettableTypes = registry.getTypesForOperation("get") as [string, ...string[]];

  server.registerTool(
    "harness_get",
    {
      description: "Get a Harness resource by ID. Accepts a Harness URL to auto-extract identifiers. For failure analysis, prefer harness_diagnose.",
      inputSchema: {
        resource_type: z.enum(gettableTypes).describe("Resource type to retrieve. Auto-detected from url.").optional(),
        resource_id: z.string().describe("Primary resource identifier. Auto-detected from url.").optional(),
        url: z.string().describe("Harness UI URL — auto-extracts org, project, type, and ID").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        params: z.record(z.string(), z.unknown()).describe("Additional identifiers for nested resources. Call harness_describe for fields per resource_type.").optional(),
      },
      annotations: {
        title: "Get Harness Resource",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const { params, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        const coercedParams = coerceRecord(params);
        if (coercedParams) Object.assign(input, coercedParams);
        const resourceType = asString(input.resource_type);
        if (!resourceType) {
          return errorResult("resource_type is required. Provide it explicitly or via a Harness URL.");
        }
        const resourceId = asString(input.resource_id);

        const def = registry.getResource(resourceType);

        // Map resource_id to the resource's own identifier field.
        // For multi-identifier resources (e.g. pull_request: ["repo_id", "pr_number"]),
        // the last field is the resource-specific ID; earlier fields are parent context
        // (like repo_id) that come from URL parsing or explicit params.
        const identFields = def.identifierFields;
        const primaryField = identFields.length > 1
          ? identFields[identFields.length - 1]!
          : identFields[0];
        const shouldMapResourceId =
          primaryField &&
          resourceId &&
          !input[primaryField] &&
          !(resourceType === "execution_log" && asString(input.execution_id));
        if (shouldMapResourceId) {
          input[primaryField] = resourceId;
        }

        // execution_log: resolve full log content instead of returning a download URL
        if (resourceType === "execution_log") {
          try {
            let prefix = asString(input.prefix);
            if (!prefix) {
              // Auto-build prefix from execution_id if available
              const executionId = asString(input.execution_id);
              if (!executionId) {
                return errorResult("prefix or execution_id is required for execution_log. Provide a log prefix or an execution ID to auto-build it.");
              }
              prefix = await buildLogPrefixFromExecution(client, registry, executionId, input);
            }
            const logText = await resolveLogContent(client, prefix);
            return jsonResult({ log_content: logText });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return errorResult(`Failed to fetch execution logs: ${msg}. Try harness_diagnose with include_logs=true for better failure analysis.`);
          }
        }

        const result = await registry.dispatch(client, resourceType, "get", input);
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) {
          const rt = asString(args.resource_type);
          let hint: string | undefined;
          if (err instanceof HarnessApiError && err.statusCode === 404 && rt) {
            try { hint = registry.getResource(rt).diagnosticHint; } catch { /* unknown type */ }
          }
          return errorResult(enrichErrorWithHint(err.message, hint));
        }
        throw toMcpError(err);
      }
    },
  );
}
