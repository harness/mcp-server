import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/*
 * Error handling convention for tool handlers:
 *
 *   return errorResult(msg)  — for user-fixable problems the LLM can act on:
 *     bad resource_type, unsupported operation, missing required fields,
 *     validation errors (plain Errors from registry/toolset layer), AND
 *     Harness API 400/404 responses (bad identifier, wrong project, etc.).
 *     The LLM sees the message and can retry/adjust.
 *
 *   throw toMcpError(err)    — for infrastructure failures the LLM cannot fix:
 *     HTTP 5xx, auth failures (401/403), timeouts, rate limits (429). These are
 *     HarnessApiErrors thrown by the HTTP client. Thrown as JSON-RPC errors so
 *     MCP clients surface them as system-level failures.
 *
 * Quick test: plain Error or HarnessApiError 400/404 → return errorResult.
 *             HarnessApiError 401/403/429/5xx → throw toMcpError.
 */

/**
 * Typed error for Harness API failures.
 */
export class HarnessApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly harnessCode?: string,
    public readonly correlationId?: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "HarnessApiError";
  }
}

/**
 * Returns true for user-fixable errors (registry validation, missing fields,
 * unknown resource types) — i.e. plain Errors that are NOT HarnessApiErrors.
 */
export function isUserError(err: unknown): err is Error {
  return err instanceof Error && !(err instanceof HarnessApiError) && !(err instanceof McpError);
}

/**
 * Returns true for Harness API errors that the LLM can act on (400 bad request,
 * 404 not found). These indicate wrong identifiers, missing resources, or bad
 * input — problems the LLM can fix by retrying with different parameters.
 */
export function isUserFixableApiError(err: unknown): err is HarnessApiError {
  return err instanceof HarnessApiError && (err.statusCode === 400 || err.statusCode === 404);
}

/**
 * Map a HarnessApiError (or generic Error) to an MCP-friendly McpError.
 */
export function toMcpError(err: unknown): McpError {
  if (err instanceof McpError) return err;

  if (err instanceof HarnessApiError) {
    const code = mapHttpStatusToMcpCode(err.statusCode);
    const detail = err.correlationId ? ` (correlationId: ${err.correlationId})` : "";
    const mcpErr = new McpError(code, `${err.message}${detail}`);
    mcpErr.cause = err;
    return mcpErr;
  }

  if (err instanceof Error) {
    const mcpErr = new McpError(ErrorCode.InternalError, err.message);
    mcpErr.cause = err;
    return mcpErr;
  }

  return new McpError(ErrorCode.InternalError, String(err));
}

function mapHttpStatusToMcpCode(status: number): ErrorCode {
  if (status === 400) return ErrorCode.InvalidParams;
  if (status === 401 || status === 403) return ErrorCode.InvalidRequest;
  if (status === 404) return ErrorCode.InvalidParams;
  if (status === 429) return ErrorCode.InternalError;
  return ErrorCode.InternalError;
}
