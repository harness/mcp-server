import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError, enrichErrorWithHint, HarnessApiError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString, coerceRecord } from "../utils/type-guards.js";
import { resolveLogContent, resolveLogDownloadUrl } from "../utils/log-resolver.js";
import { buildLogPrefixFromExecution } from "../utils/log-prefix.js";
import type { SearchManager } from "../search/index.js";
import { buildResourceIndexContent } from "../search/embedding-content.js";
import { buildEntityDocumentId, buildEntityMetadata, resolveEntityScope } from "../search/entity-index.js";
import { orgIdField, projectIdField, resourceScopeField, resourceTypeSchema } from "./input-schemas.js";
import { getOutputSchema, compactOutputSchema } from "./output-schemas.js";
import { canonicalizeResourceTypes } from "../utils/canonical-resource-type.js";

function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

export function registerGetTool(server: McpServer, registry: Registry, client: HarnessClient, searchManager?: SearchManager): void {
  const gettableTypes = registry.getTypesForOperation("get");

  server.registerTool(
    "harness_get",
    {
      description: "Get a Harness resource by ID. Accepts a Harness URL to auto-extract identifiers. For failure analysis, prefer harness_diagnose.",
      inputSchema: {
        resource_type: resourceTypeSchema(gettableTypes, registry.compactSchemas).optional().describe("Resource type to retrieve. Auto-detected from url."),
        resource_id: z.string().optional().describe("Primary resource identifier. Auto-detected from url."),
        url: z.string().optional().describe("Harness UI URL — auto-extracts org, project, type, and ID"),
        resource_scope: resourceScopeField(registry.compactSchemas),
        org_id: orgIdField(registry.orgId, registry.compactSchemas),
        project_id: projectIdField(registry.projectId, registry.compactSchemas),
        params: z.record(z.string(), z.unknown()).optional().describe("Additional identifiers for nested resources. Call harness_describe for fields per resource_type."),
        return_download_url: z.union([z.boolean(), z.enum(["true", "false"])]).optional().describe("For execution_log only: return a directly fetchable log download URL instead of buffering log content."),
      },
      outputSchema: compactOutputSchema(getOutputSchema, registry.compactSchemas),
      annotations: {
        title: "Get Harness Resource",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (rawArgs) => {
      const args = canonicalizeResourceTypes(registry, rawArgs);
      try {
        const { params, ...rest } = args;
        const coercedParams = coerceRecord(params);
        // Merge params in before URL defaults so explicit identifiers (e.g. FME's
        // workspace_id, passed via params) are visible to applyUrlDefaults's
        // legacy-vs-URL-scope precedence check, not just top-level named args.
        const argsForUrlDefaults = coercedParams ? { ...rest, ...coercedParams } : rest;
        const input = applyUrlDefaults(argsForUrlDefaults as Record<string, unknown>, args.url, { includeResourceScope: true });
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
        // For execution_log, resource_id is the execution ID — map it to
        // execution_id so buildLogPrefixFromExecution resolves the real log key
        // from the execution graph.  Don't map it to "prefix" (the identifier
        // field) because a raw execution ID is not a valid log-service prefix.
        if (resourceType === "execution_log" && resourceId && !asString(input.execution_id)) {
          input.execution_id = resourceId;
        }
        const shouldMapResourceId =
          primaryField &&
          resourceId &&
          input[primaryField] === undefined &&
          resourceType !== "execution_log";
        if (shouldMapResourceId) {
          input[primaryField] = resourceId;
        }

        // When fetching a global template, override accountIdentifier to the global account.
        if (resourceType === "template" && (input.global === true || input.global === "true")) {
          input.account_id = "__GLOBAL_TEMPLATES_ACCOUNT_ID__";
          delete input.global;
        }

        // execution_log: preserve legacy content by default; opt into URL-only mode with return_download_url=true.
        if (resourceType === "execution_log") {
          try {
            let prefix = asString(input.prefix);
            // unitProgresses / logKeys from the execution graph — only available when
            // we resolve via execution_id. Explicit prefix falls back to Execute only.
            let commandUnitNames: string[] | undefined;
            let logKeys: string[] | undefined;
            // GET /blob reads one exact key; without a step the resolved key is a
            // pipeline/stage prefix whose own blob is empty, so use the zip download.
            let downloadFallback = false;
            if (!prefix) {
              // Auto-build prefix from execution_id if available
              const executionId = asString(input.execution_id);
              if (!executionId) {
                return errorResult("prefix or execution_id is required for execution_log. Provide a log prefix or an execution ID to auto-build it.");
              }
              const resolved = await buildLogPrefixFromExecution(client, registry, executionId, input);
              prefix = resolved.prefix;
              commandUnitNames = resolved.commandUnitNames;
              logKeys = resolved.logKeys;
              downloadFallback = !asString(input.step_id);
            }
            if (isTrue(input.return_download_url) || downloadFallback) {
              const downloadUrl = await resolveLogDownloadUrl(client, prefix);
              if (!isTrue(input.return_download_url)) {
                return jsonResult({
                  download_url: downloadUrl,
                  note: "No step_id given, so returning a zip of all logs under this execution. Pass step_id (and stage_id) to get that step's log text inline.",
                });
              }
              return jsonResult({ download_url: downloadUrl });
            }
            const logText = await resolveLogContent(client, prefix, {
              commandUnitNames,
              logKeys,
              mode: "full",
            });
            return jsonResult({ log_content: logText });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return errorResult(`Failed to resolve execution logs: ${msg}. Try harness_diagnose with include_logs=true for better failure analysis.`);
          }
        }

        const result = await registry.dispatch(client, resourceType, "get", input);

        // Fire-and-forget: index item for semantic search (skipped in multi-user + local)
        if (searchManager && result && typeof result === "object") {
          const item = result as Record<string, unknown>;
          const identifier = asString(item["identifier"]) ?? asString(item["id"]);
          const accountId = client.account;
          if (identifier) {
            const entityScope = resolveEntityScope(registry, resourceType, input);
            void searchManager.indexItem({
              id: buildEntityDocumentId(accountId, resourceType, identifier, entityScope),
              content: buildResourceIndexContent(resourceType, item),
              corpus: "entities",
              accountId,
              metadata: buildEntityMetadata(resourceType, identifier, String(item["name"] ?? ""), entityScope),
            }).catch(() => { /* never surface indexing errors */ });
          }
        }

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
