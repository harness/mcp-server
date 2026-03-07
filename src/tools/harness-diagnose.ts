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

// ─── Types ───────────────────────────────────────────────────────────────────

interface LayoutNode {
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

interface ExecGraphNode {
  uuid?: string;
  name?: string;
  identifier?: string;
  baseFqn?: string;
  status?: string;
  stepType?: string;
  startTs?: number;
  endTs?: number;
  failureInfo?: {
    message?: string;
    failureTypeList?: string[];
    responseMessages?: Array<{ message?: string }>;
  };
  logBaseKey?: string;
  delegateInfoList?: Array<{ id?: string; name?: string }>;
  unitProgresses?: Array<{ unitName?: string; status?: string }>;
  executableResponses?: Array<{
    task?: { logKeys?: string[] };
  }>;
  stepDetails?: {
    childPipelineExecutionDetails?: {
      planExecutionId?: string;
      orgId?: string;
      projectId?: string;
    };
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
  failure_message?: string;
  steps: StepSummary[];
}

interface FailedNodeDetail {
  stage: string;
  step: string;
  failure_message: string;
  log_key?: string;
  delegate?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Walk layoutNodeMap to collect step summaries under a stage node. */
function collectSteps(
  layoutNodeMap: Record<string, LayoutNode>,
  nodeId: string,
  steps: StepSummary[],
  visited: Set<string>,
  nodeMap?: Record<string, ExecGraphNode>,
): void {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = layoutNodeMap[nodeId];
  if (!node) return;

  const startTs = node.startTs;
  const endTs = node.endTs;
  const durationMs = startTs && endTs ? endTs - startTs : undefined;

  // failureInfo may be in layoutNodeMap or in executionGraph.nodeMap
  const failureMsg =
    node.failureInfo?.message ||
    nodeMap?.[nodeId]?.failureInfo?.message;

  steps.push({
    name: node.name ?? nodeId,
    identifier: node.nodeIdentifier ?? nodeId,
    status: node.status ?? "Unknown",
    duration_ms: durationMs,
    duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
    failure_message: failureMsg || undefined,
  });

  for (const childId of node.edgeLayoutList?.currentNodeChildren ?? []) {
    collectSteps(layoutNodeMap, childId, steps, visited, nodeMap);
  }
  for (const nextId of node.edgeLayoutList?.nextIds ?? []) {
    collectSteps(layoutNodeMap, nextId, steps, visited, nodeMap);
  }
}

/** Walk layoutNodeMap to extract stage-level structure. */
function extractStages(
  layoutNodeMap: Record<string, LayoutNode>,
  startingNodeId: string,
  nodeMap?: Record<string, ExecGraphNode>,
): StageSummary[] {
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
        collectSteps(layoutNodeMap, childId, steps, stepVisited, nodeMap);
      }

      stages.push({
        name: node.name ?? nodeId,
        identifier: node.nodeIdentifier ?? nodeId,
        status: node.status ?? "Unknown",
        started_at: startTs ? new Date(startTs).toISOString() : undefined,
        ended_at: endTs ? new Date(endTs).toISOString() : undefined,
        duration_ms: durationMs,
        duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
        failure_message: node.failureInfo?.message ||
          nodeMap?.[nodeId]?.failureInfo?.message,
        steps,
      });
    } else {
      for (const childId of node.edgeLayoutList?.currentNodeChildren ?? []) {
        walkNode(childId);
      }
    }

    for (const nextId of node.edgeLayoutList?.nextIds ?? []) {
      walkNode(nextId);
    }
  }

  walkNode(startingNodeId);
  return stages;
}

/**
 * Walk executionGraph.nodeMap to find failed leaf step nodes with detailed
 * failureInfo and logBaseKey. Only available when renderFullBottomGraph=true.
 *
 * Filters out pipeline-level and section wrapper nodes, preferring actual
 * step nodes (those with `.steps.` in baseFqn).
 */
