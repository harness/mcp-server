import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { fieldCopy } from "./field-copy.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString } from "../utils/type-guards.js";
import type { DiagnoseHandler, DiagnoseContext } from "./diagnose/types.js";
import { pipelineHandler } from "./diagnose/pipeline.js";
import { connectorHandler } from "./diagnose/connector.js";
import { delegateHandler } from "./diagnose/delegate.js";
import { gitopsApplicationHandler } from "./diagnose/gitops-application.js";
import { orgIdField, projectIdField } from "./input-schemas.js";
import { diagnoseOutputSchema, compactOutputSchema } from "./output-schemas.js";

const ALIASES: Record<string, string> = { execution: "pipeline", gitops_app: "gitops_application" };

const handlers: Record<string, DiagnoseHandler> = {
  pipeline: pipelineHandler,
  connector: connectorHandler,
  delegate: delegateHandler,
  gitops_application: gitopsApplicationHandler,
};

const SUPPORTED_TYPES = Object.keys(handlers).join(", ");
// Enum built from handler keys + aliases (e.g. "execution" → "pipeline") so the
// agent sees only the resource types that actually have diagnostic logic.
const DIAGNOSE_TYPES = [...Object.keys(handlers), ...Object.keys(ALIASES)] as [string, ...string[]];

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.registerTool(
    "harness_diagnose",
    {
      description: `Diagnose a Harness resource — analyze failures, test connectivity, check health, or troubleshoot GitOps sync issues. Defaults to pipeline execution diagnosis. Accepts a Harness URL to auto-detect the resource type. When a TYPESAFE_API_KEY is configured, pipeline failures additionally include an advisory "triage" field classifying each failed step (category: infra_flake, test_failure, config_error, dependency_failure, permission_error, timeout; plus confidence) — failure messages, delegate info, and fetched log snippets are sent to the configured TypeSafe API to produce it; the field is omitted when the key is absent, triage is disabled, or classification times out or is low-confidence.`,
      inputSchema: {
        resource_type: z.enum(DIAGNOSE_TYPES).optional().describe("Resource type to diagnose. Auto-detected from url if provided. Defaults to pipeline."),
        resource_id: z.string().optional().describe("Primary identifier of the resource (connector ID, delegate name). Auto-detected from url if provided."),
        url: z.string().optional().describe("A Harness URL — resource type, org, project, and ID are extracted automatically"),
        org_id: orgIdField(registry.orgId, registry.compactSchemas),
        project_id: projectIdField(registry.projectId, registry.compactSchemas),
        options: z.record(z.string(), z.unknown()).optional().describe(fieldCopy("diagnose.options", registry.schemaProfile)),
      },
      outputSchema: compactOutputSchema(diagnoseOutputSchema, registry.compactSchemas),
      annotations: {
        title: "Diagnose Harness Resource",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args, extra) => {
      try {
        const { options, ...rest } = args;
        const input = applyUrlDefaults(rest as Record<string, unknown>, args.url);
        // Spread resource-specific options into input (for dispatch) and merged args (for handler logic)
        const mergedArgs: Record<string, unknown> = { ...rest };
        if (options) {
          Object.assign(input, options);
          Object.assign(mergedArgs, options);
        }

        // Resolve resource_type: explicit > URL-derived > default.
        // Fold case and hyphens, then the diagnose aliases, then the registry near-miss
        // map so "pipelines" reaches the pipeline handler instead of "not supported".
        let resourceType = asString(args.resource_type)
          ?? asString(input.resource_type)
          ?? "pipeline";
        const folded = resourceType.trim().toLowerCase().replace(/[\s-]+/g, "_");
        resourceType = ALIASES[folded] ?? folded;
        if (!handlers[resourceType]) {
          try {
            const canonical = registry.getResource(folded).resourceType;
            if (canonical) resourceType = ALIASES[canonical] ?? canonical;
          } catch {
            // Unknown to the registry. The handler check below names the diagnose types.
          }
        }

        const handler = handlers[resourceType];
        if (!handler) {
          return errorResult(
            `Diagnosis not supported for resource_type '${resourceType}'. Supported: ${SUPPORTED_TYPES}`,
          );
        }

        const ctx: DiagnoseContext = { client, registry, config, input, args: mergedArgs, extra, signal: extra.signal };
        const result = await handler.diagnose(ctx);

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
