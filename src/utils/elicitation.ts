import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createLogger } from "./logger.js";
import { type RiskLevel, type AutoApproveRisk, shouldAutoApprove, requiresConfirmation } from "../registry/types.js";

const log = createLogger("elicitation");

export interface ElicitationResult {
  /** Whether the operation should proceed. */
  proceed: boolean;
  /** Why the operation was stopped, if applicable. */
  reason?: "declined" | "cancelled";
  /** How the confirmation was resolved — maps directly to ConfirmationMethod for audit. */
  method: "elicited" | "auto_approved" | "not_required" | "blocked" | "skipped";
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
 */
export async function confirmViaElicitation({
  server,
  toolName,
  message,
  risk,
  autoApproveRisk,
}: {
  server: McpServer;
  toolName: string;
  message: string;
  /** The risk level of the operation (from operationPolicy). */
  risk: RiskLevel;
  /** Optional per-session threshold. Falls back to the process default. */
  autoApproveRisk?: AutoApproveRisk;
}): Promise<ElicitationResult> {
  const threshold = autoApproveRisk ?? _autoApproveRisk;
  if (shouldAutoApprove(risk, threshold)) {
    log.debug("Auto-approved (risk within autonomous threshold)", { toolName, risk, threshold });
    return { proceed: true, method: "auto_approved" };
  }

  if (!clientSupportsElicitation(server.server)) {
    if (requiresConfirmation(risk)) {
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
      requestedSchema: {
        type: "object",
        properties: {},
      },
    });

    log.info("Elicitation response", { toolName, action: result.action });

    if (result.action === "accept") {
      return { proceed: true, method: "elicited" };
    }
    if (result.action === "decline") {
      return { proceed: false, reason: "declined", method: "elicited" };
    }
    return { proceed: false, reason: "cancelled", method: "elicited" };
  } catch (err) {
    if (requiresConfirmation(risk)) {
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
