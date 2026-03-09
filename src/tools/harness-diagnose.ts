import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import type { DiagnoseHandler, DiagnoseContext } from "./diagnose/types.js";
import { pipelineHandler } from "./diagnose/pipeline.js";
import { connectorHandler } from "./diagnose/connector.js";
import { delegateHandler } from "./diagnose/delegate.js";
import { gitopsApplicationHandler } from "./diagnose/gitops-application.js";

const ALIASES: Record<string, string> = { execution: "pipeline", gitops_app: "gitops_application" };

const handlers: Record<string, DiagnoseHandler> = {
  pipeline: pipelineHandler,
  connector: connectorHandler,
  delegate: delegateHandler,
  gitops_application: gitopsApplicationHandler,
};

const SUPPORTED_TYPES = Object.keys(handlers).join(", ");

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.registerTool(
    "harness_diagnose",
    {
      description: `Diagnose a Harness resource — analyze failures, test connectivity, check health, or troubleshoot GitOps sync issues. Supported resource_types: ${SUPPORTED_TYPES}. Defaults to pipeline execution diagnosis. Accepts a Harness URL to auto-detect the resource type.`,
      inputSchema: {
        resource_type: z.string().describe(`Resource type to diagnose: ${SUPPORTED_TYPES}. Auto-detected from url if provided. Defaults to pipeline.`).optional(),
        resource_id: z.string().describe("Primary identifier of the resource (connector ID, delegate name). Auto-detected from url if provided.").optional(),
        url: z.string().describe("A Harness URL — resource type, org, project, and ID are extracted automatically").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        options: z.record(z.string(), z.unknown()).describe("Resource-specific diagnostic options. Pipeline: execution_id, pipeline_id, summary, include_yaml, include_logs, log_snippet_lines, max_failed_steps. GitOps: agent_id. Call harness_describe for details.").optional(),
      },
      annotations: {
        title: "Diagnose Harness Resource",
        readOnlyHint: true,
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
        let resourceType = (args.resource_type as string)
          ?? (input.resource_type as string)
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
