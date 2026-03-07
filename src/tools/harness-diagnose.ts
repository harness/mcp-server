import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { isUserError, toMcpError } from "../utils/errors.js";
import { createLogger } from "../utils/logger.js";
import { sendProgress } from "../utils/progress.js";
import { applyUrlDefaults } from "../utils/url-parser.js";

const log = createLogger("diagnose");

// ─── Execution summary builder ───────────────────────────────────────────────

interface NodeInfo {
  nodeType?: string;
  nodeGroup?: string;
  nodeIdentifier?: string;
  name?: string;
  status?: string;
  startTs?: number;
  endTs?: number;
  stepType?: string;
  failureInfo?: { message?: string };
  edgeLayoutList?: {
    currentNodeChildren?: string[];
    nextIds?: string[];
  };
}

interface StepSummary {
  name: string;
  identifier: string;
  status: string;
  duration_ms?: number;
  duration_human?: string;
  failure_message?: string;
}

interface StageSummary {
  name: string;
  identifier: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  duration_human?: string;
  steps: StepSummary[];
}

interface FailedStepInfo {
  stage_identifier: string;
  step_identifier: string;
  step_name: string;
  failure_message: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function collectSteps(
  layoutNodeMap: Record<string, NodeInfo>,
  nodeId: string,
  steps: StepSummary[],
  visited: Set<string>,
): void {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = layoutNodeMap[nodeId];
  if (!node) return;

  const startTs = node.startTs;
  const endTs = node.endTs;
  const durationMs = startTs && endTs ? endTs - startTs : undefined;

  const step: StepSummary = {
    name: node.name ?? nodeId,
    identifier: node.nodeIdentifier ?? nodeId,
    status: node.status ?? "Unknown",
    duration_ms: durationMs,
    duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
  };

  if (node.failureInfo?.message) {
    step.failure_message = node.failureInfo.message;
  }

  steps.push(step);

  // Recurse into children, then follow nextIds at the same level
  for (const childId of node.edgeLayoutList?.currentNodeChildren ?? []) {
    collectSteps(layoutNodeMap, childId, steps, visited);
  }
  for (const nextId of node.edgeLayoutList?.nextIds ?? []) {
    collectSteps(layoutNodeMap, nextId, steps, visited);
  }
}

function extractStages(layoutNodeMap: Record<string, NodeInfo>, startingNodeId: string): StageSummary[] {
  const stages: StageSummary[] = [];
  const visited = new Set<string>();

  function walkNode(nodeId: string): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = layoutNodeMap[nodeId];
    if (!node) return;

    if (node.nodeGroup === "STAGE") {
      const startTs = node.startTs;
      const endTs = node.endTs;
      const durationMs = startTs && endTs ? endTs - startTs : undefined;

      const steps: StepSummary[] = [];
      const stepVisited = new Set<string>();
      for (const childId of node.edgeLayoutList?.currentNodeChildren ?? []) {
        collectSteps(layoutNodeMap, childId, steps, stepVisited);
      }

      stages.push({
        name: node.name ?? nodeId,
        identifier: node.nodeIdentifier ?? nodeId,
        status: node.status ?? "Unknown",
        started_at: startTs ? new Date(startTs).toISOString() : undefined,
        ended_at: endTs ? new Date(endTs).toISOString() : undefined,
        duration_ms: durationMs,
        duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
        steps,
      });
    } else {
      // Non-stage wrapper (e.g. parallel group) — recurse into children
      for (const childId of node.edgeLayoutList?.currentNodeChildren ?? []) {
        walkNode(childId);
      }
    }

    // Follow next siblings
    for (const nextId of node.edgeLayoutList?.nextIds ?? []) {
      walkNode(nextId);
    }
  }

  walkNode(startingNodeId);
  return stages;
}

/** Extract failed steps with their parent stage identifiers from the summary stages. */
function findFailedSteps(stages: StageSummary[]): FailedStepInfo[] {
  const failed: FailedStepInfo[] = [];
  for (const stage of stages) {
    if (stage.status !== "Failed" && stage.status !== "Errored" && stage.status !== "Aborted") continue;
    for (const step of stage.steps) {
      if (step.failure_message) {
        failed.push({
          stage_identifier: stage.identifier,
          step_identifier: step.identifier,
          step_name: step.name,
          failure_message: step.failure_message,
        });
      }
    }
  }
  return failed;
}

/**
 * Transform the raw execution response into a structured summary report.
 * Falls back to returning the raw data if the expected structure is missing.
 */
