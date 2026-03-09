import type { DiagnoseHandler, DiagnoseContext } from "./types.js";
import type { HarnessClient } from "../../client/harness-client.js";
import type { Config } from "../../config.js";
import { createLogger } from "../../utils/logger.js";
import { sendProgress } from "../../utils/progress.js";
import { isRecord, asRecord, asString, asNumber } from "../../utils/type-guards.js";

const log = createLogger("diagnose:pipeline");

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
  stepParameters?: {
    name?: string;
    timeout?: string;
    type?: string;
    spec?: {
      shell?: string;
      source?: {
        type?: string;
        spec?: { script?: string };
      };
      environmentVariables?: Record<string, string>;
    };
  };
  interruptHistories?: Array<{
    interruptType?: string;
  }>;
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
  script_context?: {
    name?: string;
    timeout?: string;
    shell?: string;
    script?: string;
    env_vars?: Record<string, string>;
    retried?: boolean;
  };
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

function findFailedNodes(nodeMap: Record<string, ExecGraphNode>): FailedNodeDetail[] {
  const stepNodes: FailedNodeDetail[] = [];
  const stageNodes: FailedNodeDetail[] = [];

  for (const node of Object.values(nodeMap)) {
    if (node.status !== "Failed" && node.status !== "Errored" && node.status !== "Aborted") continue;

    const msg = node.failureInfo?.message;
    if (!msg) continue;

    const fqn = node.baseFqn ?? "";

    if (node.identifier === "pipeline" || fqn === "pipeline") continue;

    const stageMatch = fqn.match(/\.stages\.([^.]+)\./);
    const stageId = stageMatch?.[1] ?? node.identifier ?? "unknown";

    if (!stageMatch && fqn.startsWith("pipeline.stages") && !fqn.includes(".spec.")) continue;
    const delegate = node.delegateInfoList?.[0]?.name;

    const detail: FailedNodeDetail = {
      stage: stageId,
      step: node.identifier ?? node.name ?? "unknown",
      failure_message: msg,
      log_key: node.logBaseKey,
      delegate,
    };

    if (node.stepType === "ShellScript" && node.stepParameters?.spec) {
      const spec = node.stepParameters.spec;
      const scriptSource = spec.source?.spec?.script;
      const envVars = spec.environmentVariables;
      const hasRetry = node.interruptHistories?.some((h) => h.interruptType === "RETRY");
      if (scriptSource || envVars) {
        detail.script_context = {
          name: node.stepParameters.name ?? node.name,
          timeout: node.stepParameters.timeout,
          shell: spec.shell,
          script: scriptSource,
          env_vars: envVars && Object.keys(envVars).length > 0 ? envVars : undefined,
          retried: hasRetry || undefined,
        };
      }
    }

    if (fqn.includes(".steps.")) {
      stepNodes.push(detail);
    } else {
      stageNodes.push(detail);
    }
  }

  return stepNodes.length > 0 ? stepNodes : stageNodes;
}

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

async function diagnoseChildPipeline(
  client: HarnessClient,
  child: { executionId: string; orgId: string; projectId: string },
  signal?: AbortSignal,
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
      signal,
    });
    const responseRec = asRecord(response) ?? {};
    const data = asRecord(responseRec.data) ?? responseRec;
    const execGraph = asRecord(data.executionGraph);
    const graphNodeMap = asRecord(execGraph?.nodeMap) as Record<string, ExecGraphNode> | undefined;
    if (graphNodeMap) return findFailedNodes(graphNodeMap);
  } catch (err) {
    log.warn("Child pipeline diagnosis failed", { executionId: child.executionId, error: String(err) });
  }
  return [];
}

