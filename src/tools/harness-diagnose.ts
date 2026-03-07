import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { sendProgress } from "../utils/progress.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

const log = createLogger("diagnose");

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient): void {
  server.tool(
    "harness_diagnose",
    "Diagnose a pipeline execution failure. You can pass a Harness execution URL to auto-extract the execution ID, org, and project. Aggregates execution details, pipeline YAML, and execution logs into a single diagnostic payload.",
    {
      execution_id: z.string().describe("The pipeline execution ID to diagnose. Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness execution URL — execution ID, org, and project are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      include_yaml: z.boolean().describe("Include the full pipeline YAML definition").default(true).optional(),
      include_logs: z.boolean().describe("Include execution step logs").default(true).optional(),
    },
    async (args, extra) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        const executionId = input.execution_id as string | undefined;
        if (!executionId) {
          return errorResult("execution_id is required. Provide it explicitly or via a Harness execution URL.");
        }
        const diagnostic: Record<string, unknown> = {};
        const totalSteps = 1 + (args.include_yaml !== false ? 1 : 0) + (args.include_logs !== false ? 1 : 0);
        let step = 0;

        // 1. Get execution details
        await sendProgress(extra, step, totalSteps, "Fetching execution details...");
        log.info("Fetching execution details", { executionId });
        try {
          const execution = await registry.dispatch(client, "execution", "get", input);
          diagnostic.execution = execution;

          // Extract pipeline ID from execution if available
          const exec = execution as Record<string, unknown>;
          const pipelineExec = exec?.pipelineExecutionSummary as Record<string, unknown> | undefined;
          const pipelineId = pipelineExec?.pipelineIdentifier as string | undefined;

          step++;

          // 2. Get pipeline YAML if requested and pipeline ID available
          if (args.include_yaml !== false && pipelineId) {
            await sendProgress(extra, step, totalSteps, "Fetching pipeline YAML...");
            try {
              const pipeline = await registry.dispatch(client, "pipeline", "get", {
                ...input,
                pipeline_id: pipelineId,
              });
              diagnostic.pipeline = pipeline;
            } catch (err) {
              log.warn("Failed to fetch pipeline YAML", { error: String(err) });
              diagnostic.pipeline_error = String(err);
            }
          }
        } catch (err) {
          diagnostic.execution_error = String(err);
        }

        // 3. Get execution logs if requested
        if (args.include_logs !== false) {
          step++;
          await sendProgress(extra, step, totalSteps, "Fetching execution logs...");
          try {
            const logs = await registry.dispatch(client, "execution_log", "get", input);
            diagnostic.logs = logs;
          } catch (err) {
            log.warn("Failed to fetch execution logs", { error: String(err) });
            diagnostic.logs_error = String(err);
          }
        }

        await sendProgress(extra, totalSteps, totalSteps, "Diagnosis complete");
        return jsonResult(diagnostic);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
