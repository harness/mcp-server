import type { RiskLevel } from "../registry/types.js";

/**
 * How the user confirmation was resolved.
 *
 * - `auto_approved`: risk was at or below `HARNESS_AUTO_APPROVE_RISK`
 * - `elicited`: client completed an MCP elicitation handshake and the user
 *   explicitly accepted with `confirm: true` (the proceed case), or
 *   explicitly declined / cancelled / unchecked the confirm box (the block
 *   cases — paired with `outcome: "blocked"`)
 * - `caller_confirmed`: caller passed `confirm: true` and the client could
 *   not surface a usable elicitation prompt (no capability advertised,
 *   `elicitInput` failed, or the client returned a degenerate accept). Used
 *   by non-interactive automation. Distinct from `elicited` so audits can
 *   tell automation overrides apart from genuine human consents
 * - `not_required`: low-risk operation (`read` / `low_write`) that did not
 *   need confirmation
 * - `blocked`: client could not surface a usable confirmation prompt
 *   (lacking elicitation capability + no `confirm: true`, transport error,
 *   or degenerate accept). Paired with `outcome: "blocked"` on the
 *   pre-dispatch audit row
 */
export type ConfirmationMethod =
  | "auto_approved"
  | "elicited"
  | "caller_confirmed"
  | "blocked"
  | "not_required";

/**
 * The outcome of an audited operation.
 *
 * - `success`: the dispatched API call returned successfully
 * - `error`: the dispatched API call failed (network/HTTP/etc.)
 * - `blocked`: a pre-dispatch audit row emitted by
 *   `Registry.auditBlockedAttempt()` when an operation was gated by
 *   elicitation. The operation itself was NOT dispatched; the row exists
 *   for record-keeping so operators can see blocked attempts. Distinct
 *   from `error` so audit/OTel consumers can filter pre-dispatch blocks
 *   from real API failures
 */
export type AuditOutcome = "success" | "error" | "blocked";

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
  outcome: AuditOutcome;
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