function buildExecutionSummary(
  execution: Record<string, unknown>,
  config: Config,
  input: Record<string, unknown>,
): { summary: Record<string, unknown>; failedNodes: FailedNodeDetail[]; childRef?: { executionId: string; orgId: string; projectId: string } } {
  const pes = asRecord(execution.pipelineExecutionSummary);
  if (!pes) return { summary: execution, failedNodes: [] };

  const startTs = asNumber(pes.startTs);
  const endTs = asNumber(pes.endTs);
  const durationMs = startTs && endTs ? endTs - startTs : undefined;
  const triggerInfo = asRecord(pes.executionTriggerInfo);
  const triggeredBy = asRecord(triggerInfo?.triggeredBy);

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
      triggered_by: triggeredBy?.identifier ?? asRecord(triggeredBy?.extraInfo)?.email,
    },
    timing: {
      started_at: startTs ? new Date(startTs).toISOString() : undefined,
      ended_at: endTs ? new Date(endTs).toISOString() : undefined,
      duration_ms: durationMs,
      duration_human: durationMs != null ? formatDuration(durationMs) : undefined,
    },
  };

  const layoutNodeMap = isRecord(pes.layoutNodeMap) ? pes.layoutNodeMap as Record<string, LayoutNode> : undefined;
  const startingNodeId = asString(pes.startingNodeId);
  const executionGraph = asRecord(execution.executionGraph);
  const nodeMap = isRecord(executionGraph?.nodeMap) ? executionGraph.nodeMap as Record<string, ExecGraphNode> : undefined;

  if (layoutNodeMap && startingNodeId) {
    const stages = extractStages(layoutNodeMap, startingNodeId, nodeMap);
    summary.stages = stages;

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

  let failedNodes: FailedNodeDetail[] = [];
  let childRef: { executionId: string; orgId: string; projectId: string } | undefined;

  if (nodeMap) {
    failedNodes = findFailedNodes(nodeMap);
    childRef = findChildPipelineRef(nodeMap);
  }

  if (failedNodes.length > 0) {
    const primary = failedNodes[0];
    const failureEntry = (f: FailedNodeDetail) => {
      const entry: Record<string, unknown> = {
        stage: f.stage,
        step: f.step,
        error: f.failure_message,
        delegate: f.delegate,
      };
      if (f.script_context) entry.script_context = f.script_context;
      return entry;
    };
    summary.failure = failureEntry(primary);
    if (failedNodes.length > 1) {
      summary.all_failures = failedNodes.map(failureEntry);
    }
  } else {
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

  const orgId = asString(input.org_id) ?? config.HARNESS_DEFAULT_ORG_ID;
  const projectId = asString(input.project_id) ?? config.HARNESS_DEFAULT_PROJECT_ID;
  const pipelineIdentifier = asString(pes.pipelineIdentifier);
  const execId = asString(pes.planExecutionId);
  if (pipelineIdentifier && execId && orgId && projectId) {
    const base = config.HARNESS_BASE_URL.replace(/\/$/, "");
    summary.openInHarness = `${base}/ng/account/${config.HARNESS_ACCOUNT_ID}/all/orgs/${orgId}/projects/${projectId}/pipelines/${pipelineIdentifier}/executions/${execId}/pipeline`;
  } else if (execution.openInHarness) {
    summary.openInHarness = execution.openInHarness;
  }

  return { summary, failedNodes, childRef };
}

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

// ─── Handler ─────────────────────────────────────────────────────────────────

export const pipelineHandler: DiagnoseHandler = {
  entityType: "pipeline",
  description: "Analyze a pipeline execution — stage/step breakdown, timing, bottlenecks, failure details with exact step, error, delegate, and script context.",

  async diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>> {
    const { client, registry, config, input, args, extra, signal } = ctx;

    let executionId = asString(input.execution_id);
    const pipelineId = asString(input.pipeline_id);
    const isSummary = args.summary !== false;

    const includeYaml = args.include_yaml ?? !isSummary;
    const includeLogs = args.include_logs ?? !isSummary;
    const logSnippetLines = asNumber(args.log_snippet_lines) ?? 120;
    const maxFailedSteps = asNumber(args.max_failed_steps) ?? 5;

    let totalSteps = 1;
    if (includeYaml) totalSteps++;
    if (includeLogs) totalSteps++;

    if (!executionId && pipelineId) {
      log.info("Fetching latest execution for pipeline", { pipelineId });
      await sendProgress(extra, 0, totalSteps, "Fetching latest execution...");
      try {
        const execList = await registry.dispatch(client, "execution", "list", {
          ...input,
          pipeline_id: pipelineId,
          size: 1,
          page: 0,
        }, signal);
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
      throw new Error("execution_id or pipeline_id is required. Provide either explicitly or via a Harness URL.");
    }

    const diagnostic: Record<string, unknown> = {};
    let currentStep = 0;
    let resolvedPipelineId: string | undefined;
    let failedNodes: FailedNodeDetail[] = [];

    await sendProgress(extra, currentStep, totalSteps, "Fetching execution details...");
    log.info("Fetching execution details", { executionId });
    try {
      const execution = await registry.dispatch(client, "execution", "get", {
        ...input,
        render_full_graph: true,
      }, signal);

      const exec = asRecord(execution) ?? {};
      const pes = asRecord(exec.pipelineExecutionSummary);
      resolvedPipelineId = asString(pes?.pipelineIdentifier);

      if (isSummary) {
        const result = buildExecutionSummary(exec, config, input);
        diagnostic.execution = result.summary;
        failedNodes = result.failedNodes;

        if (result.childRef) {
          log.info("Detected chained pipeline failure, diagnosing child", result.childRef);
          const childFailedNodes = await diagnoseChildPipeline(client, result.childRef, signal);
          if (childFailedNodes.length > 0) {
            const childEntry = (f: FailedNodeDetail) => {
              const e: Record<string, unknown> = {
                stage: f.stage, step: f.step, error: f.failure_message, delegate: f.delegate,
              };
              if (f.script_context) e.script_context = f.script_context;
              return e;
            };
            const childPrimary = childFailedNodes[0];
            const execDiag = asRecord(diagnostic.execution) ?? {};
            execDiag.child_pipeline = {
              execution_id: result.childRef.executionId,
              org_id: result.childRef.orgId,
              project_id: result.childRef.projectId,
              failure: childEntry(childPrimary),
              all_failures: childFailedNodes.length > 1
                ? childFailedNodes.map(childEntry)
                : undefined,
            };
            failedNodes = childFailedNodes;
          }
        }
      } else {
        diagnostic.execution = execution;
        const execGraph = asRecord(exec.executionGraph);
        const graphNodeMap = isRecord(execGraph?.nodeMap) ? execGraph.nodeMap as Record<string, ExecGraphNode> : undefined;
        if (graphNodeMap) {
          failedNodes = findFailedNodes(graphNodeMap);
        }
      }

      currentStep++;

      if (includeYaml && resolvedPipelineId) {
        await sendProgress(extra, currentStep, totalSteps, "Fetching pipeline YAML...");
        try {
          const pipeline = await registry.dispatch(client, "pipeline", "get", {
            ...input,
            pipeline_id: resolvedPipelineId,
          }, signal);
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
            }, signal);
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
    return diagnostic;
  },
};