function findFailedNodes(nodeMap: Record<string, ExecGraphNode>): FailedNodeDetail[] {
  const stepNodes: FailedNodeDetail[] = [];
  const stageNodes: FailedNodeDetail[] = [];

  for (const node of Object.values(nodeMap)) {
    if (node.status !== "Failed" && node.status !== "Errored" && node.status !== "Aborted") continue;

    const msg = node.failureInfo?.message;
    if (!msg) continue;

    const fqn = node.baseFqn ?? "";

    // Skip the pipeline root node entirely
    if (node.identifier === "pipeline" || fqn === "pipeline") continue;

    // Extract stage identifier from baseFqn (e.g. pipeline.stages.MyStage.spec...)
    const stageMatch = fqn.match(/\.stages\.([^.]+)\./);
    const stageId = stageMatch?.[1] ?? node.identifier ?? "unknown";

    // Skip nodes where we can't determine a proper stage (e.g. `pipeline.stages` wrapper)
    if (!stageMatch && fqn.startsWith("pipeline.stages") && !fqn.includes(".spec.")) continue;
    const delegate = node.delegateInfoList?.[0]?.name;

    const detail: FailedNodeDetail = {
      stage: stageId,
      step: node.identifier ?? node.name ?? "unknown",
      failure_message: msg,
      log_key: node.logBaseKey,
      delegate,
    };

    // baseFqn with `.steps.` = actual step node; otherwise it's a stage/section wrapper
    if (fqn.includes(".steps.")) {
      stepNodes.push(detail);
    } else {
      stageNodes.push(detail);
    }
  }

  // Prefer leaf step nodes; fall back to stage-level if no steps found
  return stepNodes.length > 0 ? stepNodes : stageNodes;
}

/** Detect if any failed node is a chained (child) pipeline stage. */
function findChildPipelineRef(
  nodeMap: Record<string, ExecGraphNode>,
): { executionId: string; orgId: string; projectId: string } | undefined {
  for (const node of Object.values(nodeMap)) {
    if (node.status !== "Failed" && node.status !== "Errored" && node.status !== "Aborted") continue;
    const child = node.stepDetails?.childPipelineExecutionDetails;
    if (child?.planExecutionId) {
      return { executionId: child.planExecutionId, orgId: child.orgId ?? "", projectId: child.projectId ?? "" };
    }
  }
  return undefined;
}

/** Follow a child pipeline execution and return its failed nodes. */
async function diagnoseChildPipeline(
  client: HarnessClient,
  child: { executionId: string; orgId: string; projectId: string },
): Promise<FailedNodeDetail[]> {
  try {
    const response = await client.request<Record<string, unknown>>({
      method: "GET",
      path: `/pipeline/api/pipelines/execution/v2/${child.executionId}`,
      params: {
        orgIdentifier: child.orgId,
        projectIdentifier: child.projectId,
        renderFullBottomGraph: "true",
      },
    });
    const data = (response as Record<string, unknown>).data ?? response;
    const execGraph = (data as Record<string, unknown>).executionGraph as Record<string, unknown> | undefined;
    const nodeMap = execGraph?.nodeMap as Record<string, ExecGraphNode> | undefined;
    if (nodeMap) return findFailedNodes(nodeMap);
  } catch (err) {
    log.warn("Child pipeline diagnosis failed", { executionId: child.executionId, error: String(err) });
  }
  return [];
}

/**
 * Build structured execution summary from the raw API response.
 * Uses layoutNodeMap for stage structure, executionGraph.nodeMap for step-level failure detail.
 */
