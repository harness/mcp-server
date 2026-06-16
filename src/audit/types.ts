import type { RiskLevel } from "../registry/types.js";

/**
 * How the user confirmation was resolved before the operation ran.
 *
 * - `auto_approved`: risk was at or below `HARNESS_AUTO_APPROVE_RISK`
 * - `elicited`: client completed an MCP elicitation handshake and the user
 *   explicitly accepted the prompt (with `confirm: true` in the response)
 * - `caller_confirmed`: caller passed `confirm: true` and the client could
 *   not surface a usable elicitation prompt (no capability advertised,
 *   `elicitInput` failed, or the client returned a degenerate accept). Used
 *   by non-interactive automation. Distinct from `elicited` so audits can
 *   tell automation overrides apart from genuine human consents
 * - `not_required`: low-risk operation that did not need confirmation
 * - `skipped`: elicitation was attempted but failed for a low-risk operation
 * - `blocked`: operation was prevented because confirmation could not be
 *   obtained (this only appears in audit context for record-keeping; the
 *   operation itself does not run when blocked)
 */
export type ConfirmationMethod =
  | "auto_approved"
  | "elicited"
  | "caller_confirmed"
  | "skipped"
  | "blocked"
  | "not_required";

/**
 * Enriched audit event emitted for every registry-mediated API call.
 * Sinks receive this and decide how to persist / forward it.
 */
export interface AuditEvent {
  event_id: string;
  timestamp: string;
  tool: string;
  operation: string;
  resource_type: string;
  resource_id?: string;
  action?: string;
  org_id?: string;
  project_id?: string;
  account_id: string;
  risk: RiskLevel;
  confirmation?: ConfirmationMethod;
  outcome: "success" | "error";
  error?: string;
  duration_ms: number;
  http_status?: number;
  http_method?: string;
  http_path?: string;
}

/**
 * Context passed from tool handlers into registry dispatch so the
 * audit layer can capture tool-level metadata it cannot derive itself.
 */
export interface AuditContext {
  tool: string;
  confirmation?: ConfirmationMethod;
  resource_id?: string;
  action?: string;
}

/**
 * A destination for audit events. Implementations must be failure-isolated:
 * errors during emit/flush/close are logged but never propagate.
 */
export interface AuditSink {
  readonly name: string;
  emit(event: AuditEvent): void | Promise<void>;
  flush?(): Promise<void>;
  close?(): Promise<void>;
}