function buildExecutionSummary(
  execution: Record<string, unknown>,
  config: Config,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const pes = execution.pipelineExecutionSummary as Record<string, unknown> | undefined;
  if (!pes) return execution;

  const startTs = pes.startTs as number | undefined;
  const endTs = pes.endTs as number | undefined;
  const durationMs = startTs && endTs ? endTs - startTs : undefined;
  const triggerInfo = pes.executionTriggerInfo as Record<string, unknown> | undefined;
  const triggeredBy = triggerInfo?.triggeredBy as Record<string, unknown> | undefined;

  const summary: Record<string, unknown> = {
    pipeline: {
      name: pes.name,
      identifier: pes.pipelineIdentifier,
    },
    execution: {
      id: pes.planExecutionId,
      status: pes.status,
      run_sequence: pes.runSequence,
      trigger_type: triggerInfo?.triggerType,
      triggered_by: triggeredBy?.identifier ?? (triggeredBy?.extraInfo as Record<string, unknown> | undefined)?.email,
    },
    timing: {
      started_at: startTs ? new Date(startTs).toISOString() : undefined,
      ended_at: endTs ? new Date(endTs).toISOString() : undefined,
      duration_ms: durationMs,
      duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
    },
  };

  // Walk layoutNodeMap to extract stages
  const layoutNodeMap = pes.layoutNodeMap as Record<string, NodeInfo> | undefined;
  const startingNodeId = pes.startingNodeId as string | undefined;

  if (layoutNodeMap && startingNodeId) {
    const stages = extractStages(layoutNodeMap, startingNodeId);
    summary.stages = stages;

    // Identify failed stage and step
    const failedStage = stages.find(
      (s) => s.status === "Failed" || s.status === "Errored" || s.status === "Aborted",
    );
    if (failedStage) {
      const failedStep = failedStage.steps.find((s) => s.failure_message);
      summary.failure = {
        stage: failedStage.name,
        step: failedStep?.name,
        error: failedStep?.failure_message,
      };
    }

    // Identify bottleneck (longest completed stage)
    const completedStages = stages.filter((s) => s.duration_ms != null && s.duration_ms > 0);
    if (completedStages.length > 0 && durationMs && durationMs > 0) {
      const bottleneck = completedStages.reduce((a, b) => (a.duration_ms! > b.duration_ms! ? a : b));
      summary.bottleneck = {
        stage: bottleneck.name,
        duration_ms: bottleneck.duration_ms,
        duration_human: bottleneck.duration_human,
        percentage: Math.round((bottleneck.duration_ms! / durationMs) * 100),
      };
    }
  }

  // Build execution deep link
  const orgId = (input.org_id as string) ?? config.HARNESS_DEFAULT_ORG_ID;
  const projectId = (input.project_id as string) ?? config.HARNESS_DEFAULT_PROJECT_ID;
  const pipelineIdentifier = pes.pipelineIdentifier as string | undefined;
  const execId = pes.planExecutionId as string | undefined;
  if (pipelineIdentifier && execId && orgId && projectId) {
    const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
    summary.openInHarness = `${base}/ng/account/${config.HARNESS_ACCOUNT_ID}/all/orgs/${orgId}/projects/${projectId}/pipelines/${pipelineIdentifier}/executions/${execId}/pipeline`;
  } else if (execution.openInHarness) {
    summary.openInHarness = execution.openInHarness;
  }

  return summary;
}

