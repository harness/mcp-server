/**
 * Helpers for sending MCP progress and logging notifications from tool handlers.
 *
 * Usage: call `sendProgress(extra, ...)` or `sendLog(extra, ...)` from any tool
 * handler that accepts the `extra` (second) parameter.
 */

import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

/**
 * Send a progress notification tied to the current request.
 * No-op if the client didn't provide a progressToken.
 */
export async function sendProgress(
  extra: Extra,
  progress: number,
  total: number | undefined,
  message?: string,
): Promise<void> {
  const token = extra._meta?.progressToken;
  if (token === undefined) return;
  try {
    await extra.sendNotification({
      method: "notifications/progress",
      params: { progressToken: token, progress, total, message },
    });
  } catch {
    // Non-critical — client may not support progress
  }
}

/**
 * Send a logging notification to the client.
 * No-op silently if the send fails.
 */
export async function sendLog(
  extra: Extra,
  level: "debug" | "info" | "warning" | "error",
  logger: string,
  data: string,
): Promise<void> {
  try {
    await extra.sendNotification({
      method: "notifications/message",
      params: { level, logger, data },
    });
  } catch {
    // Non-critical — client may not support logging
  }
}
