/**
 * Shared data interfaces for SVG renderers.
 * These types decouple SVG generation from Harness API response shapes.
 */

export type ExecutionStatus =
  | "Success"
  | "Failed"
  | "Running"
  | "Aborted"
  | "Expired"
  | "ApprovalWaiting"
  | "InterventionWaiting"
  | "Paused"
  | "Queued"
  | "Skipped"
  | "Errored"
  | "Unknown";

export interface StepBar {
  name: string;
  status: ExecutionStatus;
  durationMs: number;
  failureMessage?: string;
}

export interface StageBar {
  name: string;
  status: ExecutionStatus;
  startMs: number;
  durationMs: number;
  steps: StepBar[];
}

export interface ExecutionSummaryData {
  pipelineName: string;
  executionId: string;
  status: ExecutionStatus;
  totalDurationMs: number;
  stages: StageBar[];
}

export interface RecentExecution {
  id: string;
  pipeline: string;
  status: ExecutionStatus;
}

export interface ProjectHealthData {
  orgId: string;
  projectId: string;
  health: "healthy" | "degraded" | "failing";
  counts: {
    failed: number;
    running: number;
    recent: number;
  };
  recentExecutions: RecentExecution[];
}

/** Per-day execution counts for timeseries chart. */
export interface DayCounts {
  date: string; // YYYY-MM-DD
  Success: number;
  Failed: number;
  Expired: number;
  Running: number;
  Aborted?: number;
  [key: string]: number | string | undefined;
}

export interface ExecutionTimeseriesData {
  orgId: string;
  projectId: string;
  days: DayCounts[];
  totalSuccess: number;
  totalFailed: number;
  totalExpired: number;
  totalRunning: number;
  fromDate: string;
  toDate: string;
}
