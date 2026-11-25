/**
 * Helpers for sending MCP progress and logging notifications from tool handlers.
 *
 * Usage: call `sendProgress(ctx, ...)` or `sendLog(ctx, ...)` from any tool
 * handler that accepts the request context (second) parameter.
 */

import type { ServerContext } from "@modelcontextprotocol/server";

type Extra = ServerContext;

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
  const token = extra.mcpReq?._meta?.progressToken;
  if (token === undefined) return;
  try {
    await extra.mcpReq.notify({
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
    if (!extra.mcpReq?.log) return;
    await extra.mcpReq.log(level, data, logger);
  } catch {
    // Non-critical — client may not support logging
  }
}
