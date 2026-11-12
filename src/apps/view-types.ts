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

export type HarnessView = ResultView;