// ─── Tool registration ───────────────────────────────────────────────────────

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.tool(
    "harness_diagnose",
    "Analyze a pipeline execution — returns a structured report with stage breakdown, timing, bottlenecks, and failure info. Accepts an execution_id, a pipeline_id (auto-fetches latest execution), or a Harness URL. Set summary=false for raw diagnostic data with pipeline YAML and execution logs.",
    {
      execution_id: z.string().describe("The pipeline execution ID to analyze. Auto-detected from url if provided.").optional(),
      pipeline_id: z.string().describe("Pipeline identifier — fetches the latest execution automatically when no execution_id is given. Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness execution or pipeline URL — identifiers are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      summary: z.boolean().describe("Return structured summary report (default true). Set to false for raw diagnostic payload with YAML and logs.").default(true).optional(),
      include_yaml: z.boolean().describe("Include pipeline YAML definition. Defaults to false in summary mode, true in diagnostic mode.").optional(),
      include_logs: z.boolean().describe("Include execution step logs. Defaults to false in summary mode, true in diagnostic mode.").optional(),
    },
    async (args, extra) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        let executionId = input.execution_id as string | undefined;
        const pipelineId = input.pipeline_id as string | undefined;
        const isSummary = args.summary !== false;

        // Determine include defaults based on mode
        const includeYaml = args.include_yaml ?? !isSummary;
        const includeLogs = args.include_logs ?? !isSummary;

        // Auto-fetch latest execution if pipeline_id provided without execution_id
        if (!executionId && pipelineId) {
          log.info("Fetching latest execution for pipeline", { pipelineId });
          await sendProgress(extra, 0, 3, "Fetching latest execution...");
          try {
            const execList = await registry.dispatch(client, "execution", "list", {
              ...input,
              pipeline_id: pipelineId,
              size: 1,
              page: 0,
            });
            const items = (execList as { items?: Array<Record<string, unknown>> }).items;
            if (items && items.length > 0) {
              executionId = (items[0].planExecutionId as string) ?? undefined;
              input.execution_id = executionId;
            }
          } catch (err) {
            log.warn("Failed to fetch latest execution", { error: String(err) });
          }
        }

        if (!executionId) {
          return errorResult(
            "execution_id or pipeline_id is required. Provide either explicitly or via a Harness URL.",
          );
        }

        const diagnostic: Record<string, unknown> = {};
        const totalSteps = 1 + (includeYaml ? 1 : 0) + (includeLogs ? 1 : 0);
        let step = 0;

        // Hoisted so log-fetch (step 3) can use them outside the execution try block
        let resolvedPipelineId: string | undefined;
        let runSequence: number | undefined;
        let planExecId: string | undefined;
        let failedSteps: FailedStepInfo[] = [];

        // 1. Get execution details
        await sendProgress(extra, step, totalSteps, "Fetching execution details...");
        log.info("Fetching execution details", { executionId });
        try {
          const execution = await registry.dispatch(client, "execution", "get", input);

          // Apply summary transformation or return raw
          if (isSummary) {
            diagnostic.execution = buildExecutionSummary(execution as Record<string, unknown>, config, input);
          } else {
            diagnostic.execution = execution;
          }

          // Extract execution metadata for YAML fetch and log prefix
          const exec = execution as Record<string, unknown>;
          const pipelineExec = exec?.pipelineExecutionSummary as Record<string, unknown> | undefined;
          resolvedPipelineId = pipelineExec?.pipelineIdentifier as string | undefined;
          runSequence = pipelineExec?.runSequence as number | undefined;
          planExecId = pipelineExec?.planExecutionId as string | undefined;

          // Extract failed steps for targeted log fetching
          const layoutNodeMap = pipelineExec?.layoutNodeMap as Record<string, NodeInfo> | undefined;
          const startingNodeId = pipelineExec?.startingNodeId as string | undefined;
          if (layoutNodeMap && startingNodeId) {
            const stages = extractStages(layoutNodeMap, startingNodeId);
            failedSteps = findFailedSteps(stages);
          }

          step++;

          // 2. Get pipeline YAML if requested
          if (includeYaml && resolvedPipelineId) {
            await sendProgress(extra, step, totalSteps, "Fetching pipeline YAML...");
            try {
              const pipeline = await registry.dispatch(client, "pipeline", "get", {
                ...input,
                pipeline_id: resolvedPipelineId,
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

        // 3. Get execution logs if requested — fetch only failed step logs for speed and relevance
        if (includeLogs) {
          step++;
          await sendProgress(extra, step, totalSteps, "Fetching failed step logs...");

          if (resolvedPipelineId && runSequence != null && planExecId) {
            const basePrefix = `${config.HARNESS_ACCOUNT_ID}/pipeline/${resolvedPipelineId}/${runSequence}/-${planExecId}`;

            if (failedSteps.length > 0) {
              // Fetch logs only for failed steps
              const stepLogs: Record<string, unknown> = {};
              for (const fs of failedSteps) {
                const stepPrefix = `${basePrefix}/${fs.stage_identifier}/${fs.step_identifier}`;
                try {
                  const logData = await registry.dispatch(client, "execution_log", "get", {
                    ...input,
                    prefix: stepPrefix,
                  });
                  stepLogs[`${fs.stage_identifier}/${fs.step_name}`] = logData;
                } catch (err) {
                  log.warn("Failed to fetch step logs", { step: fs.step_name, error: String(err) });
                  stepLogs[`${fs.stage_identifier}/${fs.step_name}`] = { error: String(err) };
                }
              }
              diagnostic.failed_step_logs = stepLogs;
            } else {
              // No failed steps found — fall back to pipeline-level prefix
              try {
                const logs = await registry.dispatch(client, "execution_log", "get", {
                  ...input,
                  prefix: basePrefix,
                });
                diagnostic.logs = logs;
              } catch (err) {
                log.warn("Failed to fetch execution logs", { error: String(err) });
                diagnostic.logs_error = String(err);
              }
            }
          } else {
            diagnostic.logs_error = "Could not construct log prefix — missing pipelineIdentifier, runSequence, or planExecutionId from execution response.";
          }
        }

        await sendProgress(extra, totalSteps, totalSteps, isSummary ? "Report complete" : "Diagnosis complete");
        return jsonResult(diagnostic);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
