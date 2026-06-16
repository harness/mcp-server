import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createLogger } from "./logger.js";
import { type RiskLevel, type AutoApproveRisk, shouldAutoApprove, requiresConfirmation } from "../registry/types.js";

const log = createLogger("elicitation");

const confirmationSchema = {
  type: "object" as const,
  properties: {
    confirm: {
      type: "boolean" as const,
      title: "Confirm operation",
      description: "Set to true to approve this Harness operation.",
      default: true,
    },
  },
  required: ["confirm"],
};

export interface ElicitationResult {
  /** Whether the operation should proceed. */
  proceed: boolean;
  /** Why the operation was stopped, if applicable. */
  reason?: "declined" | "cancelled";
  /** How the confirmation was resolved — maps directly to ConfirmationMethod for audit. */
  method: "elicited" | "caller_confirmed" | "auto_approved" | "not_required" | "blocked" | "skipped";
}

/**
 * Build a tool-handler-friendly error string for a non-proceeding
 * `ElicitationResult`. Branches on `method` so the recovery hint matches
 * what actually happened:
 *
 *  - `elicited` → the client completed the handshake and the user declined
 *    or cancelled. Authoritative; `confirm: true` does NOT bypass this.
 *  - `blocked` → the client did not surface a prompt (no elicitation
 *    capability, or `elicitInput` failed). Caller can retry with
 *    `confirm: true` to opt in for non-interactive automation.
 */
export function describeElicitationFailure(result: ElicitationResult): string {
  const reason = result.reason ?? "declined";
  if (result.method === "blocked") {
    return `Operation ${reason} by user. Hint: client could not surface an interactive confirmation prompt — retry with confirm: true if you intend to proceed (e.g. non-interactive automation).`;
  }
  return `Operation ${reason} by user. To override an interactive decline, the user must accept the prompt — confirm: true does not bypass an explicit decline.`;
}

/** Module-level auto-approve threshold (set via HARNESS_AUTO_APPROVE_RISK). */
let _autoApproveRisk: AutoApproveRisk = "none";

/**
 * Configure the elicitation module. Call once at startup.
 */
export function configureElicitation(opts: { autoApproveRisk?: AutoApproveRisk }): void {
  if (opts.autoApproveRisk !== undefined) _autoApproveRisk = opts.autoApproveRisk;
}

/**
 * Check whether the connected client advertises form elicitation support.
 */
export function clientSupportsElicitation(server: Server): boolean {
  const caps = server.getClientCapabilities();
  return !!caps?.elicitation;
}

/**
 * Prompt the user to confirm a write operation via MCP form elicitation.
 *
 * Decision flow:
 *  1. If the operation risk is at or below `HARNESS_AUTO_APPROVE_RISK`, proceed
 *     immediately (autonomous mode for CI/CD agents).
 *  2. If the client supports elicitation, prompt the user.
 *  3. If the client lacks elicitation:
 *     - `read` / `low_write` → proceed silently.
 *     - `medium_write` / `high_write` / `destructive` → BLOCK.
 *  4. `callerConfirmed` (caller passed `confirm: true`) overrides:
 *       - the lacking-elicitation block (managed MCP, Cursor, etc.),
 *       - an `elicitInput` failure (transport or unsupported method),
 *       - an `accept` action missing `confirm=true` (degenerate response from
 *         a non-interactive client that advertises elicitation but does not
 *         actually surface a prompt).
 *     It does NOT override an explicit `decline` or `cancel` from a client
 *     that completed the elicitation handshake — a human (or trusted client)
 *     saying "no" to a write is authoritative, even if the model also passed
 *     `confirm: true` on the call.
 */
export async function confirmViaElicitation({
  server,
  toolName,
  message,
  risk,
  autoApproveRisk,
  callerConfirmed,
}: {
  server: McpServer;
  toolName: string;
  message: string;
  /** The risk level of the operation (from operationPolicy). */
  risk: RiskLevel;
  /** Optional per-session threshold. Falls back to the process default. */
  autoApproveRisk?: AutoApproveRisk;
  /** When true, the caller explicitly passed confirm=true — acts as confirmation
   *  on clients that lack elicitation support (managed MCP, Cursor, etc.) and
   *  on clients that fail to surface a usable prompt. Override paths emit
   *  `method: "caller_confirmed"` (distinct from `elicited`) so audit sinks
   *  can tell automation overrides apart from genuine human consents. */
  callerConfirmed?: boolean;
}): Promise<ElicitationResult> {
  const threshold = autoApproveRisk ?? _autoApproveRisk;
  if (shouldAutoApprove(risk, threshold)) {
    log.debug("Auto-approved (risk within autonomous threshold)", { toolName, risk, threshold });
    return { proceed: true, method: "auto_approved" };
  }

  if (!clientSupportsElicitation(server.server)) {
    if (requiresConfirmation(risk)) {
      if (callerConfirmed) {
        log.info("Client lacks elicitation, proceeding via explicit confirm param", { toolName, risk });
        return { proceed: true, method: "caller_confirmed" };
      }
      log.warn("Client does not support elicitation, blocking operation", { toolName, risk });
      return { proceed: false, reason: "declined", method: "blocked" };
    }
    log.debug("Client does not support elicitation, proceeding (low risk)", { toolName, risk });
    return { proceed: true, method: "not_required" };
  }

  try {
    const result = await server.server.elicitInput({
      mode: "form",
      message,
      requestedSchema: confirmationSchema,
    });

    log.info("Elicitation response", { toolName, action: result.action });

    if (result.action === "accept") {
      const content = result.content;
      const confirmed = typeof content === "object"
        && content !== null
        && "confirm" in content
        && content.confirm === true;
      if (confirmed) {
        return { proceed: true, method: "elicited" };
      }
      if (callerConfirmed) {
        log.info("Elicitation accept missing confirm=true; proceeding via explicit confirm param", { toolName, risk });
        return { proceed: true, method: "caller_confirmed" };
      }
      log.warn("Elicitation accept missing confirm=true", { toolName, risk });
      return { proceed: false, reason: "cancelled", method: "elicited" };
    }
    // An explicit decline / cancel from a client that completed the
    // elicitation handshake is authoritative — `callerConfirmed` does NOT
    // override it, even if the caller passed `confirm: true`. The override
    // is reserved for clients that cannot or did not surface the prompt
    // (no capability, transport error, accept missing confirm=true).
    if (result.action === "decline") {
      return { proceed: false, reason: "declined", method: "elicited" };
    }
    return { proceed: false, reason: "cancelled", method: "elicited" };
  } catch (err) {
    if (requiresConfirmation(risk)) {
      if (callerConfirmed) {
        log.info("Elicitation failed but proceeding via explicit confirm param", { toolName, risk, error: String(err) });
        return { proceed: true, method: "caller_confirmed" };
      }
      log.warn("Elicitation failed, blocking operation", {
        toolName,
        risk,
        error: String(err),
      });
      return { proceed: false, reason: "cancelled", method: "blocked" };
    }
    log.warn("Elicitation failed, proceeding without confirmation (low risk)", {
      toolName,
      risk,
      error: String(err),
    });
    return { proceed: true, method: "skipped" };
  }
}
