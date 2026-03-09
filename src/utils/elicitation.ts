import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createLogger } from "./logger.js";

const log = createLogger("elicitation");

export interface ElicitationResult {
  /** Whether the operation should proceed. */
  proceed: boolean;
  /** Why the operation was stopped, if applicable. */
  reason?: "declined" | "cancelled";
}

/**
 * Check whether the connected client advertises form elicitation support.
 */
export function clientSupportsElicitation(server: Server): boolean {
  const caps = server.getClientCapabilities();
  return !!caps?.elicitation?.form;
}

/**
 * Prompt the user to confirm a write operation via MCP form elicitation.
 *
 * Shows a message with the operation details — the user simply accepts or
 * declines. No form fields or checkboxes.
 *
 * When `destructive` is true (e.g. deletes), the operation is **blocked** if
 * the client doesn't support elicitation or the elicitation call fails.
 * Non-destructive writes proceed silently in those cases.
 */
export async function confirmViaElicitation({
  server,
  toolName,
  message,
  destructive = false,
}: {
  server: McpServer;
  toolName: string;
  message: string;
  /** When true, block the operation if confirmation cannot be obtained. */
  destructive?: boolean;
}): Promise<ElicitationResult> {
  if (!clientSupportsElicitation(server.server)) {
    if (destructive) {
      log.warn("Client does not support elicitation, blocking destructive operation", { toolName });
      return { proceed: false, reason: "declined" };
    }
    log.debug("Client does not support elicitation, proceeding", { toolName });
    return { proceed: true };
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
      return { proceed: true };
    }
    if (result.action === "decline") {
      return { proceed: false, reason: "declined" };
    }
    return { proceed: false, reason: "cancelled" };
  } catch (err) {
    if (destructive) {
      log.warn("Elicitation failed, blocking destructive operation", {
        toolName,
        error: String(err),
      });
      return { proceed: false, reason: "cancelled" };
    }
    log.warn("Elicitation failed, proceeding without confirmation", {
      toolName,
      error: String(err),
    });
    return { proceed: true };
  }
}
