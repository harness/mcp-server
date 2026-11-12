/**
 * View models sent to the ui://harness/app view in a tool result's
 * `_meta["harness.io/view"]`. Type-only so the bundled view can import them.
 */

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

export interface ViewStatus {
  label: string;
  tone: StatusTone;
  /** True while the underlying work is still moving (animated pill). */
  live?: boolean;
}

/** A read-only tool call the view may repeat to refresh itself. */
export interface ViewRefresh {
  tool: string;
  arguments: Record<string, unknown>;
}

/** Generic one-line card: title, status, Open in Harness. */
export interface ResultView {
  kind: "result";
  title: string;
  subtitle?: string;
  status?: ViewStatus;
  open_in_harness?: string;
  refresh?: ViewRefresh;
}

export interface ExecutionStageView {
  id: string;
  name: string;
  status: ViewStatus;
  /** Stages that run side by side share a group id. */
  parallel_group?: string;
  skipped?: boolean;
  started_at?: number;
  ended_at?: number;
  steps_done?: number;
  steps_total?: number;
  current_step?: string;
  failure_message?: string;
}

/** Live pipeline run: header, stage bar, failure, and a 30-second refresh while not terminal. */
export interface PipelineExecutionView {
  kind: "pipeline_execution";
  execution_id: string;
  run_sequence?: number;
  pipeline: { name?: string; identifier?: string };
  scope: { org?: string; project?: string };
  status: ViewStatus;
  /** Terminal runs stop refreshing. */
  terminal: boolean;
  /** Waiting on a human (approval, input, intervention) in Harness. */
  awaiting_action?: boolean;
  /** Epoch milliseconds. */
  started_at?: number;
  ended_at?: number;
  trigger?: { type?: string; by?: string };
  stages: ExecutionStageView[];
  /** False when the response had no step graph; the card fetches it once through refresh. */
  steps_loaded?: boolean;
  current_stage_index?: number;
  failure?: { stage?: string; step?: string; message: string };
  open_in_harness?: string;
  refresh?: ViewRefresh;
}

export type PanelChart = "kpi" | "line" | "area" | "bar" | "pie" | "table";
export type ColumnKind = "time" | "number" | "category";
export type PanelCell = string | number | boolean | null;

export interface DashboardColumn {
  name: string;
  kind: ColumnKind;
}

/** One HQL query result. */
export interface DashboardPanel {
  id: string;
  title: string;
  query_string: string;
  chart: PanelChart;
  columns: DashboardColumn[];
  rows: PanelCell[][];
  /** Rows returned by the engine before the view cap. */
  row_count: number;
  /** The engine returned a prefix of the result. */
  truncated?: boolean;
  /** Rows were cut to the view cap. */
  capped?: boolean;
  error?: string;
  /** Re-runs this query (read-only HQL). */
  refresh?: ViewRefresh;
}

/** Knowledge Graph dashboard: one panel per HQL query. */
export interface KgDashboardView {
  kind: "kg_dashboard";
  title?: string;
  panels: DashboardPanel[];
}

export type HarnessView = ResultView | PipelineExecutionView | KgDashboardView;
