import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import type { DiagnoseHandler, DiagnoseContext } from "./diagnose/types.js";
import { pipelineHandler } from "./diagnose/pipeline.js";
import { connectorHandler } from "./diagnose/connector.js";
import { delegateHandler } from "./diagnose/delegate.js";

const ALIASES: Record<string, string> = { execution: "pipeline" };

const handlers: Record<string, DiagnoseHandler> = {
  pipeline: pipelineHandler,
  connector: connectorHandler,
  delegate: delegateHandler,
};

const SUPPORTED_TYPES = Object.keys(handlers).join(", ");

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.tool(
    "harness_diagnose",
    `Diagnose a Harness resource — analyze failures, test connectivity, or check health. Supported resource_types: ${SUPPORTED_TYPES}. Defaults to pipeline execution diagnosis. Accepts a Harness URL to auto-detect the resource type.`,
    {
      resource_type: z.string().describe(`Resource type to diagnose: ${SUPPORTED_TYPES}. Auto-detected from url if provided. Defaults to pipeline.`).optional(),
      resource_id: z.string().describe("Primary identifier of the resource (connector ID, delegate name). Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness URL — resource type, org, project, and ID are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      // Pipeline-specific params (ignored for other resource types)
      execution_id: z.string().describe("[pipeline] The execution ID to analyze. Auto-detected from url.").optional(),
      pipeline_id: z.string().describe("[pipeline] Pipeline identifier — fetches latest execution when no execution_id given.").optional(),
      summary: z.boolean().describe("[pipeline] Structured summary (default true). Set false for raw diagnostic data.").default(true).optional(),
      include_yaml: z.boolean().describe("[pipeline] Include pipeline YAML. Default: false in summary, true in raw mode.").optional(),
      include_logs: z.boolean().describe("[pipeline] Include step logs. Default: false in summary, true in raw mode.").optional(),
      log_snippet_lines: z.number().describe("[pipeline] Max log lines per step (tail). 0 = unlimited.").default(120).optional(),
      max_failed_steps: z.number().describe("[pipeline] Max failed steps to fetch logs for. 0 = unlimited.").default(5).optional(),
    },
    async (args, extra) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);

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

        const ctx: DiagnoseContext = { client, registry, config, input, args: args as Record<string, unknown>, extra };
        const result = await handler.diagnose(ctx);
        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
