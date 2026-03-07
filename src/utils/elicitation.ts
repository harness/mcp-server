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
 * If the client doesn't support elicitation (or the call throws),
 * proceeds silently — the LLM already chose to call the tool.
 */
export async function confirmViaElicitation({
  server,
  toolName,
  message,
}: {
  server: McpServer;
  toolName: string;
  message: string;
}): Promise<ElicitationResult> {
  if (!clientSupportsElicitation(server.server)) {
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
    log.warn("Elicitation failed, proceeding without confirmation", {
      toolName,
      error: String(err),
    });
    return { proceed: true };
  }
}
