import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString } from "../utils/type-guards.js";
import type { DiagnoseHandler, DiagnoseContext } from "./diagnose/types.js";
import { pipelineHandler } from "./diagnose/pipeline.js";
import { connectorHandler } from "./diagnose/connector.js";
import { delegateHandler } from "./diagnose/delegate.js";
import { gitopsApplicationHandler } from "./diagnose/gitops-application.js";
import { diagnoseOutputSchema } from "./output-schemas.js";

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
      description: `Diagnose a Harness resource — analyze failures, test connectivity, check health, or troubleshoot GitOps sync issues. Defaults to pipeline execution diagnosis. Accepts a Harness URL to auto-detect the resource type.`,
      inputSchema: {
        resource_type: z.enum(DIAGNOSE_TYPES).optional().describe("Resource type to diagnose. Auto-detected from url if provided. Defaults to pipeline."),
        resource_id: z.string().optional().describe("Primary identifier of the resource (connector ID, delegate name). Auto-detected from url if provided."),
        url: z.string().optional().describe("A Harness URL — resource type, org, project, and ID are extracted automatically"),
        org_id: z.string().optional().describe("Organization identifier (overrides default)"),
        project_id: z.string().optional().describe("Project identifier (overrides default)"),
        options: z.record(z.string(), z.unknown()).optional().describe("Resource-specific diagnostic options. Pipeline: execution_id, pipeline_id, summary, include_yaml, include_logs, return_download_url (boolean, return signed logs.zip URLs instead of inline log text), log_snippet_lines, max_failed_steps. When a Harness URL contains ?step=<nodeExecutionId>, setting include_logs:true fetches that specific step's log regardless of pass/fail status and returns it as requested_step_log alongside any failed_step_logs. GitOps: agent_id. Call harness_describe for details."),
      },
      outputSchema: diagnoseOutputSchema,
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

        // Resolve resource_type: explicit > URL-derived > default
        let resourceType = asString(args.resource_type)
          ?? asString(input.resource_type)
          ?? "pipeline";
        resourceType = ALIASES[resourceType] ?? resourceType;

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
