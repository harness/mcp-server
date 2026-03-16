/**
 * Data converters that map tool output → SVG renderer input types.
 * Keeps SVG module decoupled from Harness API / diagnose internals.
 */

import type { ExecutionSummaryData, ExecutionStatus, StageBar, StepBar, ProjectHealthData, RecentExecution } from "./types.js";

function asStatus(s: unknown): ExecutionStatus {
  if (typeof s === "string") return s as ExecutionStatus;
  return "Unknown";
}

function asNum(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

interface StepLike {
  name?: string;
  status?: string;
  duration_ms?: number;
  failure_message?: string;
}

interface StageLike {
  name?: string;
  identifier?: string;
  status?: string;
  started_at?: string;
  duration_ms?: number;
  steps?: StepLike[];
}

interface ExecutionBlock {
  pipeline?: { name?: string; identifier?: string };
  execution?: { id?: string; status?: string };
  timing?: { started_at?: string; duration_ms?: number };
  stages?: StageLike[];
}

/**
 * Maps the diagnose pipeline handler's result → ExecutionSummaryData.
 * Returns null if the data doesn't contain the expected structure.
 */
export function toExecutionSummaryData(diagnoseResult: Record<string, unknown>): ExecutionSummaryData | null {
  const exec = diagnoseResult.execution as ExecutionBlock | undefined;
  if (!exec) return null;

  const pipelineName = exec.pipeline?.name ?? exec.pipeline?.identifier ?? "Pipeline";
  const executionId = asStr(exec.execution?.id);
  const status = asStatus(exec.execution?.status);
  const totalDurationMs = asNum(exec.timing?.duration_ms);

  if (!executionId) return null;

  const rawStages = exec.stages;
  if (!Array.isArray(rawStages)) {
    return { pipelineName, executionId, status, totalDurationMs, stages: [] };
  }

  // Compute base start time from earliest stage
  let baseStartMs = Infinity;
  for (const s of rawStages) {
    if (s.started_at) {
      const t = new Date(s.started_at).getTime();
      if (t < baseStartMs) baseStartMs = t;
    }
  }
  if (!isFinite(baseStartMs)) baseStartMs = 0;

  const stages: StageBar[] = rawStages.map((s: StageLike) => {
    const startMs = s.started_at ? new Date(s.started_at).getTime() : baseStartMs;
    const durationMs = asNum(s.duration_ms);

    const steps: StepBar[] = (s.steps ?? []).map((step: StepLike) => ({
      name: step.name ?? "Step",
      status: asStatus(step.status),
      durationMs: asNum(step.duration_ms),
      failureMessage: step.failure_message,
    }));

    return {
      name: s.name ?? s.identifier ?? "Stage",
      status: asStatus(s.status),
      startMs,
      durationMs,
      steps,
    };
  });

  return { pipelineName, executionId, status, totalDurationMs, stages };
}

interface StatusExecItem {
  execution_id?: string;
  pipeline?: string;
  status?: string;
}

interface StatusResult {
  summary?: {
    total_failed?: number;
    total_running?: number;
    total_recent?: number;
    health?: string;
  };
  recent_activity?: StatusExecItem[];
  failed_executions?: StatusExecItem[];
  running_executions?: StatusExecItem[];
}

/**
 * Maps the harness_status tool's output → ProjectHealthData.
 * Returns null if the data doesn't contain the expected structure.
 */
export function toProjectHealthData(
  statusResult: Record<string, unknown>,
  orgId: string,
  projectId: string,
): ProjectHealthData | null {
  const sr = statusResult as StatusResult;
  const summary = sr.summary;
  if (!summary) return null;

  const health = (summary.health === "healthy" || summary.health === "degraded" || summary.health === "failing")
    ? summary.health
    : "healthy";

  const recentExecutions: RecentExecution[] = (sr.recent_activity ?? []).map((e) => ({
    id: asStr(e.execution_id),
    pipeline: asStr(e.pipeline),
    status: asStatus(e.status),
  }));

  return {
    orgId,
    projectId,
    health,
    counts: {
      failed: asNum(summary.total_failed),
      running: asNum(summary.total_running),
      recent: asNum(summary.total_recent),
    },
    recentExecutions,
  };
}