function buildExecutionSummary(
  execution: Record<string, unknown>,
  config: Config,
  input: Record<string, unknown>,
): { summary: Record<string, unknown>; failedNodes: FailedNodeDetail[]; childRef?: { executionId: string; orgId: string; projectId: string } } {
  const pes = execution.pipelineExecutionSummary as Record<string, unknown> | undefined;
  if (!pes) return { summary: execution, failedNodes: [] };

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

  // Stage structure from layoutNodeMap, enriched with executionGraph.nodeMap for failure details
  const layoutNodeMap = pes.layoutNodeMap as Record<string, LayoutNode> | undefined;
  const startingNodeId = pes.startingNodeId as string | undefined;
  const executionGraph = execution.executionGraph as Record<string, unknown> | undefined;
  const nodeMap = executionGraph?.nodeMap as Record<string, ExecGraphNode> | undefined;

  if (layoutNodeMap && startingNodeId) {
    const stages = extractStages(layoutNodeMap, startingNodeId, nodeMap);
    summary.stages = stages;

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

  // Step-level failure detail from executionGraph.nodeMap (requires renderFullBottomGraph)
  let failedNodes: FailedNodeDetail[] = [];
  let childRef: { executionId: string; orgId: string; projectId: string } | undefined;

  if (nodeMap) {
    failedNodes = findFailedNodes(nodeMap);
    childRef = findChildPipelineRef(nodeMap);
  }

  // Build failure summary — prefer executionGraph detail over layoutNodeMap stage-level info
  if (failedNodes.length > 0) {
    const primary = failedNodes[0];
    summary.failure = {
      stage: primary.stage,
      step: primary.step,
      error: primary.failure_message,
      delegate: primary.delegate,
    };
    if (failedNodes.length > 1) {
      summary.all_failures = failedNodes.map((f) => ({
        stage: f.stage,
        step: f.step,
        error: f.failure_message,
        delegate: f.delegate,
      }));
    }
  } else {
    // Fall back to layoutNodeMap stage-level failure
    const stages = summary.stages as StageSummary[] | undefined;
    const failedStage = stages?.find(
      (s) => s.status === "Failed" || s.status === "Errored" || s.status === "Aborted",
    );
    if (failedStage) {
      const failedStep = failedStage.steps.find((s) => s.failure_message);
      summary.failure = {
        stage: failedStage.name,
        step: failedStep?.name,
        error: failedStep?.failure_message ?? failedStage.failure_message,
      };
    }
  }

  // Execution deep link
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

  return { summary, failedNodes, childRef };
}

/** Keep only the last `n` lines of a string. */
function tailLines(text: string, n: number): { text: string; truncated: boolean; totalLines: number } {
  if (n <= 0) return { text, truncated: false, totalLines: text.split("\n").length };
  const lines = text.split("\n");
  if (lines.length <= n) return { text, truncated: false, totalLines: lines.length };
  return {
    text: `... (${lines.length - n} lines omitted) ...\n` + lines.slice(-n).join("\n"),
    truncated: true,
    totalLines: lines.length,
  };
}

/** Truncate a log blob. Detects zip-queued responses and replaces with a clean signal. */
function truncateLog(raw: unknown, maxLines: number): unknown {
  if (typeof raw === "string") {
    const result = tailLines(raw, maxLines);
    if (!result.truncated) return raw;
    return { log_snippet: result.text, total_lines: result.totalLines, truncated: true };
  }
  if (raw && typeof raw === "object" && "link" in raw && "status" in raw) {
    return { logs_unavailable: true, reason: "Logs are archived and not available inline." };
  }
  return raw;
}

// ─── Tool registration ───────────────────────────────────────────────────────

export function registerDiagnoseTool(server: McpServer, registry: Registry, client: HarnessClient, config: Config): void {
  server.tool(
    "harness_diagnose",
    "Analyze a pipeline execution — returns a structured report with stage/step breakdown, timing, bottlenecks, and failure details including the exact failed step, error message, and delegate. Accepts an execution_id, a pipeline_id (auto-fetches latest execution), or a Harness URL. Set summary=false for raw diagnostic data with pipeline YAML and execution logs.",
    {
      execution_id: z.string().describe("The pipeline execution ID to analyze. Auto-detected from url if provided.").optional(),
      pipeline_id: z.string().describe("Pipeline identifier — fetches the latest execution automatically when no execution_id is given. Auto-detected from url if provided.").optional(),
      url: z.string().describe("A Harness execution or pipeline URL — identifiers are extracted automatically").optional(),
      org_id: z.string().describe("Organization identifier (overrides default)").optional(),
      project_id: z.string().describe("Project identifier (overrides default)").optional(),
      summary: z.boolean().describe("Return structured summary report (default true). Set to false for raw diagnostic payload with YAML and logs.").default(true).optional(),
      include_yaml: z.boolean().describe("Include pipeline YAML definition. Defaults to false in summary mode, true in diagnostic mode.").optional(),
      include_logs: z.boolean().describe("Include execution step logs. Defaults to false in summary mode, true in diagnostic mode.").optional(),
      log_snippet_lines: z.number().describe("Max lines to keep from each failed step's log (tail). 0 = unlimited.").default(120).optional(),
      max_failed_steps: z.number().describe("Max number of failed steps to fetch logs for. 0 = unlimited.").default(5).optional(),
    },
    async (args, extra) => {
      try {
        const input = applyUrlDefaults(args as Record<string, unknown>, args.url);
        let executionId = input.execution_id as string | undefined;
        const pipelineId = input.pipeline_id as string | undefined;
        const isSummary = args.summary !== false;

        const includeYaml = args.include_yaml ?? !isSummary;
        const includeLogs = args.include_logs ?? !isSummary;
        const logSnippetLines = args.log_snippet_lines ?? 120;
        const maxFailedSteps = args.max_failed_steps ?? 5;

        let totalSteps = 1; // execution details
        if (includeYaml) totalSteps++;
        if (includeLogs) totalSteps++;

        // Auto-fetch latest execution if pipeline_id provided without execution_id
        if (!executionId && pipelineId) {
          log.info("Fetching latest execution for pipeline", { pipelineId });
          await sendProgress(extra, 0, totalSteps, "Fetching latest execution...");
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
        let currentStep = 0;
        let resolvedPipelineId: string | undefined;
        let failedNodes: FailedNodeDetail[] = [];

        // 1. Get execution details with full graph (includes step-level nodes)
        await sendProgress(extra, currentStep, totalSteps, "Fetching execution details...");
        log.info("Fetching execution details", { executionId });
        try {
          const execution = await registry.dispatch(client, "execution", "get", {
            ...input,
            render_full_graph: true,
          });

          const exec = execution as Record<string, unknown>;
          const pes = exec?.pipelineExecutionSummary as Record<string, unknown> | undefined;
          resolvedPipelineId = pes?.pipelineIdentifier as string | undefined;

          if (isSummary) {
            const result = buildExecutionSummary(exec, config, input);
            diagnostic.execution = result.summary;
            failedNodes = result.failedNodes;

            // Follow chained (child) pipeline if the failure is in a child execution
            if (result.childRef) {
              log.info("Detected chained pipeline failure, diagnosing child", result.childRef);
              const childFailedNodes = await diagnoseChildPipeline(client, result.childRef);
              if (childFailedNodes.length > 0) {
                const childPrimary = childFailedNodes[0];
                (diagnostic.execution as Record<string, unknown>).child_pipeline = {
                  execution_id: result.childRef.executionId,
                  org_id: result.childRef.orgId,
                  project_id: result.childRef.projectId,
                  failure: {
                    stage: childPrimary.stage,
                    step: childPrimary.step,
                    error: childPrimary.failure_message,
                    delegate: childPrimary.delegate,
                  },
                  all_failures: childFailedNodes.length > 1
                    ? childFailedNodes.map((f) => ({
                        stage: f.stage,
                        step: f.step,
                        error: f.failure_message,
                        delegate: f.delegate,
                      }))
                    : undefined,
                };
                // Use child's failed nodes for log fetching since those are the real failures
                failedNodes = childFailedNodes;
              }
            }
          } else {
            diagnostic.execution = execution;
            // Still extract failed nodes for log fetching in raw mode
            const execGraph = exec?.executionGraph as Record<string, unknown> | undefined;
            const graphNodeMap = execGraph?.nodeMap as Record<string, ExecGraphNode> | undefined;
            if (graphNodeMap) {
              failedNodes = findFailedNodes(graphNodeMap);
            }
          }

          currentStep++;

          // 2. Get pipeline YAML if requested
          if (includeYaml && resolvedPipelineId) {
            await sendProgress(extra, currentStep, totalSteps, "Fetching pipeline YAML...");
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
            currentStep++;
          }
        } catch (err) {
          diagnostic.execution_error = String(err);
        }

        // 3. Get execution logs if requested — use logBaseKey from executionGraph nodes
        if (includeLogs && failedNodes.length > 0) {
          await sendProgress(extra, currentStep, totalSteps, "Fetching failed step logs...");

          const capped = maxFailedSteps > 0 ? failedNodes.slice(0, maxFailedSteps) : failedNodes;
          if (capped.length < failedNodes.length) {
            diagnostic.failed_steps_truncated = { shown: capped.length, total: failedNodes.length };
          }

          const logEntries = await Promise.all(
            capped.map(async (fn) => {
              const key = `${fn.stage}/${fn.step}`;
              const prefix = fn.log_key;
              if (!prefix) return { key, value: { error: "No log key available for this step" } };
              try {
                const logData = await registry.dispatch(client, "execution_log", "get", {
                  ...input,
                  prefix,
                });
                return { key, value: truncateLog(logData, logSnippetLines) };
              } catch (err) {
                log.warn("Failed to fetch step logs", { step: fn.step, error: String(err) });
                return { key, value: { error: String(err) } };
              }
            }),
          );

          const stepLogs: Record<string, unknown> = {};
          for (const entry of logEntries) {
            stepLogs[entry.key] = entry.value;
          }
          diagnostic.failed_step_logs = stepLogs;
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
