import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult, mixedResult } from "../utils/response-formatter.js";
import { toExecutionSummaryData, renderTimelineSvg, renderStageFlowSvg, parsePipelineYaml, renderArchitectureSvg } from "../utils/svg/index.js";
import { asRecord } from "../utils/type-guards.js";
import { createLogger } from "../utils/logger.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";
import { applyUrlDefaults } from "../utils/url-parser.js";
import { asString } from "../utils/type-guards.js";
import type { DiagnoseHandler, DiagnoseContext } from "./diagnose/types.js";
import { pipelineHandler } from "./diagnose/pipeline.js";
import { connectorHandler } from "./diagnose/connector.js";
import { delegateHandler } from "./diagnose/delegate.js";
import { gitopsApplicationHandler } from "./diagnose/gitops-application.js";

const logDiag = createLogger("diagnose");

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
        resource_type: z.enum(DIAGNOSE_TYPES).describe("Resource type to diagnose. Auto-detected from url if provided. Defaults to pipeline.").optional(),
        resource_id: z.string().describe("Primary identifier of the resource (connector ID, delegate name). Auto-detected from url if provided.").optional(),
        url: z.string().describe("A Harness URL — resource type, org, project, and ID are extracted automatically").optional(),
        org_id: z.string().describe("Organization identifier (overrides default)").optional(),
        project_id: z.string().describe("Project identifier (overrides default)").optional(),
        options: z.record(z.string(), z.unknown()).describe("Resource-specific diagnostic options. Pipeline: execution_id, pipeline_id, summary, include_yaml, include_logs, log_snippet_lines, max_failed_steps, include_visual (boolean, include PNG image inline), visual_type ('timeline'|'flow'|'architecture', default 'timeline' — 'architecture' renders full pipeline YAML as multi-level diagram with stages, step groups, steps, rollback), visual_width (number, default 900). When a Harness URL contains ?step=<nodeExecutionId>, setting include_logs:true fetches that specific step's log regardless of pass/fail status and returns it as requested_step_log alongside any failed_step_logs. GitOps: agent_id. Call harness_describe for details.").optional(),
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

        // Visual rendering (opt-in)
        if (mergedArgs.include_visual === true && resourceType === "pipeline") {
          try {
            const visualType = String(mergedArgs.visual_type ?? "timeline");
            const visualWidth = typeof mergedArgs.visual_width === "number" ? mergedArgs.visual_width : 900;

            // Auto-detect: if pipeline YAML is in the result, render architecture diagram
            // regardless of visual_type (architecture is always more informative when YAML is available)
            const pipelineData = asRecord(result.pipeline);
            let archSvg: string | null = null;

            if (pipelineData?.yamlPipeline && typeof pipelineData.yamlPipeline === "string") {
              const YAML = await import("yaml");
              const parsed = parsePipelineYaml(YAML.parse(pipelineData.yamlPipeline));
              if (parsed) archSvg = renderArchitectureSvg(parsed, { width: visualWidth });
            }

            // If no YAML in result and visual_type is architecture, try fetching it
            if (!archSvg && (visualType === "architecture" || visualType === "flow")) {
              const pipelineId = asString(mergedArgs.pipeline_id) ?? asString(input.pipeline_id);
              if (pipelineId) {
                try {
                  const pipelineResp = await registry.dispatch(client, "pipeline", "get", { ...input, pipeline_id: pipelineId }, extra.signal);
                  const resp = asRecord(pipelineResp);
                  if (resp?.yamlPipeline && typeof resp.yamlPipeline === "string") {
                    const YAML = await import("yaml");
                    const parsed = parsePipelineYaml(YAML.parse(resp.yamlPipeline));
                    if (parsed) archSvg = renderArchitectureSvg(parsed, { width: visualWidth });
                  }
                } catch (err) {
                  logDiag.warn("Failed to fetch pipeline for architecture diagram", { error: String(err) });
                }
              }
            }

            if (archSvg) {
              return await mixedResult(result, archSvg);
            }

            // Fallback: timeline or flow from execution data
            const summaryData = toExecutionSummaryData(result);
            if (summaryData) {
              const hasSteps = summaryData.stages.some((s) => s.steps.length > 0);
              const svg = visualType === "flow"
                ? renderStageFlowSvg(summaryData, { width: visualWidth })
                : renderTimelineSvg(summaryData, { width: visualWidth, showSteps: hasSteps });
              return await mixedResult(result, svg);
            }
          } catch (err) {
            logDiag.warn("SVG rendering failed, returning text-only", { error: String(err) });
          }
        }

        return jsonResult(result);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
